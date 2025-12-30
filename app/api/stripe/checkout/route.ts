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

function getBaseUrl(req: Request) {
  // ✅ Best practice: set this in Vercel + .env.local
  // PROD: https://underwritehq.com
  // DEV:  http://localhost:3001
  const envUrl =
    process.env.NEXT_PUBLIC_APP_URL ||
    process.env.APP_URL ||
    process.env.VERCEL_PROJECT_PRODUCTION_URL;

  if (envUrl) {
    // ensure protocol
    return envUrl.startsWith("http") ? envUrl : `https://${envUrl}`;
  }

  // ✅ Fallback: derive from request host (works in Vercel + local)
  const host = req.headers.get("host");
  const proto = req.headers.get("x-forwarded-proto") || "http";
  if (!host) throw new Error("Missing host header to build base URL");
  return `${proto}://${host}`;
}

export async function GET(req: Request) {
  const url = new URL(req.url);

  const { userId } = await auth();
  if (!userId) {
    return NextResponse.redirect(new URL(`/login?redirect_url=/pricing`, url.origin));
  }

  const planParam = url.searchParams.get("plan");
  if (planParam !== "pro" && planParam !== "pro_plus") {
    return NextResponse.redirect(new URL("/pricing", url.origin));
  }

  const plan = planParam as "pro" | "pro_plus";
  const priceId = getPriceId(plan);

  const baseUrl = getBaseUrl(req);

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

    // ✅ IMPORTANT: match the route you actually created:
    // you created: app/account/billing/success/page.tsx  => /account/billing/success
    success_url: `${baseUrl}/account/billing/success?session_id={CHECKOUT_SESSION_ID}`,
    cancel_url: `${baseUrl}/pricing`,
  });

  return NextResponse.redirect(session.url!, { status: 303 });
}
