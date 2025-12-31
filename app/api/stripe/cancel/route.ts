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
    return NextResponse.json({ ok: false, error: "No subscription" }, { status: 400 });
  }

  // ✅ This cancels immediately (ends trial immediately too)
  const sub = await stripe.subscriptions.cancel(access.stripeSubscriptionId);

  // ✅ Update your DB right away so UI flips instantly
  await prisma.userAccess.update({
    where: { userId },
    data: {
      subscriptionStatus: sub.status as any,
      plan: "free",
      stripeSubscriptionId: null,
      stripePriceId: null,
      currentPeriodEnd: null,
    },
  });

  return NextResponse.json({ ok: true });
}
