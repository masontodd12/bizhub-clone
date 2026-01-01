// app/pricing/page.tsx
"use client";

import Link from "next/link";
import { useUser } from "@clerk/nextjs";

function moneyFromEnv(v: string | undefined, fallback: number) {
  const n = Number(v);
  return Number.isFinite(n) ? n : fallback;
}

export default function PricingPage() {
  const { isLoaded, isSignedIn } = useUser();

  // ✅ UI display prices (billing still handled by Stripe price IDs on server)
  const proPrice = moneyFromEnv(
    process.env.NEXT_PUBLIC_PRICE_PRO_MONTHLY,
    9.99
  );

  const proPlusPrice = moneyFromEnv(
    process.env.NEXT_PUBLIC_PRICE_PRO_PLUS_MONTHLY,
    14.99
  );

  const proCheckoutPath = "/api/stripe/checkout?plan=pro";
  const proPlusCheckoutPath = "/api/stripe/checkout?plan=pro_plus";

  // ✅ URL-encode redirect_url (important)
  const proSignupHref = `/signup?redirect_url=${encodeURIComponent(
    proCheckoutPath
  )}`;
  const proPlusSignupHref = `/signup?redirect_url=${encodeURIComponent(
    proPlusCheckoutPath
  )}`;

  const proHref = !isLoaded
    ? "/pricing"
    : isSignedIn
    ? proCheckoutPath
    : proSignupHref;

  const proPlusHref = !isLoaded
    ? "/pricing"
    : isSignedIn
    ? proPlusCheckoutPath
    : proPlusSignupHref;

  const ctaText = !isLoaded
    ? "Loading…"
    : isSignedIn
    ? "Start"
    : "Create account to start";

  return (
    <main className="min-h-screen bg-[#F7F8F6] text-[#111827] px-6 py-12">
      <div className="mx-auto max-w-4xl">
        {/* Header */}
        <h1 className="text-3xl font-extrabold tracking-tight">Pricing</h1>
        <p className="mt-2 max-w-2xl text-black/60">
          Professional underwriting tools for buyers and investors. Choose a
          plan based on how fast you analyze deals.
        </p>

        {/* Pricing Cards */}
        <div className="mt-10 grid gap-6 md:grid-cols-2">
          {/* Pro */}
          <Link
            href={proHref}
            className="rounded-2xl border border-black/10 bg-white p-6 shadow-sm transition hover:bg-black/[0.02]"
          >
            <div className="text-sm font-semibold uppercase tracking-wide text-black/60">
              Pro
            </div>

            <div className="mt-2 flex items-end gap-1">
              <span className="text-3xl font-extrabold">
                ${proPrice.toFixed(2)}
              </span>
              <span className="text-sm text-black/60">/ month</span>
            </div>

            <div className="mt-2 text-sm font-medium text-black/70">
              3 deal analyses per day
            </div>

            <ul className="mt-5 space-y-2 text-sm text-black/70">
              <li>• Full Deal Calculator</li>
              <li>• Advanced metrics (DSCR, IRR, cash-on-cash)</li>
              <li>• CIM Analyzer (3 per day)</li>
              <li>• AI deal insights &amp; risk flags</li>
              <li>• Unlimited saved deals</li>
              <li>• PDF exports</li>
            </ul>

            <div className="mt-6 inline-flex rounded-xl bg-[#2F5D50] px-5 py-2.5 text-sm font-bold text-white">
              {ctaText} Pro
            </div>

            {!isSignedIn && isLoaded ? (
              <div className="mt-3 text-xs text-black/50">
                Create an account and you’ll be taken straight to checkout.
              </div>
            ) : null}
          </Link>

          {/* Pro Plus */}
          <Link
            href={proPlusHref}
            className="relative rounded-2xl border border-black/10 bg-white p-6 shadow-sm transition hover:bg-black/[0.02]"
          >
            <div className="absolute right-4 top-4 rounded-full bg-black px-3 py-1 text-xs font-semibold text-white">
              Most Popular
            </div>

            <div className="text-sm font-semibold uppercase tracking-wide text-black/60">
              Pro Plus
            </div>

            <div className="mt-2 flex items-end gap-1">
              <span className="text-3xl font-extrabold">
                ${proPlusPrice.toFixed(2)}
              </span>
              <span className="text-sm text-black/60">/ month</span>
            </div>

            <div className="mt-2 text-sm font-medium text-black/70">
              Unlimited deal analysis · 10 CIMs per day
            </div>

            <ul className="mt-5 space-y-2 text-sm text-black/70">
              <li>• Unlimited deal analyses</li>
              <li>• CIM Analyzer (10 per day)</li>
              <li>• Full 5-year projections</li>
              <li>• Scenario modeling (base / downside / upside)</li>
              <li>• Capital stack &amp; ownership modeling</li>
              <li>• Priority access to new tools</li>
            </ul>

            <div className="mt-6 inline-flex rounded-xl bg-[#2F5D50] px-5 py-2.5 text-sm font-bold text-white">
              {ctaText} Pro Plus
            </div>

            {!isSignedIn && isLoaded ? (
              <div className="mt-3 text-xs text-black/50">
                Create an account and you’ll be taken straight to checkout.
              </div>
            ) : null}
          </Link>
        </div>

        <p className="mt-8 text-sm text-black/50">
          One deal = one full analysis. Pro includes 3 analyses per day. Pro Plus
          includes unlimited deal analysis and up to 10 CIM analyses per day.
          Limits reset daily at midnight.
        </p>
      </div>
    </main>
  );
}
