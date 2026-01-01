// app/api/me/usage/route.ts
import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { prisma } from "@/src/lib/prisma";
import { getEntitlements } from "@/src/lib/entitlements";

type UsageRow = {
  count: number;
};

function todayUTCStart(): Date {
  const now = new Date();
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
}

export async function GET() {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ enabled: false });

  const access =
    (await prisma.userAccess.findUnique({
      where: { userId },
      select: { plan: true, isAdmin: true },
    })) ?? ({ plan: "free", isAdmin: false } as any);

  const ent = getEntitlements(access);

  // Free users
  if (!ent.isPro && !ent.isProPlus && !ent.isAdmin) {
    return NextResponse.json({ enabled: false });
  }

  // Pro+ (or admin) is unlimited
  const unlimited = ent.isProPlus || ent.isAdmin;
  const dailyLimit: number | null = unlimited ? null : 3;

  const today = todayUTCStart();

  // Ensure row exists
  await prisma.$executeRaw`
    INSERT INTO "DealUsage" ("id","userId","date","count","createdAt","updatedAt")
    VALUES (gen_random_uuid()::text, ${userId}, ${today}, 0, NOW(), NOW())
    ON CONFLICT ("userId","date") DO NOTHING
  `;

  // Read usage
  const rows = await prisma.$queryRaw<UsageRow[]>`
    SELECT "count"
    FROM "DealUsage"
    WHERE "userId" = ${userId} AND "date" = ${today}
    LIMIT 1
  `;

  const countToday = rows?.[0]?.count ?? 0;

  // IMPORTANT: do NOT return Infinity in JSON
  const remaining: number | null =
    dailyLimit === null ? null : Math.max(0, dailyLimit - countToday);

  const pctUsed =
    dailyLimit === null
      ? 0
      : Math.min(100, Math.round((countToday / dailyLimit) * 100));

  return NextResponse.json({
    enabled: true,
    countToday,
    dailyLimit,  // null => unlimited
    remaining,   // null => unlimited
    pctUsed,
  });
}
