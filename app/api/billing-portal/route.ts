import { NextResponse } from "next/server";
import Stripe from "stripe";
import { auth } from "@clerk/nextjs/server";
import { prisma } from "@/src/lib/prisma";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!);

async function createPortalUrl(userId: string) {
  const access = await prisma.userAccess.findUnique({ where: { userId } });

  if (!access?.stripeCustomerId) {
    return { ok: false as const, error: "NO_SUBSCRIPTION", redirectTo: "/pricing" };
  }

  const appUrl = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";

  const portal = await stripe.billingPortal.sessions.create({
    customer: access.stripeCustomerId,
    return_url: `${appUrl}/billing`,
  });

  return { ok: true as const, url: portal.url };
}

export async function GET() {
  const { userId } = await auth();
  if (!userId) {
    return NextResponse.redirect(new URL("/login", process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000"));
  }

  const result = await createPortalUrl(userId);

  if (!result.ok) {
    const base = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";
    return NextResponse.redirect(new URL(result.redirectTo, base));
  }

  return NextResponse.redirect(result.url);
}

export async function POST() {
  const { userId } = await auth();
  if (!userId) {
    return NextResponse.json({ ok: false, error: "UNAUTHORIZED" }, { status: 401 });
  }

  const result = await createPortalUrl(userId);

  if (!result.ok) {
    return NextResponse.json(result, { status: 403 });
  }

  return NextResponse.json(result);
}
