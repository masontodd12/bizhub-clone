import { NextResponse } from "next/server";
import Stripe from "stripe";
import { auth } from "@clerk/nextjs/server";
import { prisma } from "@/src/lib/prisma";

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: "2025-12-15.clover",
});

export async function GET(req: Request) {
  const { userId } = await auth();
  if (!userId) return NextResponse.redirect(new URL("/sign-in", req.url));

  const access = await prisma.userAccess.findUnique({ where: { userId } });
  if (!access?.stripeCustomerId) {
    return NextResponse.redirect(new URL("/pricing", req.url));
  }

  const portal = await stripe.billingPortal.sessions.create({
    customer: access.stripeCustomerId,
    return_url: `${process.env.NEXT_PUBLIC_APP_URL}/billing`,
  });

  return NextResponse.redirect(portal.url);
}
