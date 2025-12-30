// app/api/stripe/checkout/route.ts
import { NextResponse } from "next/server";
import Stripe from "stripe";
import { auth } from "@clerk/nextjs/server";
import { prisma } from "@/src/lib/prisma";

export const runtime = "nodejs";

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: "2025-12-15.clover",
});

function getPriceId(plan: "pro" | "pro_plus") {
  if (plan === "pro") return process.env.STRIPE_PRICE_PRO!;
  return process.env.STRIPE_PRICE_PRO_PLUS!;
}

export async function GET(req: Request) {
  const url = new URL(req.url);

  const { userId } = await auth();
  if (!userId) {
    // ✅ Your app uses /login (not /sign-in)
    // After login, Clerk will send them back to /pricing, and they can click again.
    return NextResponse.redirect(
      new URL(`/login?redirect_url=/pricing`, url.origin)
    );
  }

  const planParam = url.searchParams.get("plan");
  if (planParam !== "pro" && planParam !== "pro_plus") {
    return NextResponse.redirect(new URL("/pricing", url.origin));
  }
  const plan = planParam as "pro" | "pro_plus";
  const priceId = getPriceId(plan);

  const baseUrl =
    process.env.NEXT_PUBLIC_APP_URL ||
    (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : "");
  if (!baseUrl) throw new Error("Missing NEXT_PUBLIC_APP_URL / VERCEL_URL");

  // Ensure row exists
  const access = await prisma.userAccess.upsert({
    where: { userId },
    update: {},
    create: { userId },
  });

  let customerId = access.stripeCustomerId;

  if (!customerId) {
    const customer = await stripe.customers.create({
      metadata: { userId },
    });

    customerId = customer.id;

    await prisma.userAccess.update({
      where: { userId },
      data: { stripeCustomerId: customerId },
    });
  }

  const session = await stripe.checkout.sessions.create({
    mode: "subscription",
    customer: customerId,
    line_items: [{ price: priceId, quantity: 1 }],
    payment_method_collection: "always",

    subscription_data: {
      metadata: { userId },
      ...(access.hasUsedTrial ? {} : { trial_period_days: 3 }),
    },

    metadata: { userId },

    success_url: `${baseUrl}/billing/success`,
    cancel_url: `${baseUrl}/pricing`,
  });

  return NextResponse.redirect(session.url!, { status: 303 });
}
