"use client";

import React, { useEffect, useMemo, useState } from "react";

type Row = {
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

const YEARS = [2024, 2023, 2022, 2021, 2020, 2019, 2018];

function parseNumber(v?: string) {
  if (!v) return undefined;
  const cleaned = v.replace(/[$,%\s]/g, "").trim();
  if (cleaned === "" || cleaned === "-" || cleaned === "—") return undefined;
  const n = Number(cleaned);
  return Number.isFinite(n) ? n : undefined;
}

// Minimal CSV parser that handles quoted values + commas inside quotes
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

function parseCSV(text: string): Row[] {
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

function money(n?: number) {
  if (n === undefined) return "—";
  return n.toLocaleString(undefined, {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  });
}

function num(n?: number) {
  if (n === undefined) return "—";
  return n.toLocaleString();
}

function pctFromDecimal(dec?: number, digits = 1) {
  if (dec === undefined) return "—";
  return `${(dec * 100).toFixed(digits)}%`;
}

type SortKey =
  | "median_revenue"
  | "median_sde"
  | "cashflow_margin_pct"
  | "median_sold_price"
  | "median_asking_price"
  | "price_to_sde_multiple"
  | "price_to_revenue_multiple"
  | "days_on_market"
  | "listings_count"
  | "median_sba_loan"
  | "sba_default_rate_pct";

function labelForSortKey(k: SortKey) {
  switch (k) {
    case "median_revenue":
      return "Revenue";
    case "median_sde":
      return "SDE (Cash Flow)";
    case "cashflow_margin_pct":
      return "Profit Margin";
    case "median_sold_price":
      return "Sold Price";
    case "median_asking_price":
      return "Asking Price";
    case "price_to_sde_multiple":
      return "CF Multiple";
    case "price_to_revenue_multiple":
      return "Revenue Multiple";
    case "days_on_market":
      return "Days on Market";
    case "listings_count":
      return "Total Sold";
    case "median_sba_loan":
      return "Avg SBA Loan";
    case "sba_default_rate_pct":
      return "SBA Default Rate";
  }
}

function safeNumber(v?: number) {
  return typeof v === "number" && Number.isFinite(v) ? v : undefined;
}

type Access = { plan: "free" | "pro" | "pro_plus"; isAdmin?: boolean };

export default function DataPage() {
  const [year, setYear] = useState<number>(YEARS[0]);
  const [rows, setRows] = useState<Row[]>([]);
  const [search, setSearch] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  // ✅ access gate
  const [access, setAccess] = useState<Access | null>(null);
  const [accessLoading, setAccessLoading] = useState(true);

  const isPro = !!(access?.isAdmin || access?.plan === "pro" || access?.plan === "pro_plus");

  // ✅ ranking + filters (pro only)
  const [sortKey, setSortKey] = useState<SortKey>("median_revenue");
  const [sortDir, setSortDir] = useState<"desc" | "asc">("desc");
  const [topN, setTopN] = useState<number>(0); // 0 = show all
  const [minSold, setMinSold] = useState<number>(0);
  const [minRevenue, setMinRevenue] = useState<number>(0);
  const [minSde, setMinSde] = useState<number>(0);
  const [minMarginPct, setMinMarginPct] = useState<number>(0); // percent (10 = 10%)

  useEffect(() => {
    let cancelled = false;

    async function loadAccess() {
      try {
        setAccessLoading(true);
        const res = await fetch("/api/me/access", { method: "GET" });
        if (!res.ok) throw new Error("Failed to load access");
        const data = (await res.json()) as Access;
        if (!cancelled) setAccess(data);
      } catch {
        if (!cancelled) setAccess({ plan: "free" });
      } finally {
        if (!cancelled) setAccessLoading(false);
      }
    }

    loadAccess();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    setError(null);
    setLoading(true);

    fetch(`/data/industry_metrics_${year}.csv`)
      .then((r) => {
        if (!r.ok) throw new Error(`Missing CSV: /data/industry_metrics_${year}.csv`);
        return r.text();
      })
      .then((text) => setRows(parseCSV(text)))
      .catch((e) => {
        console.error(e);
        setRows([]);
        setError(String(e?.message ?? "Failed to load CSV"));
      })
      .finally(() => setLoading(false));
  }, [year]);

  const processed = useMemo(() => {
    // FREE: show only 3 rows, no filters/search/sort/topN
    if (!isPro) {
      return rows.slice(0, 3);
    }

    // PRO: your current logic
    const q = search.trim().toLowerCase();
    let out = !q ? rows : rows.filter((r) => r.industry.toLowerCase().includes(q));

    if (minSold > 0) out = out.filter((r) => (safeNumber(r.listings_count) ?? 0) >= minSold);
    if (minRevenue > 0) out = out.filter((r) => (safeNumber(r.median_revenue) ?? 0) >= minRevenue);
    if (minSde > 0) out = out.filter((r) => (safeNumber(r.median_sde) ?? 0) >= minSde);
    if (minMarginPct > 0) {
      const minDec = minMarginPct / 100;
      out = out.filter((r) => (safeNumber(r.cashflow_margin_pct) ?? 0) >= minDec);
    }

    const dir = sortDir === "desc" ? -1 : 1;
    const get = (r: Row): number => {
      const v = (r as any)[sortKey] as number | undefined;
      if (typeof v === "number" && Number.isFinite(v)) return v;
      return Number.NEGATIVE_INFINITY;
    };

    const sorted = [...out].sort((a, b) => {
      const av = get(a);
      const bv = get(b);
      if (av === bv) return a.industry.localeCompare(b.industry);
      return av < bv ? 1 * dir : -1 * dir;
    });

    if (topN > 0) return sorted.slice(0, topN);
    return sorted;
  }, [
    rows,
    isPro,
    search,
    minSold,
    minRevenue,
    minSde,
    minMarginPct,
    sortKey,
    sortDir,
    topN,
  ]);

  const filtered = processed;

  // ✅ top snapshots (pro only in UI, but safe to compute always)
  const topRevenue = useMemo(() => {
    return [...rows]
      .filter((r) => safeNumber(r.median_revenue) !== undefined)
      .sort(
        (a, b) =>
          (safeNumber(b.median_revenue) ?? -1) - (safeNumber(a.median_revenue) ?? -1)
      )[0];
  }, [rows]);

  const topSdeRow = useMemo(() => {
    return [...rows]
      .filter((r) => safeNumber(r.median_sde) !== undefined)
      .sort((a, b) => (safeNumber(b.median_sde) ?? -1) - (safeNumber(a.median_sde) ?? -1))[0];
  }, [rows]);

  const topMarginRow = useMemo(() => {
    return [...rows]
      .filter((r) => safeNumber(r.cashflow_margin_pct) !== undefined)
      .sort(
        (a, b) =>
          (safeNumber(b.cashflow_margin_pct) ?? -1) -
          (safeNumber(a.cashflow_margin_pct) ?? -1)
      )[0];
  }, [rows]);

  const hasActiveFilters =
    topN > 0 ||
    minSold > 0 ||
    minRevenue > 0 ||
    minSde > 0 ||
    minMarginPct > 0 ||
    search.trim().length > 0 ||
    sortKey !== "median_revenue" ||
    sortDir !== "desc";

  return (
    <main className="min-h-screen bg-[#F7F8F6] text-[#111827]">
      {/* Page Head */}
      <section className="mx-auto max-w-6xl px-6 pt-10 pb-6">
        <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
          <div>
            <p className="mb-2 inline-flex items-center gap-2 rounded-full border border-black/10 bg-white px-3 py-1 text-xs text-black/70 shadow-sm">
              <span className="h-1.5 w-1.5 rounded-full bg-[#2F5D50]" />
              Market Benchmarks
            </p>

            <h1 className="text-3xl font-extrabold tracking-tight md:text-4xl">
              Business Valuation & Lending Metrics
            </h1>

            <p className="mt-2 max-w-2xl text-sm text-black/60">
              Filter by year, search industries, and compare valuation multiples,
              margins, and time-to-sale — all in a clean white + matte green
              dashboard.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <div className="rounded-xl border border-black/10 bg-white px-3 py-2 text-xs text-black/70 shadow-sm">
              {loading || accessLoading ? (
                "Loading…"
              ) : (
                <>
                  Rows:{" "}
                  <span className="font-semibold text-[#111827]">{filtered.length}</span>
                  {!isPro ? <span className="text-black/45"> (Free preview)</span> : null}
                </>
              )}
            </div>

            {isPro ? (
              <div className="rounded-xl border border-black/10 bg-white px-3 py-2 text-xs text-black/70 shadow-sm">
                Rank:{" "}
                <span className="font-semibold text-[#111827]">{labelForSortKey(sortKey)}</span>{" "}
                <span className="text-black/45">
                  ({sortDir === "desc" ? "High → Low" : "Low → High"}
                  {topN > 0 ? ` • Top ${topN}` : ""})
                </span>
              </div>
            ) : null}
          </div>
        </div>

        {/* Controls */}
        <div className="mt-6 flex flex-col gap-3 md:flex-row md:items-center md:gap-4">
          <label className="flex items-center gap-2 text-sm text-black/60">
            <span>Year</span>
            <select
              value={year}
              onChange={(e) => setYear(+e.target.value)}
              disabled={!isPro}
              className="rounded-xl border border-black/10 bg-white px-3 py-2 text-sm text-[#111827] outline-none hover:bg-black/[0.02] disabled:opacity-60"
            >
              {YEARS.map((y) => (
                <option key={y} value={y}>
                  {y}
                </option>
              ))}
            </select>
          </label>

          <div className="flex-1">
            <input
              placeholder={isPro ? "Search industry…" : "Upgrade to search…"}
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              disabled={!isPro}
              className="w-full rounded-xl border border-black/10 bg-white px-4 py-2 text-sm text-[#111827] outline-none placeholder:text-black/35 hover:bg-black/[0.02] focus:bg-black/[0.02] disabled:opacity-60"
            />
          </div>

          <button
            type="button"
            disabled={!isPro}
            className="inline-flex items-center justify-center rounded-xl border border-black/10 bg-white px-4 py-2 text-sm font-semibold text-[#111827] hover:bg-black/[0.03] disabled:opacity-60"
            onClick={() => setSearch("")}
          >
            Clear
          </button>
        </div>

        {/* Pro filters OR free preview message */}
        {isPro ? (
          <div className="mt-4 rounded-2xl border border-black/10 bg-white p-4 shadow-sm">
            <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
              <div>
                <p className="text-xs text-black/50">Ranking & Filters</p>
                <p className="mt-0.5 text-sm font-semibold text-[#111827]">
                  Find top industries by revenue, SDE, or profit margin
                </p>
              </div>

              <div className="flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  className="inline-flex items-center justify-center rounded-xl border border-black/10 bg-[#F7F8F6] px-3 py-2 text-xs font-semibold text-[#111827] hover:bg-black/[0.03]"
                  onClick={() => {
                    setSortKey("median_revenue");
                    setSortDir("desc");
                    setTopN(25);
                  }}
                >
                  Top Revenue
                </button>
                <button
                  type="button"
                  className="inline-flex items-center justify-center rounded-xl border border-black/10 bg-[#F7F8F6] px-3 py-2 text-xs font-semibold text-[#111827] hover:bg-black/[0.03]"
                  onClick={() => {
                    setSortKey("median_sde");
                    setSortDir("desc");
                    setTopN(25);
                  }}
                >
                  Top SDE
                </button>
                <button
                  type="button"
                  className="inline-flex items-center justify-center rounded-xl border border-black/10 bg-[#F7F8F6] px-3 py-2 text-xs font-semibold text-[#111827] hover:bg-black/[0.03]"
                  onClick={() => {
                    setSortKey("cashflow_margin_pct");
                    setSortDir("desc");
                    setTopN(25);
                  }}
                >
                  Top Margin
                </button>

                <button
                  type="button"
                  className="inline-flex items-center justify-center rounded-xl border border-black/10 bg-white px-3 py-2 text-xs font-semibold text-[#111827] hover:bg-black/[0.03]"
                  onClick={() => {
                    setSortKey("median_revenue");
                    setSortDir("desc");
                    setTopN(0);
                    setMinSold(0);
                    setMinRevenue(0);
                    setMinSde(0);
                    setMinMarginPct(0);
                    setSearch("");
                  }}
                >
                  Reset All
                </button>
              </div>
            </div>

            <div className="mt-4 grid grid-cols-1 gap-3 md:grid-cols-12">
              <div className="md:col-span-4">
                <label className="block text-xs text-black/50">Rank by</label>
                <select
                  value={sortKey}
                  onChange={(e) => setSortKey(e.target.value as SortKey)}
                  className="mt-1 w-full rounded-xl border border-black/10 bg-white px-3 py-2 text-sm text-[#111827] outline-none hover:bg-black/[0.02]"
                >
                  <option value="median_revenue">Revenue</option>
                  <option value="median_sde">SDE (Cash Flow)</option>
                  <option value="cashflow_margin_pct">Profit Margin</option>
                  <option value="median_sold_price">Sold Price</option>
                  <option value="median_asking_price">Asking Price</option>
                  <option value="price_to_sde_multiple">CF Multiple</option>
                  <option value="price_to_revenue_multiple">Revenue Multiple</option>
                  <option value="listings_count">Total Sold</option>
                  <option value="days_on_market">Days on Market</option>
                  <option value="median_sba_loan">Avg SBA Loan</option>
                  <option value="sba_default_rate_pct">SBA Default Rate</option>
                </select>
              </div>

              <div className="md:col-span-3">
                <label className="block text-xs text-black/50">Direction</label>
                <div className="mt-1 flex gap-2">
                  <button
                    type="button"
                    className={[
                      "flex-1 rounded-xl border border-black/10 px-3 py-2 text-sm font-semibold hover:bg-black/[0.03]",
                      sortDir === "desc" ? "bg-[#F7F8F6]" : "bg-white",
                    ].join(" ")}
                    onClick={() => setSortDir("desc")}
                  >
                    High → Low
                  </button>
                  <button
                    type="button"
                    className={[
                      "flex-1 rounded-xl border border-black/10 px-3 py-2 text-sm font-semibold hover:bg-black/[0.03]",
                      sortDir === "asc" ? "bg-[#F7F8F6]" : "bg-white",
                    ].join(" ")}
                    onClick={() => setSortDir("asc")}
                  >
                    Low → High
                  </button>
                </div>
              </div>

              <div className="md:col-span-2">
                <label className="block text-xs text-black/50">Top N</label>
                <select
                  value={topN}
                  onChange={(e) => setTopN(+e.target.value)}
                  className="mt-1 w-full rounded-xl border border-black/10 bg-white px-3 py-2 text-sm text-[#111827] outline-none hover:bg-black/[0.02]"
                >
                  <option value={0}>All</option>
                  <option value={10}>Top 10</option>
                  <option value={25}>Top 25</option>
                  <option value={50}>Top 50</option>
                  <option value={100}>Top 100</option>
                </select>
              </div>

              <div className="md:col-span-3">
                <label className="block text-xs text-black/50">Min sold</label>
                <input
                  type="number"
                  min={0}
                  value={minSold}
                  onChange={(e) => setMinSold(Math.max(0, +e.target.value || 0))}
                  className="mt-1 w-full rounded-xl border border-black/10 bg-white px-3 py-2 text-sm text-[#111827] outline-none hover:bg-black/[0.02]"
                  placeholder="0"
                />
              </div>

              <div className="md:col-span-4">
                <label className="block text-xs text-black/50">Min revenue</label>
                <input
                  type="number"
                  min={0}
                  value={minRevenue}
                  onChange={(e) => setMinRevenue(Math.max(0, +e.target.value || 0))}
                  className="mt-1 w-full rounded-xl border border-black/10 bg-white px-3 py-2 text-sm text-[#111827] outline-none hover:bg-black/[0.02]"
                  placeholder="0"
                />
                <p className="mt-1 text-[11px] text-black/45">Example: 1000000 = $1M</p>
              </div>

              <div className="md:col-span-4">
                <label className="block text-xs text-black/50">Min SDE</label>
                <input
                  type="number"
                  min={0}
                  value={minSde}
                  onChange={(e) => setMinSde(Math.max(0, +e.target.value || 0))}
                  className="mt-1 w-full rounded-xl border border-black/10 bg-white px-3 py-2 text-sm text-[#111827] outline-none hover:bg-black/[0.02]"
                  placeholder="0"
                />
                <p className="mt-1 text-[11px] text-black/45">Example: 200000 = $200k SDE</p>
              </div>

              <div className="md:col-span-4">
                <label className="block text-xs text-black/50">Min profit margin (%)</label>
                <input
                  type="number"
                  min={0}
                  value={minMarginPct}
                  onChange={(e) => setMinMarginPct(Math.max(0, +e.target.value || 0))}
                  className="mt-1 w-full rounded-xl border border-black/10 bg-white px-3 py-2 text-sm text-[#111827] outline-none hover:bg-black/[0.02]"
                  placeholder="0"
                />
                <p className="mt-1 text-[11px] text-black/45">Example: 15 = 15%</p>
              </div>
            </div>

            <div className="mt-5 grid grid-cols-1 gap-3 md:grid-cols-3">
              <div className="rounded-2xl border border-black/10 bg-[#F7F8F6] p-4">
                <p className="text-xs text-black/50">Top Revenue Industry</p>
                <p className="mt-1 text-sm font-semibold text-[#111827]">
                  {topRevenue?.industry ?? "—"}
                </p>
                <p className="mt-1 text-xs text-black/60">
                  Revenue:{" "}
                  <span className="font-semibold text-[#111827]">{money(topRevenue?.median_revenue)}</span>{" "}
                  • SDE:{" "}
                  <span className="font-semibold text-[#111827]">{money(topRevenue?.median_sde)}</span>
                </p>
              </div>

              <div className="rounded-2xl border border-black/10 bg-[#F7F8F6] p-4">
                <p className="text-xs text-black/50">Top SDE Industry</p>
                <p className="mt-1 text-sm font-semibold text-[#111827]">
                  {topSdeRow?.industry ?? "—"}
                </p>
                <p className="mt-1 text-xs text-black/60">
                  SDE:{" "}
                  <span className="font-semibold text-[#111827]">{money(topSdeRow?.median_sde)}</span>{" "}
                  • Margin:{" "}
                  <span className="font-semibold text-[#111827]">
                    {pctFromDecimal(topSdeRow?.cashflow_margin_pct, 1)}
                  </span>
                </p>
              </div>

              <div className="rounded-2xl border border-black/10 bg-[#F7F8F6] p-4">
                <p className="text-xs text-black/50">Most Profitable (Margin)</p>
                <p className="mt-1 text-sm font-semibold text-[#111827]">
                  {topMarginRow?.industry ?? "—"}
                </p>
                <p className="mt-1 text-xs text-black/60">
                  Margin:{" "}
                  <span className="font-semibold text-[#111827]">
                    {pctFromDecimal(topMarginRow?.cashflow_margin_pct, 1)}
                  </span>{" "}
                  • Revenue:{" "}
                  <span className="font-semibold text-[#111827]">{money(topMarginRow?.median_revenue)}</span>
                </p>
              </div>
            </div>

            {hasActiveFilters && (
              <p className="mt-4 text-xs text-black/50">
                Showing ranked results based on your filters. Missing values are pushed to the bottom automatically.
              </p>
            )}
          </div>
        ) : (
          <div className="mt-4 rounded-2xl border border-black/10 bg-white p-4 shadow-sm">
            <p className="text-sm font-semibold text-[#111827]">Free preview</p>
            <p className="mt-1 text-sm text-black/60">
              Free accounts can view the Data page, but only see 3 sample rows. Upgrade to unlock the full dataset,
              ranking, and filters.
            </p>
            <a
              href="/pricing"
              className="mt-3 inline-flex rounded-xl bg-[#2F5D50] px-4 py-2 text-sm font-bold text-white hover:bg-[#3F7668]"
            >
              Upgrade
            </a>
          </div>
        )}

        {error && (
          <div className="mt-4 rounded-2xl border border-black/10 bg-white p-4 text-sm text-black/70 shadow-sm">
            <div className="font-semibold text-[#111827]">CSV Load Error</div>
            <div className="mt-1 text-black/70">{error}</div>
            <div className="mt-2 text-xs text-black/50">
              Ensure file exists:{" "}
              <span className="font-semibold text-[#111827]">/public/data/industry_metrics_{year}.csv</span>
            </div>
            <div className="mt-1 text-xs text-black/50">
              Test in browser:{" "}
              <span className="font-semibold text-[#111827]">
                http://localhost:3000/data/industry_metrics_{year}.csv
              </span>
            </div>
          </div>
        )}
      </section>

      {/* Table */}
      <section className="mx-auto max-w-6xl px-6 pb-14">
        <div className="rounded-2xl border border-black/10 bg-white shadow-sm">
          <div className="border-b border-black/10 px-4 py-3 md:px-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-black/50">Dataset</p>
                <p className="mt-0.5 text-sm font-semibold text-[#111827]">
                  Industry Metrics — {year}
                </p>
                {!isPro ? (
                  <p className="mt-1 text-xs text-black/50">Showing 3 sample rows (Free).</p>
                ) : null}
              </div>
              <div className="rounded-xl border border-black/10 bg-[#F7F8F6] px-3 py-1 text-xs text-black/60">
                Sticky columns • Scrollable
              </div>
            </div>
          </div>

          <div className="w-full overflow-x-auto">
            <table className="w-full min-w-[1550px] border-separate border-spacing-0">
              <thead>
                <tr className="text-xs uppercase tracking-wide text-black/50">
                  {[
                    { key: "Industry", align: "left" as const },
                    { key: "Asking Price", align: "right" as const },
                    { key: "Sold Price", align: "right" as const },
                    { key: "SDE", align: "right" as const },
                    { key: "CF Multiple", align: "right" as const },
                    { key: "Revenue", align: "right" as const },
                    { key: "Revenue Multiple", align: "right" as const },
                    { key: "Profit Margin", align: "right" as const },
                    { key: "Total Sold", align: "right" as const },
                    { key: "Days on Market", align: "right" as const },
                    { key: "Avg SBA Loan", align: "right" as const },
                    { key: "SBA Default Rate", align: "right" as const },
                  ].map((h) => (
                    <th
                      key={h.key}
                      className={[
                        "sticky top-0 z-20 whitespace-nowrap border-b border-black/10 bg-white/90 backdrop-blur px-3 py-3",
                        h.align === "left" ? "text-left" : "text-right",
                      ].join(" ")}
                    >
                      {h.key}
                    </th>
                  ))}
                </tr>
              </thead>

              <tbody>
                {filtered.map((r, i) => (
                  <tr
                    key={`${r.industry}-${i}`}
                    className="border-t border-black/10 hover:bg-black/[0.02] transition-colors"
                  >
                    <td className="sticky left-0 z-10 min-w-[260px] border-b border-black/10 bg-white px-3 py-3">
                      <div className="font-semibold text-[#111827]">{r.industry || "—"}</div>
                      <div className="mt-0.5 text-xs text-black/45">
                        {r.listings_count !== undefined ? `${num(r.listings_count)} sold` : "—"}
                      </div>
                    </td>

                    <td className={cellR}>{money(r.median_asking_price)}</td>
                    <td className={cellR}>
                      <span className="text-black/80">{money(r.median_sold_price)}</span>
                    </td>
                    <td className={cellR}>
                      <span className="font-semibold text-[#111827]">{money(r.median_sde)}</span>
                    </td>
                    <td className={cellR}>
                      {r.price_to_sde_multiple !== undefined ? `${r.price_to_sde_multiple.toFixed(2)}x` : "—"}
                    </td>
                    <td className={cellR}>{money(r.median_revenue)}</td>
                    <td className={cellR}>
                      {r.price_to_revenue_multiple !== undefined
                        ? `${r.price_to_revenue_multiple.toFixed(2)}x`
                        : "—"}
                    </td>
                    <td className={cellR}>
                      <span className="font-semibold text-[#111827]">{pctFromDecimal(r.cashflow_margin_pct, 1)}</span>
                    </td>
                    <td className={cellR}>{num(r.listings_count)}</td>
                    <td className={cellR}>{num(r.days_on_market)}</td>
                    <td className={cellR}>{money(r.median_sba_loan)}</td>
                    <td className={cellR}>{pctFromDecimal(r.sba_default_rate_pct, 2)}</td>
                  </tr>
                ))}

                {!loading && filtered.length === 0 && (
                  <tr>
                    <td colSpan={12} className="px-6 py-10 text-center text-sm text-black/60">
                      {isPro ? `No industries match “${search}”.` : "No rows to show."}
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          <div className="border-t border-black/10 px-4 py-4 md:px-6">
            <p className="text-xs text-black/50">
              Tip: Hover rows to focus. Matte green is reserved for emphasis (CTAs + key indicators).
            </p>
          </div>
        </div>
      </section>

      <footer className="border-t border-black/10 bg-white">
        <div className="mx-auto flex max-w-6xl flex-col gap-3 px-6 py-8 text-sm text-black/50 md:flex-row md:items-center md:justify-between">
          <p>© {new Date().getFullYear()} Underwrite HQ. All rights reserved.</p>

          <div className="flex gap-4">
            <a className="hover:text-[#111827]" href="/about">
              About
            </a>
            <a className="hover:text-[#111827]" href="/data">
              Data
            </a>
            <a className="hover:text-[#111827]" href="/dashboard">
              Dashboard
            </a>
          </div>
        </div>
      </footer>
    </main>
  );
}

const cellR =
  "whitespace-nowrap border-b border-black/10 px-3 py-3 text-right text-sm text-black/60";
