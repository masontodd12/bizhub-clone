
"use client";

import React, { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { useUser } from "@clerk/nextjs";

/* ============================================================
   Types
============================================================ */

type IndustryRow = {
  industry: string;
  median_asking_price?: number;
  median_sold_price?: number;
  median_sde?: number;
  price_to_sde_multiple?: number;
  median_revenue?: number;
  price_to_revenue_multiple?: number;
  cashflow_margin_pct?: number; // decimal (0.12 = 12%)
  listings_count?: number;
  days_on_market?: number;
  median_sba_loan?: number;
  sba_default_rate_pct?: number; // decimal (0.01 = 1%)
};

type Expense = { label: string; amount: number };

type DealInput = {
  year: number;
  listingUrl: string;
  industry: string;

  askingPrice: number | null;
  revenue: number | null;
  sde: number | null;

  financingMode: "SBA" | "Custom";
  loanTermYears: number;
  interestRatePct: number;

  closingCosts: number;
  includeClosingInLoan: boolean;

  downPaymentPct: number;
  extraExpenses: Expense[];

  // 5-year projection assumptions
  projSdeGrowthPct: number; // ex: 3
  projTaxRatePct: number; // ex: 30
  projCapexAnnual: number; // ex: 10000
};

type ProjRow = {
  year: number;
  sde: number;
  debt: number;
  capex: number;
  tax: number;
  net: number;
  cumulative: number;
};

type ProjectionResponse = {
  ok: boolean;
  rows: ProjRow[];
  breakEvenYear: number | null;
  paybackYears: number | null;
  error?: string;
  code?: string; // e.g. "DAILY_LIMIT"
};

// ✅ Usage response for disabling Analyze BEFORE clicking
type UsageResp = {
  enabled: boolean;
  dailyLimit: number | null; // null => unlimited (Pro+ maybe)
  countToday: number;
  remaining: number | null; // null => unlimited
};

const YEARS = [2024, 2023, 2022, 2021, 2020, 2019, 2018] as const;

/* ============================================================
   Utils
============================================================ */

function parseNumber(v?: string) {
  if (!v) return undefined;
  const cleaned = v.replace(/[$,%\s]/g, "").trim();
  if (cleaned === "" || cleaned === "-" || cleaned === "—") return undefined;
  const n = Number(cleaned);
  return Number.isFinite(n) ? n : undefined;
}

function splitCSVLine(line: string): string[] {
  const out: string[] = [];
  let cur = "";
  let inQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const ch = line[i];

    if (ch === '"') {
      if (inQuotes && line[i + 1] === '"') {
        cur += '"';
        i++;
      } else {
        inQuotes = !inQuotes;
      }
      continue;
    }

    if (ch === "," && !inQuotes) {
      out.push(cur);
      cur = "";
      continue;
    }

    cur += ch;
  }
  out.push(cur);
  return out;
}

function parseCSV(text: string): IndustryRow[] {
  const lines = text.trim().split(/\r?\n/);
  if (lines.length < 2) return [];

  const headers = splitCSVLine(lines[0]).map((h) => h.trim());
  const idx = (name: string) => headers.indexOf(name);

  return lines.slice(1).map((line) => {
    const c = splitCSVLine(line);

    return {
      industry: (c[idx("industry")] ?? "").replace(/^"|"$/g, ""),
      median_asking_price: parseNumber(c[idx("median_asking_price")]),
      median_sold_price: parseNumber(c[idx("median_sold_price")]),
      median_sde: parseNumber(c[idx("median_sde")]),
      price_to_sde_multiple: parseNumber(c[idx("price_to_sde_multiple")]),
      median_revenue: parseNumber(c[idx("median_revenue")]),
      price_to_revenue_multiple: parseNumber(c[idx("price_to_revenue_multiple")]),
      cashflow_margin_pct: parseNumber(c[idx("cashflow_margin_pct")]),
      listings_count: parseNumber(c[idx("listings_count")]),
      days_on_market: parseNumber(c[idx("days_on_market")]),
      median_sba_loan: parseNumber(c[idx("median_sba_loan")]),
      sba_default_rate_pct: parseNumber(c[idx("sba_default_rate_pct")]),
    };
  });
}

function money(n?: number | null) {
  if (n === undefined || n === null || !Number.isFinite(n)) return "—";
  return n.toLocaleString(undefined, {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  });
}
function num(n?: number | null, digits = 0) {
  if (n === undefined || n === null || !Number.isFinite(n)) return "—";
  return n.toLocaleString(undefined, { maximumFractionDigits: digits });
}
function pct(dec?: number | null, digits = 1) {
  if (dec === undefined || dec === null || !Number.isFinite(dec)) return "—";
  return `${(dec * 100).toFixed(digits)}%`;
}
function pctFromPct(p?: number | null, digits = 1) {
  if (p === undefined || p === null || !Number.isFinite(p)) return "—";
  return `${p.toFixed(digits)}%`;
}

function safeDiv(a?: number | null, b?: number | null) {
  if (a === null || b === null || a === undefined || b === undefined) return null;
  if (!Number.isFinite(a) || !Number.isFinite(b) || b === 0) return null;
  return a / b;
}

function monthlyPayment(principal: number, annualRatePct: number, termYears: number) {
  const r = annualRatePct / 100 / 12;
  const n = termYears * 12;
  if (principal <= 0 || n <= 0) return 0;
  if (r === 0) return principal / n;
  return principal * (r / (1 - Math.pow(1 + r, -n)));
}

/* ============================================================
   UI
============================================================ */

