"use client";

import React from "react";
import { ListChecks, Landmark, TrendingUp } from "lucide-react";

/* ============================================================
   Light theme Card (matches your Deal Calculator + CIM Analyzer)
============================================================ */

function Card({
  children,
  className = "",
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div
      className={[
        "rounded-2xl border border-black/10 bg-white shadow-sm",
        className,
      ].join(" ")}
    >
      {children}
    </div>
  );
}

export default function AboutPage() {
  const yearNow = new Date().getFullYear();

  return (
    <main className="min-h-screen bg-[#F7F8F6] text-[#111827]">
      {/* HERO (same vibe as Deal Calculator) */}
      <section className="relative overflow-hidden">
        {/* base green */}
        <div className="absolute inset-0 bg-[#0F2F29]" />
        {/* soft gradients */}
        <div className="absolute inset-0 bg-[radial-gradient(900px_420px_at_15%_15%,rgba(255,255,255,0.14),transparent_60%),radial-gradient(900px_420px_at_85%_10%,rgba(110,231,183,0.12),transparent_55%),linear-gradient(to_bottom,rgba(0,0,0,0.20),rgba(0,0,0,0.30))]" />
        {/* bottom fade into page */}
        <div className="absolute -bottom-1 left-0 right-0 h-20 bg-gradient-to-b from-transparent to-[#F7F8F6]" />

        <div className="relative mx-auto max-w-7xl px-6 pt-10 pb-10">
          <div className="mx-auto max-w-3xl text-center">
            <p className="mx-auto inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/10 px-3 py-1 text-xs text-white/80 backdrop-blur">
              <span className="h-1.5 w-1.5 rounded-full bg-emerald-300/80" />
              Buyer-first underwriting
            </p>

            <h1 className="mt-4 text-4xl font-extrabold tracking-tight text-white md:text-5xl">
              About Us
            </h1>

            <p className="mx-auto mt-3 max-w-2xl text-sm text-white/70 md:text-base">
              Buyer-first tools, clean benchmarks, and practical underwriting—built
              for people actually doing deals.
            </p>

            <div className="mt-6 flex flex-wrap justify-center gap-3">
              <a
                href="/deal-calculator"
                className="rounded-2xl border border-white/15 bg-white/10 px-4 py-2 text-sm font-semibold text-white/90 backdrop-blur hover:bg-white/15"
              >
                Deal Calculator
              </a>
              <a
                href="/data"
                className="rounded-2xl bg-white px-4 py-2 text-sm font-bold text-[#0F2F29] shadow-sm hover:bg-white/90"
              >
                Explore Data
              </a>
            </div>
          </div>
        </div>
      </section>

      {/* BODY */}
      <section className="mx-auto w-full max-w-5xl px-6 py-12">
        {/* Mission Card */}
        <div className="flex justify-center">
          <Card className="w-full max-w-3xl p-7 md:p-9">
            <h2 className="text-xl font-semibold tracking-tight md:text-2xl">
              Our Mission
            </h2>

            <div className="mt-4 space-y-4 text-sm leading-6 text-black/70 md:text-base">
              <p>
                Our mission is simple: help business buyers make smarter
                decisions with data-backed tools, independent insights, and a
                clearer path to ownership.
              </p>

              <p>
                We believe buying a small business should be driven by
                intelligence and trust—not guesswork, hype, or vague comps.
              </p>

              <p>
                Through benchmark data, underwriting calculators, and practical
                deal analysis, we aim to level the playing field—from first-time
                buyers to experienced operators.
              </p>

              <p className="text-black/80">
                We’re independent, buyer-first, and committed to making the
                business buying process faster, clearer, and more transparent.
              </p>
            </div>
          </Card>
        </div>

        {/* Data Sources Section */}
        <div className="mt-14">
          <h3 className="text-center text-2xl font-semibold tracking-tight">
            Where Our Data Comes From
          </h3>
          <p className="mx-auto mt-2 max-w-2xl text-center text-sm text-black/60 md:text-base">
            We blend listing intelligence, lending data, and public datasets to
            create clear benchmarks and deal comparisons.
          </p>

          <div className="mt-8 grid gap-5 md:grid-cols-3">
            <Card className="p-6">
              <div className="flex items-start gap-4">
                <div className="rounded-xl border border-black/10 bg-[#F7F8F6] p-3">
                  <ListChecks className="h-6 w-6 text-[#2F5D50]" />
                </div>
                <div>
                  <h4 className="text-base font-semibold">Business Listings</h4>
                  <p className="mt-2 text-sm leading-6 text-black/65">
                    Aggregated listing comps and transaction-style signals used
                    to estimate pricing ranges, multiples, and market behavior.
                  </p>
                </div>
              </div>
            </Card>

            <Card className="p-6">
              <div className="flex items-start gap-4">
                <div className="rounded-xl border border-black/10 bg-[#F7F8F6] p-3">
                  <TrendingUp className="h-6 w-6 text-[#2F5D50]" />
                </div>
                <div>
                  <h4 className="text-base font-semibold">SBA Loan Data</h4>
                  <p className="mt-2 text-sm leading-6 text-black/65">
                    Lending benchmarks like terms, rates, and underwriting
                    realities—helping model conservative DSCR and cash needs.
                  </p>
                </div>
              </div>
            </Card>

            <Card className="p-6">
              <div className="flex items-start gap-4">
                <div className="rounded-xl border border-black/10 bg-[#F7F8F6] p-3">
                  <Landmark className="h-6 w-6 text-[#2F5D50]" />
                </div>
                <div>
                  <h4 className="text-base font-semibold">Public Databases</h4>
                  <p className="mt-2 text-sm leading-6 text-black/65">
                    Government and public datasets that ground industry size,
                    employment, and economic context for better comparisons.
                  </p>
                </div>
              </div>
            </Card>
          </div>
        </div>

        {/* Footer note */}
        <div className="mt-14 text-center text-xs text-black/45">
          © {yearNow} Underwrite HQ • Built for buyers. Designed to stay simple.
        </div>
      </section>
    </main>
  );
}
