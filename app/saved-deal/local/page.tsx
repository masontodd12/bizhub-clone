"use client";

import React, { useEffect, useMemo, useState } from "react";
import Link from "next/link";

type ProjRow = {
  year: number;
  sde: number;
  debt: number;
  capex: number;
  tax: number;
  net: number;
  cumulative: number;
};

type SavedPayload = {
  createdAt: string;
  dealInput: any;
  computed: {
    sdeAdjusted: number | null;
    cfMultiple: number | null;
    revMultiple: number | null;
    margin: number | null;
    equity: number;
    loanAmt: number;
    monthlyPay: number;
    annualDebt: number;
    dscr: number | null;
    totalAcquisitionCost: number;
    upfrontCash: number;
    extraExpensesTotal?: number;
    projection?: {
      assumptions: { sdeGrowthPct: number; taxRatePct: number; capexAnnual: number };
      rows: ProjRow[];
      breakEvenYear: number | null;
      paybackYears: number | null;
    };
  };
  benchmark: any | null;
};

function money(n?: number | null) {
  if (n === undefined || n === null || !Number.isFinite(n)) return "—";
  return n.toLocaleString(undefined, { style: "currency", currency: "USD", maximumFractionDigits: 0 });
}
function num(n?: number | null, digits = 0) {
  if (n === undefined || n === null || !Number.isFinite(n)) return "—";
  return n.toLocaleString(undefined, { maximumFractionDigits: digits });
}
function pct(dec?: number | null, digits = 1) {
  if (dec === undefined || dec === null || !Number.isFinite(dec)) return "—";
  return `${(dec * 100).toFixed(digits)}%`;
}

function StatCard({
  title,
  value,
  sub,
  right,
}: {
  title: string;
  value: string;
  sub?: string;
  right?: string;
}) {
  return (
    <div className="rounded-2xl border border-black/10 bg-white p-4 shadow-sm">
      <div className="flex items-start justify-between gap-2">
        <div className="text-xs uppercase tracking-wide text-black/50">{title}</div>
        {right ? (
          <div className="rounded-lg border border-black/10 bg-[#F7F8F6] px-2 py-0.5 text-[11px] text-black/60">
            {right}
          </div>
        ) : null}
      </div>
      <div className="mt-1 text-lg font-extrabold tracking-tight text-[#111827]">{value}</div>
      {sub ? <div className="mt-1 text-xs text-black/50">{sub}</div> : null}
    </div>
  );
}

