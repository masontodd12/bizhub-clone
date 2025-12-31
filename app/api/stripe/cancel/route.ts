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
  if (!access?.stripeSubscriptionId) {
    return NextResponse.json(
      { ok: false, error: "No subscription" },
      { status: 400 }
    );
  }

  // cancel immediately
  await stripe.subscriptions.cancel(access.stripeSubscriptionId);

  // immediately downgrade locally so UI flips instantly
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
