import { NextResponse } from "next/server";
import Stripe from "stripe";
import { auth } from "@clerk/nextjs/server";
import { prisma } from "@/src/lib/prisma";

export const runtime = "nodejs";

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: "2025-12-15.clover",
});

function unwrap<T>(resp: any): T {
  return resp && typeof resp === "object" && "data" in resp
    ? (resp.data as T)
    : (resp as T);
}

function subscriptionHasTrial(sub: Stripe.Subscription) {
  const trialStart = (sub as any).trial_start as number | null | undefined;
  const trialEnd = (sub as any).trial_end as number | null | undefined;

  return (
    sub.status === "trialing" ||
    (trialStart != null && trialEnd != null && trialEnd > trialStart)
  );
}

export async function POST(req: Request) {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ ok: false, error: "Not authenticated" }, { status: 401 });
    }

    const body = await req.json().catch(() => null);
    const session_id = body?.session_id as string | undefined;
    if (!session_id) {
      return NextResponse.json({ ok: false, error: "Missing session_id" }, { status: 400 });
    }

    const sessionRaw = await stripe.checkout.sessions.retrieve(session_id);
    const session = unwrap<Stripe.Checkout.Session>(sessionRaw);

    if (!session.customer || !session.subscription) {
      return NextResponse.json(
        { ok: false, error: "Session missing customer or subscription" },
        { status: 400 }
      );
    }

    const customerId = session.customer as string;
    const subscriptionId = session.subscription as string;

    const subRaw = await stripe.subscriptions.retrieve(subscriptionId);
    const subscription = unwrap<Stripe.Subscription>(subRaw);

    const priceId = subscription.items.data[0]?.price?.id ?? null;
    const plan = priceId === process.env.STRIPE_PRICE_PRO_PLUS ? "pro_plus" : "pro";

    const currentPeriodEndSeconds = Number((subscription as any).current_period_end);
    const currentPeriodEnd = Number.isFinite(currentPeriodEndSeconds)
      ? new Date(currentPeriodEndSeconds * 1000)
      : null;

    const hasTrial = subscriptionHasTrial(subscription);
    const trialStart = Number((subscription as any).trial_start);
    const trialEnd = Number((subscription as any).trial_end);

    const trialStartedAt =
      hasTrial && Number.isFinite(trialStart) ? new Date(trialStart * 1000) : null;

    const trialEndsAt =
      hasTrial && Number.isFinite(trialEnd) ? new Date(trialEnd * 1000) : null;

    const existing = await prisma.userAccess.findFirst({ where: { userId } });

    const updated = existing
      ? await prisma.userAccess.update({
          where: { id: existing.id },
          data: {
            stripeCustomerId: customerId,
            stripeSubscriptionId: subscription.id,
            stripePriceId: priceId,
            subscriptionStatus: subscription.status as any,
            currentPeriodEnd,
            plan,

            // ✅ burn trial immediately if present
            hasUsedTrial: existing.hasUsedTrial ? true : hasTrial ? true : false,
            trialStartedAt,
            trialEndsAt,
          },
        })
      : await prisma.userAccess.create({
          data: {
            userId,
            stripeCustomerId: customerId,
            stripeSubscriptionId: subscription.id,
            stripePriceId: priceId,
            subscriptionStatus: subscription.status as any,
            currentPeriodEnd,
            plan,

            hasUsedTrial: hasTrial,
            trialStartedAt,
            trialEndsAt,
          },
        });

    return NextResponse.json({ ok: true, updated });
  } catch (err: any) {
    console.error("Stripe sync error:", err);
    return NextResponse.json({ ok: false, error: err?.message ?? "Unknown error" }, { status: 500 });
  }
}
