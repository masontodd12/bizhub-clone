// app/api/me/access/route.ts

import { NextResponse } from "next/server";
import { auth, clerkClient } from "@clerk/nextjs/server";
import { prisma } from "@/src/lib/prisma";
import { getEntitlements } from "@/src/lib/entitlements";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function startOfDayUTC(d = new Date()) {
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
}

function resetsAtUTC(d = new Date()) {
  const day = startOfDayUTC(d);
  return new Date(day.getTime() + 24 * 60 * 60 * 1000).toISOString();
}

function dailyLimitFor(plan: string, feature: "cimAnalyzer" | "dealAnalyze") {
  if (plan === "pro_plus") {
    if (feature === "cimAnalyzer") return 10;
    if (feature === "dealAnalyze") return null;
  }

  if (plan === "pro") {
    if (feature === "cimAnalyzer") return 3;
    if (feature === "dealAnalyze") return 3;
  }

  return 0;
}

async function getUsage(userId: string, feature: string, day: Date) {
  return prisma.featureUsage.findUnique({
    where: {
      userId_feature_day: { userId, feature, day },
    },
  });
}

export async function GET() {
  const { userId } = await auth();

  if (!userId) {
    return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  }

  let email: string | null = null;
  let emailVerified = false;

  try {
    const client = await clerkClient();
    const user = await client.users.getUser(userId);

    const primaryId = user.primaryEmailAddressId;
    const primary = primaryId
      ? user.emailAddresses.find((e: { id: string }) => e.id === primaryId)
      : undefined;

    const chosen = primary ?? user.emailAddresses?.[0];

    email = chosen?.emailAddress ?? null;
    emailVerified = chosen?.verification?.status === "verified";
  } catch {
    // Clerk failure should not block access
  }

  const ua = await prisma.userAccess.upsert({
    where: { userId },
    create: {
      userId,
      email: email ?? undefined,
      emailVerified,
    },
    update: {
      ...(email ? { email } : {}),
      emailVerified,
    },
  });

  const plan = String(ua?.plan ?? "free");
  const isAdmin = ua?.isAdmin ?? false;

  // ✅ Never expose a paid status if plan is free (prevents UI weirdness)
  const subscriptionStatus =
    plan === "free" ? "none" : String(ua?.subscriptionStatus ?? "none");

  const entitlements = getEntitlements({ plan, isAdmin });

  const day = startOfDayUTC();
  const resetISO = resetsAtUTC();

  const cimLimit = dailyLimitFor(plan, "cimAnalyzer");
  const cimUsage = await getUsage(userId, "cimAnalyzer", day);

  const dealLimit = dailyLimitFor(plan, "dealAnalyze");
  const dealUsage = await getUsage(userId, "dealAnalyze", day);

  return NextResponse.json({
    ok: true,
    plan,
    subscriptionStatus,
    isAdmin,
    user: { userId, email, emailVerified },
    entitlements: {
      ...entitlements,
      limits: {
        cimAnalyzer: {
          dailyLimit: typeof cimLimit === "number" ? cimLimit : 0,
          usedToday: cimUsage?.count ?? 0,
          remaining:
            typeof cimLimit === "number"
              ? Math.max(0, cimLimit - (cimUsage?.count ?? 0))
              : 0,
          resetsAt: resetISO,
        },
        dealAnalyze: {
          dailyLimit: dealLimit,
          usedToday: dealUsage?.count ?? 0,
          remaining:
            dealLimit === null
              ? null
              : Math.max(0, dealLimit - (dealUsage?.count ?? 0)),
          resetsAt: resetISO,
        },
      },
    },
  });
}
