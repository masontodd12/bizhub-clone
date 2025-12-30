// app/api/deal-calculator/analyze/route.ts
import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { prisma } from "@/src/lib/prisma";
import { getEntitlements } from "@/src/lib/entitlements";

type Body = {
  sdeYear1: number;
  annualDebt: number;
  upfrontCash: number;
  years?: number; // default 5
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

function projectYears(params: Body) {
  const years = params.years ?? 5;
  const g = (params.sdeGrowthPct ?? 0) / 100;
  const taxRate = (params.taxRatePct ?? 0) / 100;

  let cumulative = 0;

  const rows: ProjRow[] = Array.from({ length: years }, (_, idx) => {
    const year = idx + 1;

    const sde = (params.sdeYear1 ?? 0) * Math.pow(1 + g, idx);
    const debt = params.annualDebt ?? 0;
    const capex = params.capexAnnual ?? 0;

    const preTax = sde - debt - capex;
    const tax = preTax > 0 ? preTax * taxRate : 0;

    const net = preTax - tax;
    cumulative += net;

    return { year, sde, debt, capex, tax, net, cumulative };
  });

  const breakEvenYear = rows.find((r) => r.net > 0)?.year ?? null;

  const year1Net = rows[0]?.net ?? 0;
  const paybackYears = year1Net > 0 ? (params.upfrontCash ?? 0) / year1Net : null;

  return { rows, breakEvenYear, paybackYears };
}

export async function POST(req: Request) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  // ✅ your getEntitlements expects an "access" object
  const access =
    (await prisma.userAccess.findUnique({
      where: { userId },
      select: { plan: true, isAdmin: true },
    })) ?? ({ plan: "free", isAdmin: false } as any);

  const entitlements = getEntitlements(access);

  // ✅ Allow Pro + Pro+ to analyze (Pro has 3/day; Pro+ unlimited)
  if (!entitlements.isPro && !entitlements.isProPlus && !entitlements.isAdmin) {
    return NextResponse.json({ error: "Subscription required" }, { status: 403 });
  }

  const body = (await req.json()) as Body;

  const sdeYear1 = Number(body.sdeYear1 ?? 0);
  const annualDebt = Number(body.annualDebt ?? 0);
  const upfrontCash = Number(body.upfrontCash ?? 0);

  if (!Number.isFinite(sdeYear1) || !Number.isFinite(annualDebt) || !Number.isFinite(upfrontCash)) {
    return NextResponse.json({ error: "Invalid inputs" }, { status: 400 });
  }

  // ✅ limits: Pro = 3/day, Pro+ = unlimited
  const DAILY_LIMIT = entitlements.isProPlus || entitlements.isAdmin ? Infinity : 3;

  const today = todayUTCStart();

  // ============================================================
  // ✅ Usage tracking WITHOUT relying on prisma.dealUsage types
  // Table name uses Prisma default for model DealUsage => "DealUsage"
  // If you used @@map("deal_usage"), replace "DealUsage" with "deal_usage"
  // ============================================================

  // 1) Create row if missing (upsert)
  // NOTE: gen_random_uuid() requires pgcrypto.
  // If your DB doesn't have it, swap gen_random_uuid()::text for:
  // md5(random()::text || clock_timestamp()::text)::text
  await prisma.$executeRaw`
    INSERT INTO "DealUsage" ("id","userId","date","count","createdAt","updatedAt")
    VALUES (gen_random_uuid()::text, ${userId}, ${today}, 0, NOW(), NOW())
    ON CONFLICT ("userId","date") DO NOTHING
  `;

  // 2) Read current count
  const rows = await prisma.$queryRaw<UsageRow[]>`
    SELECT "id","count"
    FROM "DealUsage"
    WHERE "userId" = ${userId} AND "date" = ${today}
    LIMIT 1
  `;

  const usage = rows?.[0];
  if (!usage) return NextResponse.json({ error: "Usage tracking failed" }, { status: 500 });

  if (usage.count >= DAILY_LIMIT) {
    return NextResponse.json(
      {
        ok: false,
        code: "DAILY_LIMIT",
        error: entitlements.isPro
          ? "Daily limit reached (3/day). Upgrade to Pro Plus for unlimited analyzes."
          : `Daily limit reached (${DAILY_LIMIT}/day).`,
      },
      { status: 429 }
    );
  }

  // 3) Increment
  await prisma.$executeRaw`
    UPDATE "DealUsage"
    SET "count" = "count" + 1, "updatedAt" = NOW()
    WHERE "id" = ${usage.id}
  `;

  // ============================================================

  const proj = projectYears({
    ...body,
    years: body.years ?? 5,
  });

  return NextResponse.json({
    ok: true,
    rows: proj.rows,
    breakEvenYear: proj.breakEvenYear,
    paybackYears: proj.paybackYears,
  });
}