export default function SavedDealLocalPage() {
  const [payload, setPayload] = useState<SavedPayload | null>(null);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    try {
      const raw = localStorage.getItem("underwrite:lastSavedDeal");
      if (!raw) {
        setErr("No locally saved deal found.");
        return;
      }
      setPayload(JSON.parse(raw));
    } catch {
      setErr("Failed to read local saved deal.");
    }
  }, []);

  const created = useMemo(() => {
    if (!payload?.createdAt) return "—";
    try {
      return new Date(payload.createdAt).toLocaleString();
    } catch {
      return payload.createdAt;
    }
  }, [payload?.createdAt]);

  if (err) {
    return (
      <main className="min-h-screen bg-[#F7F8F6] text-[#111827]">
        <Header />
        <div className="mx-auto max-w-4xl px-6 py-10">
          <div className="rounded-2xl border border-black/10 bg-white p-6 shadow-sm">
            <div className="text-sm font-bold">Saved Deal</div>
            <div className="mt-2 text-sm text-black/70">{err}</div>
            <div className="mt-5 flex gap-2">
              <Link
                href="/deal-calculator"
                className="rounded-xl bg-[#2F5D50] px-4 py-2 text-sm font-bold text-white hover:bg-[#3F7668]"
              >
                Back to Calculator
              </Link>
              <Link
                href="/"
                className="rounded-xl border border-black/10 bg-white px-4 py-2 text-sm font-semibold hover:bg-black/[0.03]"
              >
                Home
              </Link>
            </div>
          </div>
        </div>
      </main>
    );
  }

  if (!payload) {
    return (
      <main className="min-h-screen bg-[#F7F8F6] text-[#111827]">
        <Header />
        <div className="mx-auto max-w-4xl px-6 py-10">
          <div className="rounded-2xl border border-black/10 bg-white p-6 shadow-sm">
            <div className="text-sm font-bold">Loading…</div>
          </div>
        </div>
      </main>
    );
  }

  const d = payload.dealInput ?? {};
  const c = payload.computed ?? ({} as any);
  const b = payload.benchmark ?? null;
  const proj = c.projection ?? null;

  return (
    <main className="min-h-screen bg-[#F7F8F6] text-[#111827]">
      <Header />

      <section className="mx-auto max-w-7xl px-6 py-8">
        <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
          <div>
            <div className="text-xs uppercase tracking-wide text-black/45">Saved deal</div>
            <h1 className="mt-1 text-2xl font-extrabold tracking-tight">Deal Summary</h1>
            <div className="mt-2 text-sm text-black/55">
              Saved: <span className="font-semibold text-[#111827]">{created}</span>
              {" • "}
              Industry: <span className="font-semibold text-[#111827]">{d.industry || "—"}</span>
              {" • "}
              Year: <span className="font-semibold text-[#111827]">{d.year ?? "—"}</span>
            </div>
            {d.listingUrl ? (
              <a className="mt-2 inline-block text-sm text-[#2F5D50] hover:opacity-80" href={d.listingUrl} target="_blank">
                View listing →
              </a>
            ) : null}
          </div>

          <div className="flex flex-wrap gap-2">
            <Link
              href="/deal-calculator"
              className="rounded-xl bg-[#2F5D50] px-4 py-2 text-sm font-bold text-white hover:bg-[#3F7668]"
            >
              New Deal
            </Link>
            <button
              onClick={() => {
                localStorage.removeItem("underwrite:lastSavedDeal");
                location.reload();
              }}
              className="rounded-xl border border-black/10 bg-white px-4 py-2 text-sm font-semibold hover:bg-black/[0.03]"
            >
              Clear Local Save
            </button>
          </div>
        </div>

        <div className="mt-6 grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          <StatCard title="Asking Price" value={money(d.askingPrice)} sub={b?.median_asking_price ? `Bench: ${money(b.median_asking_price)}` : "Bench: —"} />
          <StatCard title="Revenue" value={money(d.revenue)} sub={b?.median_revenue ? `Bench: ${money(b.median_revenue)}` : "Bench: —"} />
          <StatCard title="SDE (Adjusted)" value={money(c.sdeAdjusted)} sub={b?.median_sde ? `Bench: ${money(b.median_sde)}` : "Bench: —"} />

          <StatCard title="Cash Flow Multiple" value={c.cfMultiple == null ? "—" : `${num(c.cfMultiple, 2)}x`} sub={b?.price_to_sde_multiple ? `Bench: ${num(b.price_to_sde_multiple, 2)}x` : "Bench: —"} />
          <StatCard title="Revenue Multiple" value={c.revMultiple == null ? "—" : `${num(c.revMultiple, 2)}x`} sub={b?.price_to_revenue_multiple ? `Bench: ${num(b.price_to_revenue_multiple, 2)}x` : "Bench: —"} />
          <StatCard title="Profit Margin" value={c.margin == null ? "—" : pct(c.margin, 1)} sub={b?.cashflow_margin_pct ? `Bench: ${pct(b.cashflow_margin_pct, 1)}` : "Bench: —"} />

          <StatCard title="Upfront Cash" value={money(c.upfrontCash)} sub={`Equity: ${money(c.equity)}`} />
          <StatCard title="Loan Amount" value={money(c.loanAmt)} sub={b?.median_sba_loan ? `Bench SBA: ${money(b.median_sba_loan)}` : "Bench SBA: —"} />
          <StatCard title="DSCR" value={c.dscr == null ? "—" : num(c.dscr, 2)} right={c.dscr == null ? "" : c.dscr >= 1.25 ? "Healthy" : c.dscr >= 1.15 ? "Borderline" : "Risk"} />
        </div>

        {/* Projection */}
        <div className="mt-6 rounded-2xl border border-black/10 bg-white p-6 shadow-sm">
          <div className="flex flex-wrap items-end justify-between gap-2">
            <div>
              <div className="text-sm font-bold">5-Year Projection</div>
              <div className="mt-1 text-xs text-black/50">
                Assumptions: Growth {proj?.assumptions?.sdeGrowthPct ?? d.projSdeGrowthPct ?? "—"}% • Tax{" "}
                {proj?.assumptions?.taxRatePct ?? d.projTaxRatePct ?? "—"}% • Capex{" "}
                {money(proj?.assumptions?.capexAnnual ?? d.projCapexAnnual ?? null)}
              </div>
            </div>

            <div className="text-xs text-black/50">
              Break-even:{" "}
              <span className="font-semibold text-[#111827]">
                {proj?.breakEvenYear ? `Year ${proj.breakEvenYear}` : "—"}
              </span>
              {" • "}
              Payback:{" "}
              <span className="font-semibold text-[#111827]">
                {proj?.paybackYears ? `${num(proj.paybackYears, 1)} yrs` : "—"}
              </span>
            </div>
          </div>

          {!proj?.rows?.length ? (
            <div className="mt-4 text-sm text-black/60">
              No projection rows found in the saved payload.
            </div>
          ) : (
            <div className="mt-4 overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="text-black/50">
                  <tr>
                    <th className="py-2 text-left">Year</th>
                    <th className="py-2 text-right">SDE</th>
                    <th className="py-2 text-right">Debt</th>
                    <th className="py-2 text-right">Capex</th>
                    <th className="py-2 text-right">Tax</th>
                    <th className="py-2 text-right">Net</th>
                    <th className="py-2 text-right">Cumulative</th>
                  </tr>
                </thead>
                <tbody>
                  {proj.rows.map((r) => (
                    <tr key={r.year} className="border-t border-black/10">
                      <td className="py-2">Year {r.year}</td>
                      <td className="py-2 text-right">{money(r.sde)}</td>
                      <td className="py-2 text-right">{money(r.debt)}</td>
                      <td className="py-2 text-right">{money(r.capex)}</td>
                      <td className="py-2 text-right">{money(r.tax)}</td>
                      <td className="py-2 text-right font-semibold">{money(r.net)}</td>
                      <td className="py-2 text-right">{money(r.cumulative)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Raw JSON */}
        <details className="mt-6 rounded-2xl border border-black/10 bg-white p-6 shadow-sm">
          <summary className="cursor-pointer text-sm font-bold">Raw saved payload</summary>
          <pre className="mt-4 overflow-x-auto rounded-xl border border-black/10 bg-[#F7F8F6] p-4 text-xs text-black/70">
{JSON.stringify(payload, null, 2)}
          </pre>
        </details>
      </section>
    </main>
  );
}

function Header() {
  return (
    <header className="sticky top-0 z-10 border-b border-black/10 bg-white/80 backdrop-blur">
      <div className="mx-auto flex h-14 max-w-7xl items-center justify-between px-6">
        <Link href="/" className="text-sm font-bold tracking-tight text-[#111827]">
          Underwrite
        </Link>
        <div className="flex items-center gap-2">
          <Link
            href="/data"
            className="rounded-full border border-black/10 bg-white px-4 py-1.5 text-xs font-semibold hover:bg-black/[0.03] transition"
          >
            Data
          </Link>
          <Link
            href="/deal-calculator"
            className="rounded-full border border-black/10 bg-white px-4 py-1.5 text-xs font-semibold hover:bg-black/[0.03] transition"
          >
            Deal Calculator
          </Link>
        </div>
      </div>
    </header>
  );
}