function Card({
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
    <div className="rounded-2xl border border-black/10 bg-white p-4 shadow-sm hover:bg-black/[0.01] transition">
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

function Label({ children }: { children: React.ReactNode }) {
  return <div className="text-xs font-semibold text-black/70">{children}</div>;
}

function TextInput({
  value,
  onChange,
  placeholder,
}: {
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
}) {
  return (
    <input
      value={value}
      onChange={(e) => onChange(e.target.value)}
      placeholder={placeholder}
      className="w-full rounded-xl border border-black/10 bg-white px-3 py-2 text-sm text-[#111827] outline-none placeholder:text-black/35 hover:bg-black/[0.02] focus:bg-black/[0.02] focus:ring-2 focus:ring-[#2F5D50]/15"
    />
  );
}

function NumberInput({
  value,
  onChange,
  placeholder,
  disabled,
}: {
  value: number | null;
  onChange: (n: number | null) => void;
  placeholder?: string;
  disabled?: boolean;
}) {
  return (
    <input
      value={value === null ? "" : String(value)}
      onChange={(e) => {
        const s = e.target.value;
        const cleaned = s.replace(/[,$\s]/g, "");
        if (cleaned === "") return onChange(null);
        const n = Number(cleaned);
        onChange(Number.isFinite(n) ? n : null);
      }}
      placeholder={placeholder}
      disabled={disabled}
      className={[
        "w-full rounded-xl border border-black/10 bg-white px-3 py-2 text-sm text-[#111827] outline-none placeholder:text-black/35 hover:bg-black/[0.02] focus:bg-black/[0.02] focus:ring-2 focus:ring-[#2F5D50]/15",
        disabled ? "opacity-60 cursor-not-allowed hover:bg-white" : "",
      ].join(" ")}
    />
  );
}

/* ============================================================
   Page
============================================================ */

export default function DealCalculatorClient() {
  const router = useRouter();
  const { user, isLoaded } = useUser();

  const yearNow = useMemo(() => new Date().getFullYear(), []);

  const [benchRows, setBenchRows] = useState<IndustryRow[]>([]);
  const [loadingBench, setLoadingBench] = useState(false);
  const [benchError, setBenchError] = useState<string | null>(null);

  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  // entitlements
  const [canAnalyzeDeal, setCanAnalyzeDeal] = useState(false); // Pro OR Pro+
  const [canUse5YearProjection, setCanUse5YearProjection] = useState(false); // Pro+ only
  const [accessLoaded, setAccessLoaded] = useState(false);

  // usage (disable analyze when at limit)
  const [usage, setUsage] = useState<UsageResp | null>(null);
  const [usageLoading, setUsageLoading] = useState(false);

  async function refreshUsage() {
    setUsageLoading(true);
    try {
      const r = await fetch("/api/me/usage", { cache: "no-store" });
      const data = (await r.json()) as UsageResp;
      setUsage(data);
    } catch {
      setUsage(null);
    } finally {
      setUsageLoading(false);
    }
  }

  const [projLoading, setProjLoading] = useState(false);
  const [projError, setProjError] = useState<string | null>(null);
  const [projLocked, setProjLocked] = useState(false);
  const [limitHit, setLimitHit] = useState(false);
  const [projData, setProjData] = useState<{
    rows: ProjRow[];
    breakEvenYear: number | null;
    paybackYears: number | null;
    analyzedAt: string;
  } | null>(null);

  useEffect(() => {
    fetch("/api/me/access")
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        setCanAnalyzeDeal(!!data?.entitlements?.canAnalyzeDeal);
        setCanUse5YearProjection(!!data?.entitlements?.canUse5YearProjection);
      })
      .catch(() => {
        setCanAnalyzeDeal(false);
        setCanUse5YearProjection(false);
      })
      .finally(() => setAccessLoaded(true));
  }, []);

  useEffect(() => {
    refreshUsage();
  }, []);

  const [deal, setDeal] = useState<DealInput>({
    year: 2024,
    listingUrl: "",
    industry: "",

    askingPrice: null,
    revenue: null,
    sde: null,

    financingMode: "SBA",
    loanTermYears: 10,
    interestRatePct: 10.0,

    closingCosts: 0,
    includeClosingInLoan: true,

    downPaymentPct: 10,
    extraExpenses: [],

    projSdeGrowthPct: 3,
    projTaxRatePct: 30,
    projCapexAnnual: 0,
  });

  // load benchmarks
  useEffect(() => {
    setLoadingBench(true);
    setBenchError(null);

    fetch(`/data/industry_metrics_${deal.year}.csv`)
      .then((r) => {
        if (!r.ok) throw new Error(`Missing CSV: /data/industry_metrics_${deal.year}.csv`);
        return r.text();
      })
      .then((txt) => setBenchRows(parseCSV(txt)))
      .catch((e) => {
        console.error(e);
        setBenchRows([]);
        setBenchError(String(e?.message ?? "Failed to load benchmarks"));
      })
      .finally(() => setLoadingBench(false));
  }, [deal.year]);

  const industries = useMemo(() => {
    return benchRows
      .map((r) => r.industry)
      .filter(Boolean)
      .sort((a, b) => a.localeCompare(b));
  }, [benchRows]);

  const bench = useMemo(() => {
    if (!deal.industry) return null;
    return benchRows.find((r) => r.industry === deal.industry) ?? null;
  }, [benchRows, deal.industry]);

  const results = useMemo(() => {
    const asking = deal.askingPrice;
    const revenue = deal.revenue;
    const sdeRaw = deal.sde;

    const extra = deal.extraExpenses.reduce(
      (sum, e) => sum + (Number.isFinite(e.amount) ? e.amount : 0),
      0
    );
    const sde = sdeRaw === null ? null : Math.max(0, sdeRaw - extra);

    const cfMultiple = safeDiv(asking, sde);
    const revMultiple = safeDiv(asking, revenue);
    const margin = safeDiv(sde, revenue);

    const closing = Number.isFinite(deal.closingCosts) ? deal.closingCosts : 0;
    const baseCost = (asking ?? 0) + (deal.includeClosingInLoan ? closing : 0);

    const equityPct = (deal.financingMode === "SBA" ? 10 : deal.downPaymentPct) / 100;
    const equity = baseCost * equityPct;
    const loanAmt = Math.max(0, baseCost - equity);

    const mPay = monthlyPayment(loanAmt, deal.interestRatePct, deal.loanTermYears);
    const annualDebt = mPay * 12;

    const dscr = sde === null ? null : safeDiv(sde, annualDebt);

    return {
      sdeAdjusted: sde,
      cfMultiple,
      revMultiple,
      margin,
      equity,
      loanAmt,
      monthlyPay: mPay,
      annualDebt,
      dscr,
      totalAcquisitionCost: baseCost,
      upfrontCash: deal.includeClosingInLoan ? equity : equity + closing,
      extraExpensesTotal: extra,
    };
  }, [deal]);

  const [lastAnalyzedSnapshot, setLastAnalyzedSnapshot] = useState<string | null>(null);
  const currentSnapshot = useMemo(() => {
    return JSON.stringify({
      sdeAdjusted: results.sdeAdjusted ?? 0,
      annualDebt: results.annualDebt ?? 0,
      upfrontCash: results.upfrontCash ?? 0,
      years: 5,
      sdeGrowthPct: deal.projSdeGrowthPct,
      capexAnnual: deal.projCapexAnnual,
      taxRatePct: deal.projTaxRatePct,
    });
  }, [
    results.sdeAdjusted,
    results.annualDebt,
    results.upfrontCash,
    deal.projSdeGrowthPct,
    deal.projCapexAnnual,
    deal.projTaxRatePct,
  ]);

  const isStale = useMemo(() => {
    if (!projData || !lastAnalyzedSnapshot) return false;
    return lastAnalyzedSnapshot !== currentSnapshot;
  }, [projData, lastAnalyzedSnapshot, currentSnapshot]);

  const isUnlimited = usage?.dailyLimit === null;
  const dailyLimit = usage?.dailyLimit ?? 3;
  const countToday = usage?.countToday ?? 0;
  const atLimit = !!usage?.enabled && !isUnlimited && countToday >= dailyLimit;

  // ✅ Analyze is allowed for Pro OR Pro+
  const canAnalyze = useMemo(() => {
    if (!accessLoaded) return false;
    if (!canAnalyzeDeal) return false;
    if (projLoading || usageLoading) return false;
    if (atLimit) return false;
    if (!deal.askingPrice || !deal.sde) return false;
    return true;
  }, [accessLoaded, canAnalyzeDeal, projLoading, usageLoading, atLimit, deal.askingPrice, deal.sde]);

  async function handleAnalyze() {
    if (!accessLoaded) return;

    setProjError(null);
    setLimitHit(false);

    if (!canAnalyzeDeal) {
      setProjLocked(true);
      setProjData(null);
      return;
    }

    if (atLimit) {
      setLimitHit(true);
      setProjError("Daily limit reached. Upgrade to Pro+ for unlimited analyzes.");
      return;
    }

    setProjLoading(true);
    setProjLocked(false);

    const body = {
      sdeYear1: results.sdeAdjusted ?? 0,
      annualDebt: results.annualDebt,
      upfrontCash: results.upfrontCash,
      years: 5,
      sdeGrowthPct: deal.projSdeGrowthPct,
      capexAnnual: deal.projCapexAnnual,
      taxRatePct: deal.projTaxRatePct,
    };

    try {
      const r = await fetch("/api/deal-calculator/analyze", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });

      if (r.status === 403) {
        setProjLocked(true);
        setProjData(null);
        await refreshUsage();
        return;
      }

      const data = (await r.json()) as ProjectionResponse;

      if (!r.ok) {
        if (data?.code === "DAILY_LIMIT" || r.status === 429) {
          setLimitHit(true);
          setProjData(null);
          setProjError("Daily limit reached. Upgrade to Pro+ for unlimited analyzes.");
          await refreshUsage();
          return;
        }
        throw new Error(data?.error ?? `Projection failed (${r.status})`);
      }

      setProjLocked(false);
      setProjData({
        rows: data.rows ?? [],
        breakEvenYear: data.breakEvenYear ?? null,
        paybackYears: data.paybackYears ?? null,
        analyzedAt: new Date().toISOString(),
      });

      setLastAnalyzedSnapshot(currentSnapshot);
      await refreshUsage();
    } catch (e: any) {
      setProjError(String(e?.message ?? "Projection failed"));
      setProjData(null);
      await refreshUsage();
    } finally {
      setProjLoading(false);
    }
  }

  // ===== SAVE DEAL =====
  async function handleSaveDeal() {
    setSaveError(null);

    if (!deal.industry) return setSaveError("Pick an industry before saving.");
    if (!deal.askingPrice || !deal.sde)
      return setSaveError("Add at least Asking Price + SDE before saving.");

    if (!isLoaded) return setSaveError("Loading your account… try again in a second.");
    if (!user?.id) return setSaveError("You must be logged in to save deals.");

    // ✅ Pro users can save, but we strip projection rows unless Pro+
    const projectionForSave =
      canUse5YearProjection && projData
        ? {
            assumptions: {
              sdeGrowthPct: deal.projSdeGrowthPct,
              taxRatePct: deal.projTaxRatePct,
              capexAnnual: deal.projCapexAnnual,
            },
            rows: projData.rows,
            breakEvenYear: projData.breakEvenYear,
            paybackYears: projData.paybackYears,
            analyzedAt: projData.analyzedAt,
          }
        : null;

    const payload = {
      createdAt: new Date().toISOString(),
      dealInput: deal,
      computed: {
        ...results,
        projection: projectionForSave,
      },
      benchmark: bench ?? null,
    };

    setSaving(true);

    try {
      const res = await fetch("/api/deals", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (res.ok) {
        await res.json();
        router.push("/account/deals");
        return;
      }

      throw new Error(`Save failed (${res.status}). Using local fallback.`);
    } catch (e) {
      console.warn(e);

      try {
        localStorage.setItem(
          `underwrite:lastSavedDeal:${user?.id ?? "anon"}`,
          JSON.stringify(payload)
        );
        router.push("/account/deals");
        return;
      } catch {
        setSaveError("Could not save deal. Check console + localStorage permissions.");
      }
    } finally {
      setSaving(false);
    }
  }

  // ✅ Year 1 net is shown to Pro AND Pro+ (after analyze)
  const year1Net = projData?.rows?.[0]?.net ?? null;

  return (
    <main className="min-h-screen bg-[#F7F8F6] text-[#111827]">
      {/* HERO */}
      <section className="relative overflow-hidden">
        <div className="absolute inset-0 bg-[#0F2F29]" />
        <div className="absolute inset-0 bg-[radial-gradient(900px_420px_at_15%_15%,rgba(255,255,255,0.14),transparent_60%),radial-gradient(900px_420px_at_85%_10%,rgba(110,231,183,0.12),transparent_55%),linear-gradient(to_bottom,rgba(0,0,0,0.20),rgba(0,0,0,0.30))]" />
        <div className="absolute -bottom-1 left-0 right-0 h-20 bg-gradient-to-b from-transparent to-[#F7F8F6]" />

        <div className="relative mx-auto max-w-7xl px-6 pt-10 pb-8">
          <div className="flex flex-col gap-5 md:flex-row md:items-end md:justify-between">
            <div className="max-w-2xl">
              <div className="inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/10 px-3 py-1 text-xs text-white/80 backdrop-blur">
                <span className="h-1.5 w-1.5 rounded-full bg-emerald-300/80" />
                Screen a deal in minutes
              </div>

              <h1 className="mt-4 text-4xl font-extrabold tracking-tight text-white md:text-5xl">
                Deal Calculator
              </h1>

              <p className="mt-3 text-sm text-white/70">
                Enter deal terms and compare against industry benchmarks for{" "}
                <span className="font-semibold text-white">{deal.year}</span>.
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-3">
              <div className="rounded-2xl border border-white/15 bg-white/10 px-3 py-2 text-xs text-white/80 backdrop-blur">
                {loadingBench ? "Loading benchmarks…" : benchRows.length ? "Benchmarks loaded" : "No benchmarks"}
              </div>

              <div className="rounded-2xl border border-white/15 bg-white/10 px-3 py-2 backdrop-blur">
                <select
                  value={deal.year}
                  onChange={(e) =>
                    setDeal((d) => ({
                      ...d,
                      year: Number(e.target.value),
                      industry: "",
                    }))
                  }
                  className="bg-transparent text-sm font-semibold text-white outline-none"
                >
                  {YEARS.map((y) => (
                    <option key={y} value={y} className="text-[#111827]">
                      Year: {y}
                    </option>
                  ))}
                </select>
              </div>

              {/* Analyze button */}
              <div className="flex flex-col">
                <button
                  onClick={handleAnalyze}
                  disabled={!canAnalyze}
                  className="rounded-2xl bg-[#2F5D50] px-4 py-2 text-sm font-bold text-white shadow-sm hover:bg-[#3F7668] disabled:opacity-60 disabled:hover:bg-[#2F5D50]"
                  title={
                    !accessLoaded
                      ? "Checking access…"
                      : !canAnalyzeDeal
                      ? "Pro / Pro+ only"
                      : usageLoading
                      ? "Loading usage…"
                      : atLimit
                      ? "Daily limit reached"
                      : !deal.askingPrice || !deal.sde
                      ? "Enter at least Asking Price + SDE"
                      : "Run server analysis"
                  }
                >
                  {projLoading ? "Analyzing…" : "Analyze"}
                </button>

                {/* usage */}
                {accessLoaded && canAnalyzeDeal ? (
                  <div className="mt-1 text-xs text-white/70">
                    {usageLoading ? (
                      "Loading usage…"
                    ) : isUnlimited ? (
                      "Unlimited analyzes"
                    ) : atLimit ? (
                      <span>
                        Limit reached ({countToday}/{dailyLimit}).{" "}
                        <a href="/pricing" className="font-semibold text-white underline">
                          Upgrade to Pro+
                        </a>
                      </span>
                    ) : (
                      <span>
                        Today: {countToday}/{dailyLimit}
                      </span>
                    )}
                  </div>
                ) : null}
              </div>

              <button
                onClick={handleSaveDeal}
                disabled={saving}
                className="rounded-2xl bg-white px-4 py-2 text-sm font-bold text-[#0F2F29] shadow-sm hover:bg-white/90 disabled:opacity-60"
              >
                {saving ? "Saving…" : "Save Deal"}
              </button>
            </div>
          </div>

          {/* top status */}
          <div className="mt-4 grid gap-3 md:grid-cols-2">
            {saveError ? (
              <div className="rounded-2xl border border-white/20 bg-white/10 px-4 py-3 text-sm text-white/80 backdrop-blur">
                <span className="font-semibold text-white">Save error:</span> {saveError}
              </div>
            ) : null}

            {projError ? (
              <div className="rounded-2xl border border-white/20 bg-white/10 px-4 py-3 text-sm text-white/80 backdrop-blur">
                <span className="font-semibold text-white">Analyze error:</span> {projError}
              </div>
            ) : projData ? (
              <div className="rounded-2xl border border-white/20 bg-white/10 px-4 py-3 text-sm text-white/80 backdrop-blur">
                <span className="font-semibold text-white">Analyzed:</span>{" "}
                {new Date(projData.analyzedAt).toLocaleString()}
                {isStale ? (
                  <span className="ml-2 rounded-full border border-white/15 bg-white/10 px-2 py-0.5 text-xs text-white/80">
                    Stale — press Analyze again
                  </span>
                ) : null}
              </div>
            ) : !accessLoaded ? (
              <div className="rounded-2xl border border-white/20 bg-white/10 px-4 py-3 text-sm text-white/70 backdrop-blur">
                Checking access…
              </div>
            ) : !canAnalyzeDeal ? (
              <div className="rounded-2xl border border-white/20 bg-white/10 px-4 py-3 text-sm text-white/70 backdrop-blur">
                Pro / Pro+ only — Analyze is locked.
              </div>
            ) : atLimit ? (
              <div className="rounded-2xl border border-white/20 bg-white/10 px-4 py-3 text-sm text-white/70 backdrop-blur">
                Daily limit reached —{" "}
                <a href="/pricing" className="font-semibold text-white underline">
                  Upgrade to Pro+
                </a>{" "}
                for unlimited.
              </div>
            ) : (
              <div className="rounded-2xl border border-white/20 bg-white/10 px-4 py-3 text-sm text-white/70 backdrop-blur">
                Press <span className="font-semibold text-white">Analyze</span> to run the server model.
              </div>
            )}
          </div>
        </div>
      </section>

      <div className="mx-auto max-w-7xl px-6 py-6">
        {benchError && (
          <div className="mb-5 rounded-2xl border border-black/10 bg-white p-4 text-sm text-black/70 shadow-sm">
            <div className="font-semibold text-[#111827]">Benchmark CSV Error</div>
            <div className="mt-1">{benchError}</div>
            <div className="mt-2 text-xs text-black/50">
              Put file here:{" "}
              <span className="font-semibold text-[#111827]">
                /public/data/industry_metrics_{deal.year}.csv
              </span>
            </div>
          </div>
        )}

        <div className="flex gap-5">
          {/* LEFT */}
          <aside className="w-[320px] shrink-0 rounded-2xl border border-black/10 bg-white p-4 shadow-sm">
            <div className="mb-3 flex items-center justify-between">
              <div>
                <div className="text-sm font-bold">Deal Inputs</div>
                <div className="text-xs text-black/50">Fill what you know.</div>
              </div>

              <button
                onClick={() => {
                  setDeal((d) => ({
                    ...d,
                    listingUrl: "",
                    industry: "",
                    askingPrice: null,
                    revenue: null,
                    sde: null,
                    closingCosts: 0,
                    includeClosingInLoan: true,
                    financingMode: "SBA",
                    loanTermYears: 10,
                    interestRatePct: 10,
                    downPaymentPct: 10,
                    extraExpenses: [],
                    projSdeGrowthPct: 3,
                    projTaxRatePct: 30,
                    projCapexAnnual: 0,
                  }));
                  setProjData(null);
                  setProjError(null);
                  setProjLocked(false);
                  setLimitHit(false);
                  setLastAnalyzedSnapshot(null);
                }}
                className="rounded-xl border border-black/10 bg-white px-3 py-1.5 text-xs font-semibold text-[#111827] hover:bg-black/[0.03]"
              >
                Clear
              </button>
            </div>

            <div className="space-y-3">
              <div className="space-y-1.5">
                <Label>BizBuySell Listing URL</Label>
                <TextInput
                  value={deal.listingUrl}
                  onChange={(v) => setDeal((d) => ({ ...d, listingUrl: v }))}
                  placeholder="Paste listing URL…"
                />
              </div>

              <div className="space-y-1.5">
                <Label>Industry</Label>
                <select
                  value={deal.industry}
                  onChange={(e) => setDeal((d) => ({ ...d, industry: e.target.value }))}
                  className="w-full rounded-xl border border-black/10 bg-white px-3 py-2 text-sm text-[#111827] outline-none hover:bg-black/[0.02] focus:ring-2 focus:ring-[#2F5D50]/15"
                >
                  <option value="">Select an industry…</option>
                  {industries.map((name) => (
                    <option key={name} value={name}>
                      {name}
                    </option>
                  ))}
                </select>

                {bench ? (
                  <div className="text-xs text-black/50">
                    Bench: {num(bench.listings_count)} sold • {num(bench.days_on_market)} days
                  </div>
                ) : (
                  <div className="text-xs text-black/50">Select an industry to unlock comparisons.</div>
                )}
              </div>

              <div className="space-y-1.5">
                <Label>Asking Price</Label>
                <NumberInput value={deal.askingPrice} onChange={(n) => setDeal((d) => ({ ...d, askingPrice: n }))} placeholder="e.g. 600000" />
              </div>

              <div className="space-y-1.5">
                <Label>SDE (Cash Flow)</Label>
                <NumberInput value={deal.sde} onChange={(n) => setDeal((d) => ({ ...d, sde: n }))} placeholder="e.g. 200000" />
                {results.extraExpensesTotal > 0 ? (
                  <div className="text-xs text-black/50">
                    Adjusted SDE subtracts extra expenses: {money(results.extraExpensesTotal)}
                  </div>
                ) : null}
              </div>

              <div className="space-y-1.5">
                <Label>Revenue</Label>
                <NumberInput value={deal.revenue} onChange={(n) => setDeal((d) => ({ ...d, revenue: n }))} placeholder="e.g. 900000" />
              </div>

              <div className="space-y-1.5">
                <Label>Financing Mode</Label>
                <div className="flex gap-2">
                  {(["SBA", "Custom"] as const).map((m) => (
                    <button
                      key={m}
                      onClick={() => setDeal((d) => ({ ...d, financingMode: m }))}
                      className={[
                        "flex-1 rounded-xl border px-3 py-2 text-sm font-semibold transition",
                        deal.financingMode === m
                          ? "border-[#2F5D50]/30 bg-[#2F5D50] text-white hover:bg-[#3F7668]"
                          : "border-black/10 bg-white text-[#111827] hover:bg-black/[0.03]",
                      ].join(" ")}
                    >
                      {m}
                    </button>
                  ))}
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label>Loan Term (Years)</Label>
                  <NumberInput value={deal.loanTermYears} onChange={(n) => setDeal((d) => ({ ...d, loanTermYears: n ?? 10 }))} placeholder="10" />
                </div>
                <div className="space-y-1.5">
                  <Label>Interest Rate (%)</Label>
                  <NumberInput value={deal.interestRatePct} onChange={(n) => setDeal((d) => ({ ...d, interestRatePct: n ?? 10 }))} placeholder="10.0" />
                </div>
              </div>

              <div className="space-y-1.5">
                <Label>Closing Costs</Label>
                <NumberInput value={deal.closingCosts} onChange={(n) => setDeal((d) => ({ ...d, closingCosts: n ?? 0 }))} placeholder="e.g. 25000" />
                <label className="mt-1 flex items-center gap-2 text-xs text-black/60">
                  <input
                    type="checkbox"
                    checked={deal.includeClosingInLoan}
                    onChange={(e) => setDeal((d) => ({ ...d, includeClosingInLoan: e.target.checked }))}
                    className="h-4 w-4 accent-[#2F5D50]"
                  />
                  Include closing costs in loan
                </label>
              </div>

              <div className="space-y-1.5">
                <Label>Down Payment (%)</Label>
                <NumberInput value={deal.downPaymentPct} onChange={(n) => setDeal((d) => ({ ...d, downPaymentPct: n ?? 10 }))} placeholder="10" />
                <div className="text-xs text-black/50">SBA assumes ~10% equity. Custom uses this value.</div>
              </div>

              {/* 5-Year Projection Inputs (still Pro+ only) */}
              <div className="mt-3 rounded-2xl border border-black/10 bg-[#F7F8F6] p-3">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <div className="text-sm font-bold">5-Year Projection</div>
                    {!accessLoaded ? (
                      <div className="mt-1 text-xs text-black/50">Checking access…</div>
                    ) : !canUse5YearProjection ? (
                      <div className="mt-1 text-xs text-black/60">
                        <span className="font-semibold">Pro+ only.</span> Analyze works on Pro, but 5-year table is Pro+.
                      </div>
                    ) : (
                      <div className="mt-1 text-xs text-black/50">
                        Press <span className="font-semibold text-[#111827]">Analyze</span> to compute on server.
                      </div>
                    )}
                    {projError ? <div className="mt-1 text-xs text-red-600">{projError}</div> : null}
                  </div>

                  {!canUse5YearProjection ? (
                    <div className="rounded-lg border border-black/10 bg-white px-2 py-0.5 text-[11px] text-black/60">
                      Pro+
                    </div>
                  ) : null}
                </div>

                <div className="mt-3 grid grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <Label>SDE Growth (%)</Label>
                    <NumberInput
                      value={deal.projSdeGrowthPct}
                      onChange={(n) => setDeal((d) => ({ ...d, projSdeGrowthPct: n ?? 0 }))}
                      placeholder="3"
                      disabled={!canUse5YearProjection}
                    />
                  </div>

                  <div className="space-y-1.5">
                    <Label>Tax Rate (%)</Label>
                    <NumberInput
                      value={deal.projTaxRatePct}
                      onChange={(n) => setDeal((d) => ({ ...d, projTaxRatePct: n ?? 30 }))}
                      placeholder="30"
                      disabled={!canUse5YearProjection}
                    />
                  </div>
                </div>

                <div className="mt-3 space-y-1.5">
                  <Label>Annual Capex ($)</Label>
                  <NumberInput
                    value={deal.projCapexAnnual}
                    onChange={(n) => setDeal((d) => ({ ...d, projCapexAnnual: n ?? 0 }))}
                    placeholder="0"
                    disabled={!canUse5YearProjection}
                  />
                </div>

                {!canUse5YearProjection ? (
                  <div className="mt-3">
                    <a
                      href="/pricing"
                      className="inline-flex w-full items-center justify-center rounded-xl bg-[#2F5D50] px-4 py-2 text-sm font-bold text-white hover:bg-[#3F7668]"
                    >
                      Upgrade to Pro+
                    </a>
                  </div>
                ) : null}

                <div className="mt-2 text-xs text-black/50">Simple model: Net = SDE − Debt − Capex − Taxes.</div>
              </div>

              {/* Extra Annual Expenses */}
              <div className="mt-3 rounded-2xl border border-black/10 bg-[#F7F8F6] p-3">
                <div className="flex items-center justify-between">
                  <div>
                    <div className="text-sm font-bold">Extra Annual Expenses</div>
                    <div className="text-xs text-black/50">Subtract from SDE.</div>
                  </div>

                  <button
                    onClick={() =>
                      setDeal((d) => ({
                        ...d,
                        extraExpenses: [...d.extraExpenses, { label: "Expense", amount: 0 }],
                      }))
                    }
                    className="rounded-xl border border-black/10 bg-white px-3 py-1.5 text-xs font-semibold text-[#111827] hover:bg-black/[0.03]"
                  >
                    Add
                  </button>
                </div>

                <div className="mt-3 space-y-2">
                  {deal.extraExpenses.length === 0 ? (
                    <div className="text-xs text-black/50">No extra expenses.</div>
                  ) : (
                    deal.extraExpenses.map((ex, idx) => (
                      <div key={idx} className="grid grid-cols-[1fr_110px_34px] gap-2">
                        <TextInput
                          value={ex.label}
                          onChange={(v) =>
                            setDeal((d) => {
                              const copy = [...d.extraExpenses];
                              copy[idx] = { ...copy[idx], label: v };
                              return { ...d, extraExpenses: copy };
                            })
                          }
                          placeholder="Label"
                        />
                        <NumberInput
                          value={ex.amount}
                          onChange={(n) =>
                            setDeal((d) => {
                              const copy = [...d.extraExpenses];
                              copy[idx] = { ...copy[idx], amount: n ?? 0 };
                              return { ...d, extraExpenses: copy };
                            })
                          }
                          placeholder="0"
                        />
                        <button
                          onClick={() =>
                            setDeal((d) => ({
                              ...d,
                              extraExpenses: d.extraExpenses.filter((_, i) => i !== idx),
                            }))
                          }
                          className="rounded-xl border border-black/10 bg-white text-xs text-black/60 hover:bg-black/[0.03]"
                          title="Remove"
                        >
                          ×
                        </button>
                      </div>
                    ))
                  )}
                </div>
              </div>
            </div>
          </aside>

          {/* CENTER */}
          <section className="min-w-0 flex-1">
            <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
              <Card title="Asking Price" value={money(deal.askingPrice)} sub={bench?.median_asking_price !== undefined ? `Industry Avg: ${money(bench.median_asking_price)}` : "Industry Avg: —"} />
              <Card title="Revenue" value={money(deal.revenue)} sub={bench?.median_revenue !== undefined ? `Industry Avg: ${money(bench.median_revenue)}` : "Industry Avg: —"} />
              <Card title="Net Cash Flow (SDE)" value={money(results.sdeAdjusted)} sub={bench?.median_sde !== undefined ? `Industry Avg: ${money(bench.median_sde)}` : "Industry Avg: —"} />

              <Card title="Cash Flow Multiple" value={results.cfMultiple === null ? "—" : `${num(results.cfMultiple, 2)}x`} sub={bench?.price_to_sde_multiple !== undefined ? `Industry Avg: ${num(bench.price_to_sde_multiple, 2)}x` : "Industry Avg: —"} />
              <Card title="Revenue Multiple" value={results.revMultiple === null ? "—" : `${num(results.revMultiple, 2)}x`} sub={bench?.price_to_revenue_multiple !== undefined ? `Industry Avg: ${num(bench.price_to_revenue_multiple, 2)}x` : "Industry Avg: —"} />
              <Card title="Profit Margin" value={results.margin === null ? "—" : pct(results.margin, 1)} sub={bench?.cashflow_margin_pct !== undefined ? `Industry Avg: ${pct(bench.cashflow_margin_pct, 1)}` : "Industry Avg: —"} />

              <Card title="Total Acquisition Cost" value={money(results.totalAcquisitionCost)} sub={`Closing costs ${deal.includeClosingInLoan ? "included" : "excluded"} from loan`} />
              <Card title="Upfront Cash Required" value={money(results.upfrontCash)} sub={`Equity: ${money(results.equity)}${deal.includeClosingInLoan ? "" : ` • Closing: ${money(deal.closingCosts)}`}`} />
              <Card title="Loan Amount" value={money(results.loanAmt)} sub={bench?.median_sba_loan !== undefined ? `Industry Avg SBA Loan: ${money(bench.median_sba_loan)}` : "Industry Avg SBA Loan: —"} />

              <Card title="Monthly Payment" value={money(results.monthlyPay)} sub={`Term: ${deal.loanTermYears}y • Rate: ${pctFromPct(deal.interestRatePct, 2)}`} />
              <Card title="Annual Debt Service" value={money(results.annualDebt)} sub="Monthly payment × 12" />
              <Card
                title="DSCR"
                value={results.dscr === null ? "—" : num(results.dscr, 2)}
                sub="SDE ÷ Annual Debt Service (simple)"
                right={
                  results.dscr === null
                    ? ""
                    : results.dscr >= 1.25
                    ? "Healthy"
                    : results.dscr >= 1.15
                    ? "Borderline"
                    : "Risk"
                }
              />

              {/* ✅ Pro + Pro+ get Year 1 net after Analyze */}
              <Card
                title="Year 1 Net Profit"
                value={
                  !canAnalyzeDeal
                    ? "Pro+ / Pro only"
                    : projLoading
                    ? "Analyzing…"
                    : projData
                    ? money(year1Net)
                    : atLimit
                    ? "Limit reached"
                    : "Press Analyze"
                }
                sub={projData ? "After debt, capex, taxes" : "Runs on server and counts toward daily limit"}
                right={isStale && projData ? "Stale" : undefined}
              />

              {/* ✅ Pro+ only: break-even + payback cards */}
              <Card
                title="Break-even"
                value={
                  !canUse5YearProjection
                    ? "Pro+ only"
                    : projLoading
                    ? "Analyzing…"
                    : projData?.breakEvenYear
                    ? `Year ${projData.breakEvenYear}`
                    : projData
                    ? "Not in 5 years"
                    : atLimit
                    ? "Limit reached"
                    : "Press Analyze"
                }
                sub={!canUse5YearProjection ? "Upgrade to unlock" : "First year net turns positive"}
                right={!canUse5YearProjection ? "Pro+" : isStale && projData ? "Stale" : undefined}
              />
              <Card
                title="Payback Period"
                value={
                  !canUse5YearProjection
                    ? "Pro+ only"
                    : projLoading
                    ? "Analyzing…"
                    : projData?.paybackYears
                    ? `${num(projData.paybackYears, 1)} yrs`
                    : projData
                    ? "—"
                    : atLimit
                    ? "Limit reached"
                    : "Press Analyze"
                }
                sub={!canUse5YearProjection ? "Upgrade to unlock" : "Upfront cash ÷ Year 1 net"}
                right={!canUse5YearProjection ? "Pro+" : isStale && projData ? "Stale" : undefined}
              />
            </div>

            {/* DSCR Visual */}
            <div className="mt-5 rounded-2xl border border-black/10 bg-white p-5 shadow-sm">
              <div className="flex items-center justify-between">
                <div>
                  <div className="text-sm font-bold">DSCR Visual</div>
                  <div className="text-xs text-black/50">Quick signal — not a full underwriting model.</div>
                </div>
                <div className="text-xs text-black/50">
                  Target: <span className="font-semibold text-[#111827]">1.25+</span>
                </div>
              </div>

              <div className="mt-4">
                <div className="h-3 w-full rounded-full border border-black/10 bg-[#F7F8F6] overflow-hidden">
                  {(() => {
                    const d = results.dscr ?? 0;
                    const clamped = Math.max(0, Math.min(2.0, d));
                    const pctW = (clamped / 2.0) * 100;
                    return <div className="h-full bg-[#2F5D50]" style={{ width: `${pctW}%` }} />;
                  })()}
                </div>
                <div className="mt-2 flex justify-between text-xs text-black/50">
                  <span>0.00</span>
                  <span>1.00</span>
                  <span>1.25</span>
                  <span>2.00</span>
                </div>
              </div>
            </div>

            {/* ✅ 5-year table is Pro+ only */}
            <div className="mt-5 rounded-2xl border border-black/10 bg-white p-5 shadow-sm">
              <div className="flex flex-wrap items-end justify-between gap-2">
                <div>
                  <div className="text-sm font-bold">5-Year Profit Projection</div>
                  <div className="text-xs text-black/50">
                    {canUse5YearProjection ? "Computed on server when you press Analyze." : "Pro+ only."}
                  </div>
                </div>
                <div className="text-xs text-black/50">
                  Break-even:{" "}
                  <span className="font-semibold text-[#111827]">
                    {!canUse5YearProjection
                      ? "Pro+ only"
                      : projLoading
                      ? "Analyzing…"
                      : projData?.breakEvenYear
                      ? `Year ${projData.breakEvenYear}`
                      : projData
                      ? "Not in 5 years"
                      : "—"}
                  </span>
                </div>
              </div>

              {!canUse5YearProjection || projLocked ? (
                <div className="mt-4 rounded-2xl border border-black/10 bg-[#F7F8F6] p-4">
                  <div className="text-sm font-semibold">Pro+ only</div>
                  <div className="mt-1 text-xs text-black/60">
                    You can still Analyze on Pro, but the 5-year rows / break-even / payback table is Pro+.
                  </div>
                  <div className="mt-3">
                    <a
                      href="/pricing"
                      className="inline-flex w-full items-center justify-center rounded-xl bg-[#2F5D50] px-4 py-2 text-sm font-bold text-white hover:bg-[#3F7668]"
                    >
                      Upgrade to Pro+
                    </a>
                  </div>
                </div>
              ) : projLoading ? (
                <div className="mt-4 rounded-xl border border-black/10 bg-[#F7F8F6] p-4 text-sm text-black/60">
                  Analyzing on server…
                </div>
              ) : atLimit ? (
                <div className="mt-4 rounded-xl border border-black/10 bg-[#F7F8F6] p-4 text-sm text-red-600">
                  Daily limit reached.{" "}
                  <a href="/pricing" className="font-semibold underline">
                    Upgrade to Pro+
                  </a>{" "}
                  for unlimited analyzes.
                </div>
              ) : projError ? (
                <div className="mt-4 rounded-xl border border-black/10 bg-[#F7F8F6] p-4 text-sm text-red-600">
                  {projError}
                </div>
              ) : !projData ? (
                <div className="mt-4 rounded-2xl border border-black/10 bg-[#F7F8F6] p-4">
                  <div className="text-sm font-semibold">Press Analyze</div>
                  <div className="mt-1 text-xs text-black/60">
                    Projection rows only appear after a server run.
                  </div>
                </div>
              ) : (
                <>
                  {isStale ? (
                    <div className="mt-4 rounded-xl border border-black/10 bg-[#F7F8F6] p-4 text-sm text-black/70">
                      These results are <span className="font-semibold">stale</span> because you changed inputs. Press{" "}
                      <span className="font-semibold">Analyze</span> again.
                    </div>
                  ) : null}

                  <div className="mt-3 overflow-x-auto">
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
                        {projData.rows.map((r) => (
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

                  <div className="mt-3 text-xs text-black/50">
                    Payback:{" "}
                    <span className="font-semibold text-[#111827]">
                      {projData.paybackYears ? `${num(projData.paybackYears, 1)} years` : "—"}
                    </span>{" "}
                    (Upfront cash ÷ Year 1 net profit)
                  </div>
                </>
              )}
            </div>
          </section>

          {/* RIGHT */}
          <aside className="w-[360px] shrink-0 rounded-2xl border border-black/10 bg-white p-5 shadow-sm">
            <div className="text-sm font-bold">Analyze + Save</div>
            <div className="mt-1 text-xs text-black/50">
              {canAnalyzeDeal ? (
                <>
                  Press <span className="font-semibold text-[#111827]">Analyze</span> to run the server model.
                  {canUse5YearProjection ? " (Pro+ shows 5-year table.)" : " (Pro+ unlocks 5-year table.)"}
                </>
              ) : (
                <>Pro / Pro+ only.</>
              )}
            </div>

            <div className="mt-4 rounded-2xl border border-black/10 bg-[#F7F8F6] p-4">
              <div className="text-xs text-black/50">Saved payload includes</div>
              <ul className="mt-2 list-disc pl-5 text-sm text-black/70 space-y-1">
                <li>Deal inputs</li>
                <li>Computed KPIs (DSCR, multiples, upfront cash)</li>
                <li>Benchmark snapshot</li>
                <li>
                  5-year projection <span className="font-semibold">(Pro+ only)</span>
                </li>
              </ul>
            </div>

            <div className="mt-4 space-y-2">
              <button
                onClick={handleAnalyze}
                disabled={!canAnalyze}
                className="w-full rounded-xl bg-[#2F5D50] px-4 py-2 text-sm font-bold text-white hover:bg-[#3F7668] disabled:opacity-60"
              >
                {projLoading ? "Analyzing…" : "Analyze (counts toward limit)"}
              </button>

              {!canAnalyzeDeal ? (
                <a
                  href="/pricing"
                  className="inline-flex w-full items-center justify-center rounded-xl border border-black/10 bg-white px-4 py-2 text-sm font-bold text-[#111827] hover:bg-black/[0.03]"
                >
                  Upgrade to Pro
                </a>
              ) : !canUse5YearProjection ? (
                <a
                  href="/pricing"
                  className="inline-flex w-full items-center justify-center rounded-xl border border-black/10 bg-white px-4 py-2 text-sm font-bold text-[#111827] hover:bg-black/[0.03]"
                >
                  Upgrade to Pro+
                </a>
              ) : null}
            </div>
          </aside>
        </div>
      </div>

      <footer className="border-t border-black/10 bg-white">
        <div className="mx-auto flex max-w-7xl flex-col gap-3 px-6 py-8 text-sm text-black/50 md:flex-row md:items-center md:justify-between">
          <p>© {yearNow} Underwrite HQ. All rights reserved.</p>
          <div className="flex gap-4">
            <a className="hover:text-[#111827]" href="/about">
              About
            </a>
            <a className="hover:text-[#111827]" href="/data">
              Data
            </a>
            <a className="hover:text-[#111827]" href="/deal-calculator">
              Deal Calculator
            </a>
          </div>
        </div>
      </footer>
    </main>
  );
}
