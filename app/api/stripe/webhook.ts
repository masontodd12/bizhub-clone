import { NextResponse } from "next/server";
import Stripe from "stripe";
import { prisma } from "@/src/lib/prisma";

export const runtime = "nodejs";

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: "2025-12-15.clover",
});

/* ---------------- helpers ---------------- */

function planFromPriceId(priceId?: string | null) {
  if (!priceId) return "free";
  if (priceId === process.env.STRIPE_PRICE_PRO) return "pro";
  if (priceId === process.env.STRIPE_PRICE_PRO_PLUS) return "pro_plus";
  return "free";
}

function mapStatus(status: Stripe.Subscription.Status) {
  if (status === "active" || status === "trialing") return "active";
  if (status === "past_due") return "past_due";
  if (status === "canceled" || status === "unpaid") return "canceled";
  return "none";
}

async function findAccessByCustomer(customerId: string) {
  return prisma.userAccess.findFirst({
    where: { stripeCustomerId: customerId },
    select: { userId: true },
  });
}

/* ---------------- webhook ---------------- */

export async function POST(req: Request) {
  const sig = req.headers.get("stripe-signature");
  if (!sig) return new NextResponse("Missing signature", { status: 400 });

  const body = await req.text();

  let event: Stripe.Event;
  try {
    event = stripe.webhooks.constructEvent(
      body,
      sig,
      process.env.STRIPE_WEBHOOK_SECRET!
    );
  } catch (err: any) {
    return new NextResponse(`Webhook Error: ${err.message}`, { status: 400 });
  }

  try {
    /* checkout completed */
    if (event.type === "checkout.session.completed") {
      const session = event.data.object as Stripe.Checkout.Session;

      const customerId = session.customer as string | null;
      const subscriptionId = session.subscription as string | null;
      if (!customerId || !subscriptionId)
        return NextResponse.json({ received: true });

      const access = await findAccessByCustomer(customerId);
      if (!access) return NextResponse.json({ received: true });

      const sub = await stripe.subscriptions.retrieve(subscriptionId, {
        expand: ["items.data.price"],
      });

      const priceId = sub.items.data[0]?.price?.id ?? null;

      await prisma.userAccess.update({
        where: { userId: access.userId },
        data: {
          stripeSubscriptionId: sub.id,
          subscriptionStatus: mapStatus(sub.status),
          plan: planFromPriceId(priceId),
          hasUsedTrial: true,
          trialStartedAt: sub.trial_start
            ? new Date(sub.trial_start * 1000)
            : null,
          trialEndsAt: sub.trial_end
            ? new Date(sub.trial_end * 1000)
            : null,
        },
      });
    }

    /* subscription updated */
    if (event.type === "customer.subscription.updated") {
      const sub = event.data.object as Stripe.Subscription;
      const customerId = sub.customer as string | null;
      if (!customerId) return NextResponse.json({ received: true });

      const access = await findAccessByCustomer(customerId);
      if (!access) return NextResponse.json({ received: true });

      const priceId = sub.items.data[0]?.price?.id ?? null;

      await prisma.userAccess.update({
        where: { userId: access.userId },
        data: {
          stripeSubscriptionId: sub.id,
          subscriptionStatus: mapStatus(sub.status),
          plan: planFromPriceId(priceId),
          hasUsedTrial: true,
          trialStartedAt: sub.trial_start
            ? new Date(sub.trial_start * 1000)
            : null,
          trialEndsAt: sub.trial_end
            ? new Date(sub.trial_end * 1000)
            : null,
        },
      });
    }

    /* payment failed */
    if (event.type === "invoice.payment_failed") {
      const invoice = event.data.object as Stripe.Invoice;
      const customerId =
        typeof invoice.customer === "string"
          ? invoice.customer
          : invoice.customer?.id;

      if (!customerId) return NextResponse.json({ received: true });

      await prisma.userAccess.updateMany({
        where: { stripeCustomerId: customerId },
        data: { subscriptionStatus: "past_due" },
      });
    }

    /* subscription canceled */
    if (event.type === "customer.subscription.deleted") {
      const sub = event.data.object as Stripe.Subscription;
      const customerId = sub.customer as string | null;
      if (!customerId) return NextResponse.json({ received: true });

      const access = await findAccessByCustomer(customerId);
      if (!access) return NextResponse.json({ received: true });

      await prisma.userAccess.update({
        where: { userId: access.userId },
        data: {
          subscriptionStatus: "canceled",
          plan: "free",
          hasUsedTrial: true,
          trialStartedAt: null,
          trialEndsAt: null,
        },
      });
    }

    return NextResponse.json({ received: true });
  } catch (err) {
    console.error("Webhook error:", err);
    return new NextResponse("Webhook failed", { status: 500 });
  }
}
