// app/api/stripe/cancel/route.ts
import { NextResponse } from "next/server";
import Stripe from "stripe";
import { auth } from "@clerk/nextjs/server";
import { prisma } from "@/src/lib/prisma";

export const runtime = "nodejs";

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: "2025-12-15.clover",
});

export async function POST() {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ ok: false }, { status: 401 });

  const access = await prisma.userAccess.findUnique({ where: { userId } });
  if (!access?.stripeCustomerId) {
    return NextResponse.json(
      { ok: false, error: "No Stripe customer on file" },
      { status: 400 }
    );
  }

  // 1) Determine subscription id (DB first, fallback to Stripe)
  let subId = access.stripeSubscriptionId;

  if (!subId) {
    const subs = await stripe.subscriptions.list({
      customer: access.stripeCustomerId,
      status: "all",
      limit: 10,
    });

    // pick an active/trialing/past_due sub first
    const picked =
      subs.data.find((s) => s.status === "active") ||
      subs.data.find((s) => s.status === "trialing") ||
      subs.data.find((s) => s.status === "past_due") ||
      subs.data[0];

    subId = picked?.id ?? null;
  }

  if (!subId) {
    // Nothing to cancel, still downgrade locally
    await prisma.userAccess.update({
      where: { userId },
      data: {
        subscriptionStatus: "canceled",
        plan: "free",
        stripeSubscriptionId: null,
        stripePriceId: null,
        currentPeriodEnd: null,
        trialStartedAt: null,
        trialEndsAt: null,
      },
    });

    return NextResponse.json({ ok: true, note: "No subscription found; downgraded locally" });
  }

  // 2) Cancel immediately
  await stripe.subscriptions.cancel(subId);

  // 3) Downgrade immediately in DB
  await prisma.userAccess.update({
    where: { userId },
    data: {
      subscriptionStatus: "canceled",
      plan: "free",
      stripeSubscriptionId: null,
      stripePriceId: null,
      currentPeriodEnd: null,
      trialStartedAt: null,
      trialEndsAt: null,
    },
  });

  return NextResponse.json({ ok: true });
}
