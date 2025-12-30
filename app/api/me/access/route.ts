// app/api/me/access/route.ts

import { NextResponse } from "next/server";
import { auth, clerkClient } from "@clerk/nextjs/server";
import { prisma } from "@/src/lib/prisma";
import { getEntitlements } from "@/src/lib/entitlements";

export const dynamic = "force-dynamic";

function startOfDayUTC(d = new Date()) {
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
}

function resetsAtUTC(d = new Date()) {
  const day = startOfDayUTC(d);
  return new Date(day.getTime() + 24 * 60 * 60 * 1000).toISOString();
}

// ✅ Decide daily limits by plan + feature
function dailyLimitFor(plan: string, feature: "cimAnalyzer" | "dealAnalyze") {
  // Pro+:
  if (plan === "pro_plus") {
    if (feature === "cimAnalyzer") return 10; // ✅ 10/day
    if (feature === "dealAnalyze") return null; // ✅ unlimited
  }

  // Pro:
  if (plan === "pro") {
    if (feature === "cimAnalyzer") return 3;
    if (feature === "dealAnalyze") return 3;
  }

  // Free:
  return 0;
}

async function getUsage(userId: string, feature: string, day: Date) {
  return prisma.featureUsage.findUnique({
    where: { userId_feature_day: { userId, feature, day } },
  });
}

export async function GET() {
  const { userId } = await auth();
  if (!userId) {
    return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  }

  // ============================================================
  // 1) Pull email from Clerk (TS-safe for your Clerk version)
  // ============================================================
  let email: string | null = null;
  let emailVerified = false;

  try {
    const client = await clerkClient(); // ✅ FIX: clerkClient is async in your types
    const user = await client.users.getUser(userId);

    const primaryId = user.primaryEmailAddressId;
    const primary = primaryId
      ? user.emailAddresses.find((e) => e.id === primaryId)
      : undefined;

    const chosen = primary ?? user.emailAddresses?.[0];

    email = chosen?.emailAddress ?? null;
    emailVerified = chosen?.verification?.status === "verified";
  } catch (_err: unknown) {
    // If Clerk fetch fails, we still return access info
  }

  // ============================================================
  // 2) Upsert UserAccess and store email (requires schema fields)
  // ============================================================
  const ua = await prisma.userAccess.upsert({
    where: { userId },
    create: {
      userId,
      email: email ?? undefined,
      emailVerified,
      // plan defaults to free in schema
    },
    update: {
      ...(email ? { email } : {}),
      emailVerified,
    },
  });

  const plan = String(ua?.plan ?? "free");
  const isAdmin = ua?.isAdmin ?? false;

  const entitlements = getEntitlements({ plan, isAdmin });

  const day = startOfDayUTC();
  const resetISO = resetsAtUTC();

  // ===== CIM ANALYZER LIMITS =====
  const cimFeature = "cimAnalyzer";
  const cimDailyLimit = dailyLimitFor(plan, "cimAnalyzer");
  const cimUsage = await getUsage(userId, cimFeature, day);

  const cimUsedToday = cimUsage?.count ?? 0;
  const cimRemaining =
    typeof cimDailyLimit === "number" ? Math.max(0, cimDailyLimit - cimUsedToday) : 0;

  // ===== DEAL ANALYZE LIMITS =====
  const dealFeature = "dealAnalyze";
  const dealDailyLimit = dailyLimitFor(plan, "dealAnalyze"); // number | null
  const dealUsage = await getUsage(userId, dealFeature, day);

  const dealUsedToday = dealUsage?.count ?? 0;
  const dealRemaining =
    dealDailyLimit === null ? null : Math.max(0, dealDailyLimit - dealUsedToday);

  const withLimits = {
    ...entitlements,
    limits: {
      ...(entitlements.limits ?? {}),
      cimAnalyzer: {
        dailyLimit: typeof cimDailyLimit === "number" ? cimDailyLimit : 0,
        usedToday: cimUsedToday,
        remaining: cimRemaining,
        resetsAt: resetISO,
      },
      dealAnalyze: {
        dailyLimit: dealDailyLimit, // null = unlimited
        usedToday: dealUsedToday,
        remaining: dealRemaining, // null = unlimited
        resetsAt: resetISO,
      },
    },
  };

  return NextResponse.json({
    ok: true,
    plan,
    isAdmin,
    user: { userId, email, emailVerified },
    entitlements: withLimits,
  });
}
