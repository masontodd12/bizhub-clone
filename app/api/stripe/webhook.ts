// app/api/stripe/webhook.ts
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

// IMPORTANT: drop app-access immediately if user scheduled cancel
function effectiveAppPlan(sub: Stripe.Subscription, priceId?: string | null) {
  if ((sub as any).cancel_at_period_end) return "free";
  if (
    sub.status === "canceled" ||
    sub.status === "unpaid" ||
    sub.status === "incomplete_expired"
  ) {
    return "free";
  }
  return planFromPriceId(priceId);
}

function effectiveAppStatus(sub: Stripe.Subscription) {
  if ((sub as any).cancel_at_period_end) return "canceled";

  if (sub.status === "active" || sub.status === "trialing") return "active";
  if (sub.status === "past_due") return "past_due";
  if (
    sub.status === "canceled" ||
    sub.status === "unpaid" ||
    sub.status === "incomplete_expired"
  )
    return "canceled";

  return "none";
}

async function findAccessByCustomer(customerId: string) {
  return prisma.userAccess.findFirst({
    where: { stripeCustomerId: customerId },
    select: { userId: true },
  });
}

/**
 * Sync plan/status/period dates from a subscription.
 * IMPORTANT: does NOT touch hasUsedTrial.
 */
async function upsertFromSubscription(
  customerId: string,
  sub: Stripe.Subscription
) {
  const access = await findAccessByCustomer(customerId);
  if (!access) return;

  const priceId = sub.items?.data?.[0]?.price?.id ?? null;

  const plan = effectiveAppPlan(sub, priceId);
  const subscriptionStatus = effectiveAppStatus(sub);

  const trialStart = (sub as any).trial_start as number | null | undefined;
  const trialEnd = (sub as any).trial_end as number | null | undefined;
  const currentPeriodEnd = (sub as any).current_period_end as
    | number
    | null
    | undefined;

  await prisma.userAccess.update({
    where: { userId: access.userId },
    data: {
      stripeSubscriptionId: sub.id,
      stripePriceId: priceId,
      subscriptionStatus,
      plan,

      trialStartedAt:
        plan === "free"
          ? null
          : trialStart
          ? new Date(trialStart * 1000)
          : null,

      trialEndsAt:
        plan === "free"
          ? null
          : trialEnd
          ? new Date(trialEnd * 1000)
          : null,

      currentPeriodEnd:
        plan === "free"
          ? null
          : currentPeriodEnd
          ? new Date(currentPeriodEnd * 1000)
          : null,
    },
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
    switch (event.type) {
      case "checkout.session.completed": {
        // Can occur before money moves (esp trials). Just sync.
        const session = event.data.object as Stripe.Checkout.Session;
        const customerId = session.customer as string | null;
        const subscriptionId = session.subscription as string | null;
        if (!customerId || !subscriptionId) break;

        const sub = await stripe.subscriptions.retrieve(subscriptionId, {
          expand: ["items.data.price"],
        });

        await upsertFromSubscription(customerId, sub);
        break;
      }

      case "customer.subscription.created":
      case "customer.subscription.updated": {
        const sub = event.data.object as Stripe.Subscription;
        const customerId = sub.customer as string | null;
        if (!customerId) break;

        const fullSub = await stripe.subscriptions.retrieve(sub.id, {
          expand: ["items.data.price"],
        });

        await upsertFromSubscription(customerId, fullSub);
        break;
      }

      case "customer.subscription.deleted": {
        const sub = event.data.object as Stripe.Subscription;
        const customerId = sub.customer as string | null;
        if (!customerId) break;

        const access = await findAccessByCustomer(customerId);
        if (!access) break;

        await prisma.userAccess.update({
          where: { userId: access.userId },
          data: {
            subscriptionStatus: "canceled",
            plan: "free",
            trialStartedAt: null,
            trialEndsAt: null,
            stripePriceId: null,
            stripeSubscriptionId: null,
            currentPeriodEnd: null,
            // IMPORTANT: do NOT touch hasUsedTrial here
          },
        });

        break;
      }

      case "invoice.payment_succeeded": {
        // ✅ Flip hasUsedTrial ONLY when payment succeeds
        const invoice = event.data.object as Stripe.Invoice;

        const customerId =
          typeof invoice.customer === "string"
            ? invoice.customer
            : invoice.customer?.id;

        // Typings issue with your Stripe apiVersion — cast to any.
        const subscriptionId = (invoice as any).subscription as string | null;

        // Only proceed for subscription invoices
        if (!customerId || !subscriptionId) break;

        const access = await findAccessByCustomer(customerId);
        if (!access) break;

        const sub = await stripe.subscriptions.retrieve(subscriptionId, {
          expand: ["items.data.price"],
        });

        const priceId = sub.items?.data?.[0]?.price?.id ?? null;
        const plan = effectiveAppPlan(sub, priceId);
        const subscriptionStatus = effectiveAppStatus(sub);

        await prisma.userAccess.update({
          where: { userId: access.userId },
          data: {
            hasUsedTrial: true, // ✅ burned forever after first successful pay
            plan,
            subscriptionStatus,
            stripeSubscriptionId: sub.id,
            stripePriceId: priceId,
          },
        });

        break;
      }

      case "invoice.payment_failed": {
        const invoice = event.data.object as Stripe.Invoice;

        const customerId =
          typeof invoice.customer === "string"
            ? invoice.customer
            : invoice.customer?.id;

        if (!customerId) break;

        await prisma.userAccess.updateMany({
          where: { stripeCustomerId: customerId },
          data: { subscriptionStatus: "past_due" },
        });

        break;
      }

      default:
        break;
    }

    return NextResponse.json({ received: true });
  } catch (err) {
    console.error("Webhook error:", err);
    return new NextResponse("Webhook failed", { status: 500 });
  }
}
