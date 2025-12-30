// app/api/stripe/portal/route.ts

import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import Stripe from "stripe";
import { prisma } from "@/src/lib/prisma";

export const runtime = "nodejs";

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!);

export async function POST() {
  const { userId } = await auth();
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const ua = await prisma.userAccess.findUnique({ where: { userId } });
  if (!ua) {
    return NextResponse.json({ error: "UserAccess missing" }, { status: 400 });
  }

  // Ensure we have a Stripe Customer ID
  let customerId = ua.stripeCustomerId ?? null;

  if (!customerId) {
    let customer: Stripe.Customer | null = null;

    // Try to find existing customer by email to avoid duplicates
    if (ua.email) {
      const existing = await stripe.customers.list({ email: ua.email, limit: 1 });
      customer = (existing.data[0] as Stripe.Customer) ?? null;
    }

    if (!customer) {
      customer = await stripe.customers.create({
        email: ua.email ?? undefined,
        metadata: { userId },
      });
    }

    customerId = customer.id;

    await prisma.userAccess.update({
      where: { userId },
      data: { stripeCustomerId: customerId },
    });
  }

  const appUrl = process.env.APP_URL || "https://underwritehq.com";

  const session = await stripe.billingPortal.sessions.create({
    customer: customerId,
    return_url: `${appUrl}/account`,
  });

  return NextResponse.json({ url: session.url });
}
