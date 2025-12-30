import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { prisma } from "@/src/lib/prisma";
import { getEntitlements } from "@/src/lib/entitlements";

// Make sure this runs on Node (Prisma + Clerk)
export const runtime = "nodejs";

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

function projectYears(params: Body) {
  const years = params.years ?? 5;
  const g = params.sdeGrowthPct / 100;
  const taxRate = params.taxRatePct / 100;

  let cumulative = 0;

  const rows: ProjRow[] = Array.from({ length: years }, (_, idx) => {
    const year = idx + 1;
    const sde = params.sdeYear1 * Math.pow(1 + g, idx);
    const capex = Math.max(0, params.capexAnnual);

    const preTax = sde - params.annualDebt - capex;
    const tax = Math.max(0, preTax) * taxRate;
    const net = preTax - tax;

    cumulative += net;

    return { year, sde, debt: params.annualDebt, capex, tax, net, cumulative };
  });

  const breakEvenYear = rows.find((r) => r.net > 0)?.year ?? null;
  const paybackYears =
    rows[0]?.net > 0 ? params.upfrontCash / rows[0].net : null;

  return { rows, breakEvenYear, paybackYears };
}

export async function POST(req: NextRequest) {
  const { userId } = await auth();
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const access = await prisma.userAccess.findUnique({
    where: { userId },
    select: { plan: true, subscriptionStatus: true, isAdmin: true },
  });

  // getEntitlements expects { plan: string; isAdmin: boolean }
  const ent = getEntitlements({
    plan: String(access?.plan ?? "free"),
    isAdmin: !!access?.isAdmin,
  });

  // ✅ lock this feature on the server
  if (!ent.canUse5YearProjection) {
    return NextResponse.json(
      { error: "Upgrade required", code: "PROJECTION_LOCKED" },
      { status: 403 }
    );
  }

  const body = (await req.json()) as Partial<Body>;

  const safeNum = (n: unknown) =>
    typeof n === "number" && Number.isFinite(n) ? n : 0;

  const result = projectYears({
    sdeYear1: safeNum(body.sdeYear1),
    annualDebt: safeNum(body.annualDebt),
    upfrontCash: safeNum(body.upfrontCash),
    years: body.years ?? 5,
    sdeGrowthPct: safeNum(body.sdeGrowthPct),
    capexAnnual: safeNum(body.capexAnnual),
    taxRatePct: safeNum(body.taxRatePct),
  });

  return NextResponse.json({ ok: true, ...result });
}
