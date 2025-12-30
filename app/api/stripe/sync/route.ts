import { NextResponse } from "next/server";
import Stripe from "stripe";
import { auth } from "@clerk/nextjs/server";
import { prisma } from "@/src/lib/prisma";

export const runtime = "nodejs";

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: "2025-12-15.clover",
});

export async function POST(req: Request) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ ok: false }, { status: 401 });

  const { session_id } = await req.json();
  if (!session_id) return NextResponse.json({ ok: false }, { status: 400 });

  const session = await stripe.checkout.sessions.retrieve(session_id, {
    expand: ["subscription", "customer"],
  });

  const customerId =
    typeof session.customer === "string" ? session.customer : session.customer?.id;

  if (!session.subscription) {
    return NextResponse.json({ ok: false, error: "No subscription on session" }, { status: 400 });
  }

  const sub: Stripe.Subscription =
    typeof session.subscription === "string"
      ? await stripe.subscriptions.retrieve(session.subscription)
      : (session.subscription as Stripe.Subscription);

  if (!customerId || !sub) return NextResponse.json({ ok: false }, { status: 400 });

  const priceId = sub.items.data[0]?.price?.id ?? null;

  // Optional: infer plan from priceId
  const plan =
    priceId === process.env.STRIPE_PRICE_PRO_PLUS ? "pro_plus" : "pro";

  await prisma.userAccess.update({
    where: { userId },
    data: {
      stripeCustomerId: customerId,
      stripeSubscriptionId: sub.id,
      stripePriceId: priceId,
      subscriptionStatus: sub.status as any,
      currentPeriodEnd: new Date(sub.current_period_end * 1000),
      plan,
    },
  });

  return NextResponse.json({ ok: true });
}
