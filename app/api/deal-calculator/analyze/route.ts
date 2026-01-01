import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { prisma } from "@/src/lib/prisma";
import { getEntitlements } from "@/src/lib/entitlements";

/* =========================
   Types
========================= */

type Body = {
  sdeYear1: number;
  annualDebt: number;
  upfrontCash: number;
  years?: number;
  sdeGrowthPct: number;
  capexAnnual: number;
  taxRatePct: number;
};

type ProjRow = {
  year: number;
  sde: number;
  debt: number;
  capex: number;
  tax: number;
  net: number;
  cumulative: number;
};

type UsageRow = { id: string; count: number };

function todayUTCStart(): Date {
  const now = new Date();
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
}

/* =========================
   Projection Logic
========================= */

function projectYears(params: Body) {
  const years = params.years ?? 5;
  const g = params.sdeGrowthPct / 100;
  const taxRate = params.taxRatePct / 100;

  let cumulative = 0;

  const rows: ProjRow[] = Array.from({ length: years }, (_, i) => {
    const year = i + 1;
    const sde = params.sdeYear1 * Math.pow(1 + g, i);
    const debt = params.annualDebt;
    const capex = params.capexAnnual;

    const preTax = sde - debt - capex;
    const tax = preTax > 0 ? preTax * taxRate : 0;
    const net = preTax - tax;

    cumulative += net;

    return { year, sde, debt, capex, tax, net, cumulative };
  });

  const breakEvenYear = rows.find(r => r.net > 0)?.year ?? null;
  const year1Net = rows[0]?.net ?? 0;
  const paybackYears =
    year1Net > 0 ? params.upfrontCash / year1Net : null;

  return { rows, breakEvenYear, paybackYears };
}

/* =========================
   Route
========================= */

export async function POST(req: Request) {
  const { userId } = await auth();
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const access =
    (await prisma.userAccess.findUnique({
      where: { userId },
      select: { plan: true, isAdmin: true },
    })) ?? ({ plan: "free", isAdmin: false } as any);

  const ent = getEntitlements(access);

  // Pro / Pro+ / Admin only
  if (!ent.isPro && !ent.isProPlus && !ent.isAdmin) {
    return NextResponse.json({ error: "Subscription required" }, { status: 403 });
  }

  const body = (await req.json()) as Body;

  if (
    !Number.isFinite(body.sdeYear1) ||
    !Number.isFinite(body.annualDebt) ||
    !Number.isFinite(body.upfrontCash)
  ) {
    return NextResponse.json({ error: "Invalid inputs" }, { status: 400 });
  }

  // ✅ LIMITS — PRO = 3/day, PRO+ = unlimited
  const DAILY_LIMIT = ent.isProPlus || ent.isAdmin ? null : 3;
  const today = todayUTCStart();

  await prisma.$executeRaw`
    INSERT INTO "DealUsage" ("id","userId","date","count","createdAt","updatedAt")
    VALUES (gen_random_uuid()::text, ${userId}, ${today}, 0, NOW(), NOW())
    ON CONFLICT ("userId","date") DO NOTHING
  `;

  const rows = await prisma.$queryRaw<UsageRow[]>`
    SELECT "id","count"
    FROM "DealUsage"
    WHERE "userId" = ${userId} AND "date" = ${today}
    LIMIT 1
  `;

  const usage = rows[0];
  if (!usage) {
    return NextResponse.json({ error: "Usage tracking failed" }, { status: 500 });
  }

  if (DAILY_LIMIT !== null && usage.count >= DAILY_LIMIT) {
    return NextResponse.json(
      {
        code: "DAILY_LIMIT",
        error: "Daily limit reached (3/day). Upgrade to Pro+.",
      },
      { status: 429 }
    );
  }

  await prisma.$executeRaw`
    UPDATE "DealUsage"
    SET "count" = "count" + 1, "updatedAt" = NOW()
    WHERE "id" = ${usage.id}
  `;

  const proj = projectYears(body);

  return NextResponse.json({
    ok: true,
    rows: proj.rows,
    breakEvenYear: proj.breakEvenYear,
    paybackYears: proj.paybackYears,
  });
}
