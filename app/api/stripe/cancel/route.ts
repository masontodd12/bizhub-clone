// app/api/stripe/cancel/route.ts
export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";
import Stripe from "stripe";
import { auth } from "@clerk/nextjs/server";
import { prisma } from "@/src/lib/prisma";

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!);

export async function POST() {
  const { userId } = await auth();
  if (!userId) {
    return NextResponse.json({ ok: false, error: "Not authenticated" }, { status: 401 });
  }

  const access = await prisma.userAccess.findUnique({
    where: { userId },
    select: {
      stripeCustomerId: true,
      stripeSubscriptionId: true,
      hasUsedTrial: true,
    },
  });

  let attemptedSubId: string | null = access?.stripeSubscriptionId ?? null;
  let cancelled = false;
  let stripeError: string | null = null;

  // --- STRIPE (best effort) ---
  try {
    if (access?.stripeCustomerId) {
      if (attemptedSubId) {
        try {
          await stripe.subscriptions.cancel(attemptedSubId);
          cancelled = true;
        } catch (e: any) {
          stripeError = e?.message ?? "Stripe cancel failed for stored subId";
        }
      }

      if (!cancelled) {
        const subs = await stripe.subscriptions.list({
          customer: access.stripeCustomerId,
          status: "all",
          limit: 10,
        });

        const activeLike = subs.data.find((s) =>
          ["active", "trialing", "past_due", "unpaid"].includes(s.status)
        );

        if (activeLike?.id) {
          attemptedSubId = activeLike.id;
          try {
            await stripe.subscriptions.cancel(activeLike.id);
            cancelled = true;
            stripeError = null;
          } catch (e: any) {
            stripeError = e?.message ?? "Stripe cancel failed for listed subId";
          }
        }
      }
    }
  } catch (e: any) {
    stripeError = e?.message ?? "Stripe error";
  }

  // --- DB TRUTH: always clean state ---
  await prisma.userAccess.upsert({
    where: { userId },
    update: {
      plan: "free",
      subscriptionStatus: "canceled",     // ✅ fix stale trialing
      hasUsedTrial: true,                 // ✅ burn trial permanently (if they ever hit trial)
      trialStartedAt: null,
      trialEndsAt: null,
      stripeSubscriptionId: null,
      stripePriceId: null,
      currentPeriodEnd: null,
    },
    create: {
      userId,
      plan: "free",
      subscriptionStatus: "canceled",
      hasUsedTrial: true,
      stripeCustomerId: access?.stripeCustomerId ?? null,
    },
  });

  return NextResponse.json({
    ok: true,
    downgraded: true,
    cancelledInStripe: cancelled,
    attemptedSubId,
    stripeError,
  });
}
