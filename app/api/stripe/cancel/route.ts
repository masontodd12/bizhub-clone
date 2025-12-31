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
    },
  });

  let attemptedSubId: string | null = access?.stripeSubscriptionId ?? null;
  let cancelled = false;
  let stripeError: string | null = null;

  // --- STRIPE (best effort, never block DB downgrade) ---
  try {
    // If we don't trust stored subId, try to find an active-like sub by customer
    if (access?.stripeCustomerId) {
      // If stored subId exists, try cancel it first
      if (attemptedSubId) {
        try {
          await stripe.subscriptions.cancel(attemptedSubId);
          cancelled = true;
        } catch (e: any) {
          stripeError = e?.message ?? "Stripe cancel failed for stored subId";
          // fall through to list subscriptions
        }
      }

      // If not cancelled yet, list and cancel the real active sub (if any)
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

  // --- ALWAYS DOWNGRADE DB (this is what your app reads) ---
  await prisma.userAccess.upsert({
    where: { userId },
    update: {
      plan: "free",
      stripeSubscriptionId: null,
      stripePriceId: null,
    },
    create: {
      userId,
      plan: "free",
      stripeCustomerId: access?.stripeCustomerId ?? null,
      stripeSubscriptionId: null,
      stripePriceId: null,
    },
  });

  // return ok even if Stripe couldn't cancel (because DB is now free)
  return NextResponse.json({
    ok: true,
    downgraded: true,
    cancelledInStripe: cancelled,
    attemptedSubId,
    stripeError,
    note:
      stripeError
        ? "DB downgraded to free, but Stripe cancellation did not complete. Check Stripe key mode (test vs live)."
        : "DB downgraded and Stripe cancelled.",
  });
}
