"use client";

import React, { useEffect, useMemo, useState } from "react";

/* ============================================================
   Types
============================================================ */

type Section = { title: string; body: string };

type Rating = {
  score: number; // 0–100
  grade: string; // A, B+, C-, etc
  summary: string; // 1-line takeaway
  verdict: string; // Strong / Mixed / Risky
  drivers?: {
    positives: string[];
    negatives: string[];
    neutrals: string[];
  };
};

type ProjectionRow = {
  year: number;
  revenue?: number;
  sde?: number;
  debtService?: number;
  dscr?: number;
  cashToEquity?: number;
  cumCashToEquity?: number;
};

type MoneyHit = {
  raw: string;
  value: number;
  hasDollar: boolean;
  hasSuffix: boolean;
  commaCount: number;
};

type AccessResponse = {
  ok: boolean;
  plan: string;
  isAdmin: boolean;
  entitlements: {
    canUseCimAnalyzer?: boolean;
    canUseDealCalculator?: boolean;
    canUse5YearProjection?: boolean;
    canSaveDeals?: boolean;
    limits?: {
      cimAnalyzer?: {
        dailyLimit: number;
        usedToday: number;
        remaining: number;
        resetsAt?: string; // ISO
      };
      [k: string]: any;
    };
    [k: string]: any;
  };
};

/* ============================================================
   Utils
============================================================ */

function cx(...classes: Array<string | false | null | undefined>) {
  return classes.filter(Boolean).join(" ");
}

function clamp(n: number, min: number, max: number) {
  return Math.max(min, Math.min(max, n));
}

function money(n?: number) {
  if (n === undefined || !Number.isFinite(n)) return "—";
  return n.toLocaleString(undefined, {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  });
}

function pct(n?: number, digits = 0) {
  if (n === undefined || !Number.isFinite(n)) return "—";
  return `${(n * 100).toFixed(digits)}%`;
}

/* ============================================================
   Theme tokens
============================================================ */

const THEME = {
  pageBg: "bg-[#F7F8F6]",
  text: "text-[#111827]",
  green: "#0F2F29",
  accent: "#2F5D50",
  soft: "#F7F8F6",
};

/* ============================================================
   UI Primitives
============================================================ */

function StatPill({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl border border-white/15 bg-white/10 px-4 py-3 backdrop-blur">
      <div className="text-[11px] uppercase tracking-wide text-white/70">
        {label}
      </div>
      <div className="mt-1 text-sm font-bold text-white">{value}</div>
    </div>
  );
}

function LightCard({
  title,
  desc,
  right,
  children,
}: {
  title: string;
  desc?: string;
  right?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <div className="rounded-2xl border border-black/10 bg-white shadow-sm">
      <div className="flex items-start justify-between gap-4 border-b border-black/10 px-6 py-4">
        <div>
          <div className="text-sm font-bold text-[#111827]">{title}</div>
          {desc && <div className="mt-1 text-xs text-black/50">{desc}</div>}
        </div>
        {right}
      </div>
      <div className="p-6">{children}</div>
    </div>
  );
}

/* ============================================================
   Rating Card
============================================================ */

function RatingCard({
  rating,
  hasAnalyzed,
  loading,
}: {
  rating: Rating | null;
  hasAnalyzed: boolean;
  loading: boolean;
}) {
  if (!hasAnalyzed || loading || !rating) {
    return (
      <div className="rounded-2xl border border-black/10 bg-white p-6 shadow-sm">
        <div className="flex items-start justify-between gap-4">
          <div>
            <div className="text-xs uppercase tracking-wide text-black/50">
              Overall Rating
            </div>
            <div className="mt-2 text-sm text-black/70">
              {loading
                ? "Analyzing CIM…"
                : "Run analysis to generate a score + memo."}
            </div>
          </div>

          <div className="rounded-xl border border-black/10 bg-[#F7F8F6] px-3 py-2 text-xs font-semibold text-black/70">
            {loading ? "Analyzing…" : "Not scored yet"}
          </div>
        </div>

        <div className="relative mt-6">
          <div className="h-3 w-full rounded-full border border-black/10 bg-[#F7F8F6] overflow-hidden" />
          {[50, 70, 85].map((v) => (
            <div
              key={v}
              className="absolute -top-1 h-5 w-px bg-black/15"
              style={{ left: `${v}%` }}
            />
          ))}
          {[0, 50, 70, 85, 100].map((v) => (
            <div
              key={v}
              className="absolute top-5 text-xs text-black/40"
              style={{ left: `${v}%`, transform: "translateX(-50%)" }}
            >
              {v}
            </div>
          ))}
        </div>
      </div>
    );
  }

  const score = clamp(rating.score, 0, 100);

  const label =
    score >= 85 ? "Strong" : score >= 70 ? "Good" : score >= 55 ? "Mixed" : "Risky";

  const pillTone =
    score >= 85
      ? "border-emerald-200 bg-emerald-50 text-emerald-900"
      : score >= 70
      ? "border-slate-200 bg-slate-50 text-slate-900"
      : score >= 55
      ? "border-amber-200 bg-amber-50 text-amber-900"
      : "border-red-200 bg-red-50 text-red-900";

  return (
    <div className="rounded-2xl border border-black/10 bg-white p-6 shadow-sm">
      <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
        <div className="min-w-0">
          <div className="text-xs uppercase tracking-wide text-black/50">
            Overall Rating
          </div>

          <div className="mt-1 flex flex-wrap items-baseline gap-3">
            <div className="text-4xl font-extrabold tracking-tight text-[#111827]">
              {score}
              <span className="text-black/35 text-base font-semibold">/100</span>
            </div>

            <div className={cx("rounded-xl border px-3 py-1 text-sm font-bold", pillTone)}>
              {rating.grade}
            </div>

            <div className="text-sm text-black/55">{label}</div>
          </div>

          <div className="mt-2 text-sm text-black/70">{rating.summary}</div>
        </div>

        <div className="shrink-0 rounded-xl border border-black/10 bg-[#F7F8F6] px-3 py-2 text-xs font-semibold text-black/70">
          {rating.verdict}
        </div>
      </div>

      <div className="relative mt-6">
        <div className="h-3 w-full rounded-full border border-black/10 bg-[#F7F8F6] overflow-hidden">
          <div
            className="h-full"
            style={{
              width: `${score}%`,
              background: THEME.accent,
              transition: "width 500ms ease",
            }}
          />
        </div>

        {[50, 70, 85].map((v) => (
          <div
            key={v}
            className="absolute -top-1 h-5 w-px bg-black/15"
            style={{ left: `${v}%` }}
          />
        ))}

        {[0, 50, 70, 85, 100].map((v) => (
          <div
            key={v}
            className="absolute top-5 text-xs text-black/40"
            style={{ left: `${v}%`, transform: "translateX(-50%)" }}
          >
            {v}
          </div>
        ))}
      </div>

      {rating.drivers && (
        <div className="mt-6 grid grid-cols-1 gap-3 md:grid-cols-3">
          <div className="rounded-2xl border border-black/10 bg-[#F7F8F6] p-4">
            <div className="text-[11px] uppercase tracking-wide text-black/45">
              Positives
            </div>
            <ul className="mt-2 space-y-1 text-sm text-black/70">
              {(rating.drivers.positives.length ? rating.drivers.positives : ["—"]).map((x, i) => (
                <li key={i} className="leading-snug">
                  • {x}
                </li>
              ))}
            </ul>
          </div>

          <div className="rounded-2xl border border-black/10 bg-[#F7F8F6] p-4">
            <div className="text-[11px] uppercase tracking-wide text-black/45">
              Watch-outs
            </div>
            <ul className="mt-2 space-y-1 text-sm text-black/70">
              {(rating.drivers.negatives.length ? rating.drivers.negatives : ["—"]).map((x, i) => (
                <li key={i} className="leading-snug">
                  • {x}
                </li>
              ))}
            </ul>
          </div>

          <div className="rounded-2xl border border-black/10 bg-[#F7F8F6] p-4">
            <div className="text-[11px] uppercase tracking-wide text-black/45">
              Unknown / Neutral
            </div>
            <ul className="mt-2 space-y-1 text-sm text-black/70">
              {(rating.drivers.neutrals.length ? rating.drivers.neutrals : ["—"]).map((x, i) => (
                <li key={i} className="leading-snug">
                  • {x}
                </li>
              ))}
            </ul>
          </div>
        </div>
      )}
    </div>
  );
}

/* ============================================================
   Parsing (memo sections)
============================================================ */

function parseSections(raw: string): Section[] {
  const cleaned = raw
    .replace(/^\s*RATING_JSON:\s*\{[\s\S]*?\}\s*/i, "")
    .replace(/^\s*RATING_JSON:\s*[\s\S]*?\n---\s*/i, "")
    .trim();

  const lines = cleaned.split(/\r?\n/);
  const sections: Section[] = [];
  let title = "Analysis";
  let body: string[] = [];

  const flush = () => {
    if (body.join("").trim()) sections.push({ title, body: body.join("\n").trim() });
    body = [];
  };

  for (const line of lines) {
    if (/^(##\s+|(\d{1,2}[\).])\s+|[A-Z][A-Z\s/&-]{3,40}:)\s*/.test(line.trim())) {
      flush();
      title = line
        .replace(/^##\s*/, "")
        .replace(/^\d{1,2}[\).]\s*/, "")
        .replace(/:$/, "")
        .trim();
    } else {
      body.push(line);
    }
  }
  flush();

  return sections.length ? sections : [{ title: "Analysis", body: cleaned }];
}

/* ============================================================
   Text helpers + strict extraction
============================================================ */

function normText(s: string) {
  return s.replace(/\u00A0/g, " ").trim();
}

function parseMoneyStrict(raw: string): MoneyHit | null {
  const s = raw.trim();
  if (/%/.test(s)) return null;

  const hasDollar = /\$/.test(s);
  const hasSuffix = /\b(k|m|mm|million|b|bn|billion)\b/i.test(s);
  const commaCount = (s.match(/,/g) || []).length;

  const cleaned = s.replace(/\$/g, "").replace(/,/g, "").trim().toLowerCase();

  const m = cleaned.match(
    /^(-?\d+(\.\d+)?)(\s*(k|m|mm|million|b|bn|billion))?$/i
  );
  if (!m) return null;

  const base = Number(m[1]);
  if (!Number.isFinite(base)) return null;

  const suf = (m[4] || "").toLowerCase();
  const mult =
    suf === "k"
      ? 1_000
      : suf === "m" || suf === "mm" || suf === "million"
      ? 1_000_000
      : suf === "b" || suf === "bn" || suf === "billion"
      ? 1_000_000_000
      : 1;

  const value = base * mult;

  const looksLikeMoney =
    hasDollar || hasSuffix || commaCount >= 1 || Math.abs(value) >= 1000;
  if (!looksLikeMoney) return null;

  return { raw: s, value, hasDollar, hasSuffix, commaCount };
}

function findMoneyAfterLabel(text: string, label: RegExp): MoneyHit | null {
  const t = normText(text);

  const re = new RegExp(
    `${label.source}[\\s\\S]{0,140}?(\\$\\s*-?\\d[\\d,]*(?:\\.\\d+)?\\s*(?:k|m|mm|million|b|bn|billion)?|\\b-?\\d[\\d,]*(?:\\.\\d+)?\\s*(?:k|m|mm|million|b|bn|billion)\\b)`,
    "i"
  );

  const m = t.match(re);
  if (!m?.[1]) return null;

  return parseMoneyStrict(m[1]);
}

function bestMoneyForField(
  hits: Array<MoneyHit | null>,
  range: { min: number; max: number }
): number | undefined {
  const vals = hits
    .filter(Boolean)
    .map((h) => (h as MoneyHit).value)
    .filter((v) => Number.isFinite(v) && v >= range.min && v <= range.max);

  if (!vals.length) return undefined;
  return Math.max(...vals);
}

function extractPercentNear(text: string, label: RegExp): number | undefined {
  const t = normText(text);
  const re = new RegExp(
    `${label.source}[\\s\\S]{0,120}?(\\d+(?:\\.\\d+)?)\\s*%`,
    "i"
  );
  const m = t.match(re);
  if (!m?.[1]) return undefined;
  const n = Number(m[1]);
  return Number.isFinite(n) ? n / 100 : undefined;
}

/* ============================================================
   Fair rating logic
============================================================ */

function hasAny(text: string, patterns: Array<string | RegExp>) {
  const t = text.toLowerCase();
  return patterns.some((p) =>
    typeof p === "string" ? t.includes(p) : p.test(t)
  );
}

function countHits(text: string, re: RegExp) {
  const m = text.toLowerCase().match(re);
  return m ? m.length : 0;
}

function findOwnerHours(text: string): number | undefined {
  const t = normText(text).toLowerCase();

  const range =
    t.match(/(\d{1,3})\s*(?:–|-|to)\s*(\d{1,3})\s*(?:hours|hrs)/i) ||
    t.match(/(\d{1,3})\s*(?:–|-|to)\s*(\d{1,3})\s*h\b/i);

  if (range) {
    const a = Number(range[1]);
    const b = Number(range[2]);
    if (Number.isFinite(a) && Number.isFinite(b)) return (a + b) / 2;
  }

  const single =
    t.match(/(\d{1,3})\s*(?:hours|hrs)\s*(?:\/|per)?\s*(?:week|wk)/i) ||
    t.match(/works?\s*(?:~|about)?\s*(\d{1,3})\s*(?:hours|hrs)/i);

  if (single) {
    const n = Number(single[1]);
    if (Number.isFinite(n)) return n;
  }

  return undefined;
}

function extractDscr(text: string): number | undefined {
  const t = normText(text);
  const m = t.match(/\bdscr\b\s*[:=]?\s*(\d+(?:\.\d+)?)\s*x?/i);
  if (!m?.[1]) return undefined;
  const n = Number(m[1]);
  return Number.isFinite(n) ? n : undefined;
}

function extractMultiple(text: string): number | undefined {
  const t = normText(text);
  const m =
    t.match(/\bmultiple\b[^\d]{0,20}(\d+(?:\.\d+)?)\s*x/i) ||
    t.match(/\bprice\s*\/\s*sde\b[^\d]{0,20}(\d+(?:\.\d+)?)\s*x/i) ||
    t.match(/\bsde\s*multiple\b[^\d]{0,20}(\d+(?:\.\d+)?)\s*x/i);
  if (!m?.[1]) return undefined;
  const n = Number(m[1]);
  return Number.isFinite(n) ? n : undefined;
}

function detectAddbacksRisk(text: string): { risk: number; note?: string } {
  const t = text.toLowerCase();

  const weak = [
    "lost revenue opportunity",
    "lost opportunity",
    "pro forma",
    "run-rate",
    "synergy",
    "management fee",
    "family payroll",
    "owner salary addback",
    "discretionary travel",
    "meals & entertainment",
    "meals and entertainment",
    "one-time",
    "non-recurring",
  ];

  const strong = [
    "one-time legal",
    "one-time lawsuit",
    "insurance claim",
    "owner personal expenses",
    "non-operating",
  ];

  const weakHits = weak.filter((w) => t.includes(w)).length;
  const strongHits = strong.filter((w) => t.includes(w)).length;

  const risk = clamp(0.15 * weakHits - 0.05 * strongHits, 0, 1);

  if (risk >= 0.55)
    return { risk, note: "Add-backs look aggressive / pro-forma heavy." };
  if (risk >= 0.25) return { risk, note: "Some add-backs need verification." };
  return { risk, note: undefined };
}

function underwriteClientSideRating(
  inputText: string,
  modelOutputText?: string
): Rating {
  const combined = normText(
    [inputText, modelOutputText].filter(Boolean).join("\n\n")
  );
  const t = combined.toLowerCase();

  const recurring = countHits(
    t,
    /\b(recurring|subscription|maintenance\s+contract|annual\s+contract|contracted|reoccurring)\b/g
  );
  const contracts = countHits(t, /\b(contract|renewal|retention|renew)\b/g);

  const diversification = hasAny(t, [
    "diversif",
    "broad customer base",
    "no single customer",
    "top 10 customers",
    "customer concentration below",
  ]);

  const concentration = hasAny(t, [
    "concentration",
    "top customer",
    "single customer",
    "key customer",
  ]);

  const seasonality = hasAny(t, ["seasonal", "weather-dependent", "highly seasonal"]);
  const lawsuits = hasAny(t, ["lawsuit", "litigation", "claim", "settlement"]);
  const union = hasAny(t, ["union"]);
  const churn = hasAny(t, ["churn", "cancellation", "declining renewals"]);
  const capexHeavy = hasAny(t, [
    "capex heavy",
    "fleet replacement",
    "equipment replacement",
    "significant capex",
    "large capital expenditure",
  ]);

  const ownerHours = findOwnerHours(combined);

  const ownerDependent = hasAny(t, [
    "owner handles",
    "owner-managed",
    "owner is the",
    "no manager",
    "no operations manager",
    "all handled by owner",
    "owner works",
    "owner runs",
  ]);

  const leaseShort = hasAny(t, [
    /lease\s+expires?\s+in\s+(?:\d{1,2})\s+months/i,
    "month-to-month",
    "no renewal terms",
    "short lease term",
  ]);

  const hasLossYears =
    hasAny(t, [/net income\s*[:=]?\s*\(\$?/i, /\bloss[-\s]?making\b/i]) ||
    countHits(t, /\(\$\s*\d[\d,]*/g) >= 1;

  const dscr = extractDscr(combined);
  const multiple = extractMultiple(combined);

  const sellerNotePct = extractPercentNear(combined, /seller\s+(?:note|financing)/i);
  const downPaymentPct = extractPercentNear(combined, /\bdown\s*payment\b/i);

  const sbaMentioned = hasAny(t, ["sba", "7(a)", "504"]);
  const sbaEligibleLanguage = hasAny(t, [
    "sba eligible",
    "sba-financeable",
    "financeable",
  ]);

  const addbacksRisk = detectAddbacksRisk(combined);

  const drivers = {
    positives: [] as string[],
    negatives: [] as string[],
    neutrals: [] as string[],
  };

  let cashflowQ = 0.55;
  if (hasLossYears) cashflowQ -= 0.18;
  cashflowQ -= 0.22 * addbacksRisk.risk;
  cashflowQ += clamp((contracts + recurring) / 10, 0, 0.18);
  cashflowQ = clamp(cashflowQ, 0.05, 0.95);

  if (!hasLossYears) drivers.positives.push("No explicit loss years detected.");
  if (hasLossYears)
    drivers.negatives.push("Loss / negative income appears in the materials.");
  if (addbacksRisk.note) drivers.negatives.push(addbacksRisk.note);
  if (contracts + recurring >= 3)
    drivers.positives.push("Contract/recurring language shows up repeatedly.");

  let durability = 0.55;
  durability += clamp(recurring / 8, 0, 0.18);
  durability += diversification ? 0.10 : -0.04;
  durability -= concentration ? 0.12 : 0;
  durability -= seasonality ? 0.08 : 0;
  durability -= churn ? 0.10 : 0;
  durability = clamp(durability, 0.05, 0.95);

  if (diversification) drivers.positives.push("Customer base appears diversified.");
  if (concentration) drivers.negatives.push("Customer concentration risk mentioned.");
  if (seasonality) drivers.negatives.push("Seasonality risk mentioned.");
  if (churn) drivers.negatives.push("Churn / cancellations mentioned.");

  let ops = 0.60;
  if (ownerHours !== undefined) {
    const hrs = clamp(ownerHours, 0, 80);
    const hrsPenalty = clamp((hrs - 35) / 45, 0, 1) * 0.22;
    const hrsBoost = clamp((25 - hrs) / 25, 0, 1) * 0.10;
    ops = ops - hrsPenalty + hrsBoost;
  } else {
    drivers.neutrals.push("Owner hours not specified.");
  }
  if (ownerDependent) ops -= 0.12;
  if (leaseShort) ops -= 0.08;
  if (capexHeavy) ops -= 0.08;
  if (union) ops -= 0.06;
  if (lawsuits) ops -= 0.08;
  ops = clamp(ops, 0.05, 0.95);

  if (ownerHours !== undefined)
    drivers.neutrals.push(
      `Owner time: ~${Math.round(ownerHours)} hrs/wk (if accurate).`
    );
  if (!ownerDependent) drivers.neutrals.push("Owner dependency not clearly flagged.");
  if (ownerDependent) drivers.negatives.push("Owner dependency language appears.");
  if (leaseShort) drivers.negatives.push("Lease horizon appears short / uncertain.");
  if (capexHeavy) drivers.negatives.push("Capex replacement burden mentioned.");
  if (lawsuits) drivers.negatives.push("Legal / litigation language appears.");

  let finance = 0.58;
  if (sbaMentioned) finance += 0.06;
  if (sbaEligibleLanguage) finance += 0.05;

  if (dscr !== undefined) {
    if (dscr >= 1.6) finance += 0.18;
    else if (dscr >= 1.4) finance += 0.14;
    else if (dscr >= 1.25) finance += 0.08;
    else if (dscr >= 1.1) finance -= 0.06;
    else finance -= 0.16;
    drivers.neutrals.push(
      `DSCR cited: ${dscr.toFixed(2)}x (if consistent with lender calc).`
    );
  } else {
    drivers.neutrals.push("DSCR not detected.");
  }

  if (sellerNotePct !== undefined) {
    if (sellerNotePct >= 0.1) finance += 0.06;
    if (sellerNotePct >= 0.2) finance += 0.04;
    drivers.positives.push(`Seller financing mentioned (${pct(sellerNotePct, 0)}).`);
  } else {
    drivers.neutrals.push("Seller financing not specified.");
  }

  if (downPaymentPct !== undefined) {
    if (downPaymentPct <= 0.1) finance -= 0.03;
    if (downPaymentPct >= 0.15) finance += 0.02;
  }

  finance = clamp(finance, 0.05, 0.95);

  let valuation = 0.56;
  if (multiple !== undefined) {
    if (multiple <= 3.0) valuation += 0.16;
    else if (multiple <= 3.8) valuation += 0.10;
    else if (multiple <= 4.5) valuation += 0.03;
    else if (multiple <= 5.25) valuation -= 0.08;
    else valuation -= 0.14;
    drivers.neutrals.push(`SDE multiple cited: ~${multiple.toFixed(1)}x (if correct).`);
  } else {
    drivers.neutrals.push("Multiple not detected.");
  }

  const noSellerFin = hasAny(t, [
    "seller financing: none",
    "no seller financing",
    "seller note: none",
  ]);
  if (noSellerFin) valuation -= 0.06;

  const assetSale = hasAny(t, ["asset sale preferred", "asset sale"]);
  if (assetSale) valuation += 0.04;

  valuation = clamp(valuation, 0.05, 0.95);

  if (assetSale)
    drivers.positives.push("Asset sale language present (usually cleaner risk profile).");
  if (noSellerFin) drivers.negatives.push("Seller financing appears unavailable.");

  const scoreFloat =
    cashflowQ * 0.30 +
    durability * 0.20 +
    ops * 0.15 +
    finance * 0.20 +
    valuation * 0.15;

  const missingCore =
    (dscr === undefined ? 1 : 0) +
    (multiple === undefined ? 1 : 0) +
    (ownerHours === undefined ? 1 : 0);

  const confidenceAdj = 1 - clamp(missingCore * 0.03, 0, 0.09);
  const score = clamp(Math.round(scoreFloat * 100 * confidenceAdj), 0, 100);

  const grade =
    score >= 97 ? "A+"
    : score >= 93 ? "A"
    : score >= 89 ? "A-"
    : score >= 85 ? "B+"
    : score >= 80 ? "B"
    : score >= 75 ? "B-"
    : score >= 70 ? "C+"
    : score >= 64 ? "C"
    : score >= 58 ? "C-"
    : score >= 50 ? "D"
    : "F";

  const verdict =
    score >= 90 ? "Strong — pursue"
    : score >= 78 ? "Good — diligence"
    : score >= 65 ? "Mixed — structure"
    : score >= 52 ? "High risk — price dependent"
    : "Avoid — do not pursue";

  const summary =
    score >= 90
      ? "Strong overall profile across cashflow, durability, operations, and financing."
      : score >= 78
      ? "Solid deal signals — validate diligence items and keep structure tight."
      : score >= 65
      ? "Mixed signals — you’ll need downside protection and clean verification."
      : score >= 52
      ? "Higher risk — proceed only with favorable pricing/structure and clear fixes."
      : "Weak profile — risk of value erosion without major deal/operational changes.";

  const uniq = (arr: string[]) => Array.from(new Set(arr)).slice(0, 6);
  const driversOut = {
    positives: uniq(drivers.positives),
    negatives: uniq(drivers.negatives),
    neutrals: uniq(drivers.neutrals),
  };

  return { score, grade, verdict, summary, drivers: driversOut };
}

/* ============================================================
   Projection math
============================================================ */

function amortMonthlyPayment(principal: number, annualRate: number, years: number) {
  const r = annualRate / 12;
  const n = years * 12;
  if (principal <= 0 || years <= 0) return 0;
  if (r <= 0) return principal / n;
  return (principal * r) / (1 - Math.pow(1 + r, -n));
}

function buildProjection({
  purchasePrice,
  revenue0,
  sde0,
  debtPct,
  interestRate,
  termYears,
  growthRate,
  marginRampPct,
  capexPct,
}: {
  purchasePrice: number;
  revenue0?: number;
  sde0?: number;
  debtPct: number;
  interestRate: number;
  termYears: number;
  growthRate: number;
  marginRampPct: number;
  capexPct: number;
}): { rows: ProjectionRow[]; equityInvested: number; breakEvenYear?: number } {
  const debt = purchasePrice * debtPct;
  const equityInvested = Math.max(0, purchasePrice - debt);

  const monthlyPmt = amortMonthlyPayment(debt, interestRate, termYears);
  const annualDebtService = monthlyPmt * 12;

  const rows: ProjectionRow[] = [];
  let cum = 0;
  let breakEvenYear: number | undefined;

  for (let y = 1; y <= 5; y++) {
    const rev =
      revenue0 !== undefined ? revenue0 * Math.pow(1 + growthRate, y - 1) : undefined;

    const baseSde =
      sde0 !== undefined
        ? sde0 * Math.pow(1 + growthRate, y - 1)
        : rev !== undefined
        ? rev * 0.12
        : undefined;

    const sde =
      baseSde !== undefined ? baseSde * Math.pow(1 + marginRampPct, y - 1) : undefined;

    const capex = rev !== undefined ? rev * capexPct : 0;

    const cashToEquity =
      sde !== undefined ? Math.max(0, sde - annualDebtService - capex) : undefined;

    const dscr =
      sde !== undefined && annualDebtService > 0 ? sde / annualDebtService : undefined;

    if (cashToEquity !== undefined) {
      cum += cashToEquity;
      if (breakEvenYear === undefined && equityInvested > 0 && cum >= equityInvested) {
        breakEvenYear = y;
      }
    }

    rows.push({
      year: y,
      revenue: rev,
      sde,
      debtService: annualDebtService,
      dscr,
      cashToEquity,
      cumCashToEquity: cashToEquity !== undefined ? cum : undefined,
    });
  }

  return { rows, equityInvested, breakEvenYear };
}

/* ============================================================
   Access helpers (FIX)
============================================================ */

// FIX 1: Never cache access checks (Next can cache fetches unexpectedly)
async function fetchAccessNoStore(): Promise<AccessResponse> {
  const res = await fetch("/api/me/access", {
    method: "GET",
    cache: "no-store",
    credentials: "include",
    headers: { "Cache-Control": "no-store" },
  });

  const data = (await res.json()) as AccessResponse;

  if (!res.ok) {
    const msg =
      (data as any)?.error ||
      (data?.ok === false ? "Unauthorized" : "Failed to load access");
    throw new Error(msg);
  }

  return data;
}

// FIX 2 (temporary safety): if backend entitlement is missing/incorrect,
// fall back to plan/isAdmin so Pro can actually use CIM Analyzer.
// (Still keep the entitlement as the primary signal.)
function computeCanUseCim(access: AccessResponse | null) {
  if (!access) return false;
  const ent = !!access.entitlements?.canUseCimAnalyzer;
  if (ent) return true;
  const plan = String(access.plan || "").toLowerCase();
  return access.isAdmin || plan === "pro" || plan === "pro_plus" || plan === "proplus";
}

/* ============================================================
   Page
============================================================ */

export default function CimAnalyzerPage() {
  const yearNow = useMemo(() => new Date().getFullYear(), []);

  const [accessLoading, setAccessLoading] = useState(true);
  const [accessErr, setAccessErr] = useState<string | null>(null);
  const [access, setAccess] = useState<AccessResponse | null>(null);

  // ✅ FIXED: don’t rely solely on entitlements when backend is mis-mapped
  const canUseCimAnalyzer = useMemo(() => computeCanUseCim(access), [access]);

  // limits
  const limit = access?.entitlements?.limits?.cimAnalyzer;
  const usedToday = limit?.usedToday ?? 0;
  const dailyLimit = limit?.dailyLimit ?? 3;
  const remaining = limit?.remaining ?? Math.max(0, dailyLimit - usedToday);
  const resetsAt = limit?.resetsAt;

  const [cimText, setCimText] = useState("");
  const [result, setResult] = useState("");
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const [hasAnalyzed, setHasAnalyzed] = useState(false);
  const [analyzedText, setAnalyzedText] = useState("");
  const [analyzedOutput, setAnalyzedOutput] = useState("");

  const [growthRatePct, setGrowthRatePct] = useState(6);
  const [debtPct, setDebtPct] = useState(0.85);
  const [interestPct, setInterestPct] = useState(10.5);
  const [termYears, setTermYears] = useState(10);
  const [marginRampPct, setMarginRampPct] = useState(0);
  const [capexPct, setCapexPct] = useState(1.5);

  // access load + refresh on focus
  useEffect(() => {
    let mounted = true;

    const load = async () => {
      try {
        setAccessLoading(true);
        setAccessErr(null);
        const data = await fetchAccessNoStore();
        if (mounted) setAccess(data);
      } catch (e: any) {
        if (mounted) setAccessErr(e?.message || "Failed to load access");
      } finally {
        if (mounted) setAccessLoading(false);
      }
    };

    load();

    const onFocus = () => load();
    window.addEventListener("focus", onFocus);

    return () => {
      mounted = false;
      window.removeEventListener("focus", onFocus);
    };
  }, []);

  const onChangeCim = (v: string) => {
    setCimText(v);
    if (hasAnalyzed) setHasAnalyzed(false);
  };

  const sections = useMemo(() => (result ? parseSections(result) : []), [result]);

  const rating = useMemo(() => {
    if (!hasAnalyzed) return null;
    return underwriteClientSideRating(analyzedText, analyzedOutput);
  }, [hasAnalyzed, analyzedText, analyzedOutput]);

  const extracted = useMemo(() => {
    if (!hasAnalyzed) {
      return {
        price: undefined as number | undefined,
        revenue: undefined as number | undefined,
        sde: undefined as number | undefined,
        sbaLoan: undefined as number | undefined,
      };
    }

    const blob = normText([analyzedText, analyzedOutput].filter(Boolean).join("\n\n"));

    const price = bestMoneyForField(
      [
        findMoneyAfterLabel(blob, /asking\s+price/i),
        findMoneyAfterLabel(blob, /purchase\s+price/i),
        findMoneyAfterLabel(blob, /\btransaction\s+value\b/i),
      ],
      { min: 50_000, max: 50_000_000 }
    );

    const sde = bestMoneyForField(
      [
        findMoneyAfterLabel(blob, /\bttm\s+sde\b/i),
        findMoneyAfterLabel(blob, /\bsde\b/i),
        findMoneyAfterLabel(blob, /seller[’']s discretionary earnings/i),
      ],
      { min: 10_000, max: 20_000_000 }
    );

    const revenue = bestMoneyForField(
      [findMoneyAfterLabel(blob, /\bttm\s+revenue\b/i), findMoneyAfterLabel(blob, /\brevenue\b/i)],
      { min: 50_000, max: 200_000_000 }
    );

    const sbaLoan = bestMoneyForField(
      [
        findMoneyAfterLabel(blob, /\bestimated\s+sba\s+loan\b/i),
        findMoneyAfterLabel(blob, /\bsba\s+loan\b/i),
      ],
      { min: 50_000, max: 100_000_000 }
    );

    const inferredPrice = price ?? (sbaLoan ? sbaLoan / 0.85 : undefined);
    return { price: inferredPrice, revenue, sde, sbaLoan };
  }, [hasAnalyzed, analyzedText, analyzedOutput]);

  const projection = useMemo(() => {
    if (!hasAnalyzed) return null;
    const price = extracted.price ?? 0;
    if (!price || price <= 0) return null;

    return buildProjection({
      purchasePrice: price,
      revenue0: extracted.revenue,
      sde0: extracted.sde,
      debtPct: clamp(debtPct, 0, 0.95),
      interestRate: Math.max(0, interestPct / 100),
      termYears: Math.max(1, termYears),
      growthRate: Math.max(-0.2, growthRatePct / 100),
      marginRampPct: clamp(marginRampPct / 100, -0.2, 0.2),
      capexPct: clamp(capexPct / 100, 0, 0.25),
    });
  }, [
    hasAnalyzed,
    extracted.price,
    extracted.revenue,
    extracted.sde,
    debtPct,
    interestPct,
    termYears,
    growthRatePct,
    marginRampPct,
    capexPct,
  ]);

  const limitBlocked = canUseCimAnalyzer && remaining <= 0;

  const analyze = async () => {
    // gate
    if (!canUseCimAnalyzer) {
      setErr("Upgrade required to use the CIM Analyzer.");
      return;
    }
    if (limitBlocked) {
      setErr(
        `Daily limit reached (${dailyLimit}/day). ${
          resetsAt ? `Resets ${new Date(resetsAt).toLocaleString()}.` : ""
        }`
      );
      return;
    }

    setErr(null);
    setLoading(true);
    setResult("");

    setHasAnalyzed(false);
    setAnalyzedText("");
    setAnalyzedOutput("");

    try {
      const res = await fetch("/api/cim", {
        method: "POST",
        cache: "no-store",
        credentials: "include",
        headers: {
          "Content-Type": "application/json",
          "Cache-Control": "no-store",
        },
        body: JSON.stringify({ text: cimText }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data?.error || "Failed");

      const out = String(data.result ?? "");
      setResult(out);

      setAnalyzedText(cimText);
      setAnalyzedOutput(out);
      setHasAnalyzed(true);

      // refresh access so remaining/used updates immediately
      try {
        const fresh = await fetchAccessNoStore();
        setAccess(fresh);
      } catch {}
    } catch (e: any) {
      setErr(e.message);
    } finally {
      setLoading(false);
    }
  };

  const GateUpgrade = () => (
    <div className="rounded-2xl border border-black/10 bg-white p-6 shadow-sm">
      <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div>
          <div className="text-sm font-bold text-[#111827]">CIM Analyzer is Pro</div>
          <div className="mt-1 text-sm text-black/60">
            Upgrade to unlock CIM underwriting, score, memo sections, and projections.
          </div>
        </div>
        <a
          href="/pricing"
          className="inline-flex items-center justify-center rounded-xl px-4 py-2 text-sm font-bold text-white shadow-sm hover:opacity-95"
          style={{ background: THEME.accent }}
        >
          View Pricing
        </a>
      </div>
    </div>
  );

  const GateLimit = () => (
    <div className="rounded-2xl border border-black/10 bg-white p-6 shadow-sm">
      <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div>
          <div className="text-sm font-bold text-[#111827]">Daily limit reached</div>
          <div className="mt-1 text-sm text-black/60">
            You’ve used <span className="font-semibold text-[#111827]">{usedToday}</span> /{" "}
            <span className="font-semibold text-[#111827]">{dailyLimit}</span> CIM analyses today.
            {resetsAt ? (
              <>
                {" "}
                Resets{" "}
                <span className="font-semibold text-[#111827]">
                  {new Date(resetsAt).toLocaleString()}
                </span>
                .
              </>
            ) : null}
          </div>
        </div>
        <a
          href="/pricing"
          className="inline-flex items-center justify-center rounded-xl px-4 py-2 text-sm font-bold text-white shadow-sm hover:opacity-95"
          style={{ background: THEME.accent }}
        >
          Upgrade for higher limits
        </a>
      </div>
    </div>
  );

  return (
    <main className={cx("min-h-screen", THEME.pageBg, THEME.text)}>
      {/* HERO */}
      <section className="relative overflow-hidden">
        <div className="absolute inset-0" style={{ background: THEME.green }} />
        <div className="absolute inset-0 bg-[radial-gradient(900px_420px_at_15%_15%,rgba(255,255,255,0.14),transparent_60%),radial-gradient(900px_420px_at_85%_10%,rgba(110,231,183,0.12),transparent_55%),linear-gradient(to_bottom,rgba(0,0,0,0.20),rgba(0,0,0,0.30))]" />
        <div className="absolute -bottom-1 left-0 right-0 h-20 bg-gradient-to-b from-transparent to-[#F7F8F6]" />

        <div className="relative mx-auto max-w-7xl px-6 pt-10 pb-8">
          <div className="flex flex-col gap-5 md:flex-row md:items-end md:justify-between">
            <div className="max-w-2xl">
              <div className="inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/10 px-3 py-1 text-xs text-white/80 backdrop-blur">
                <span className="h-1.5 w-1.5 rounded-full bg-emerald-300/80" />
                Underwrite in minutes
              </div>

              <h1 className="mt-4 text-4xl font-extrabold tracking-tight text-white md:text-5xl">
                CIM Analyzer
              </h1>

              <p className="mt-3 text-sm text-white/70">
                Paste a CIM and get an underwriting score + memo-style analysis.
              </p>

              <div className="mt-5 flex flex-wrap gap-3">
                <StatPill label="Mode" value="Instant Memo" />
                <StatPill label="Output" value="Score + Sections" />
                <StatPill label="Year" value={String(yearNow)} />
                <StatPill
                  label="Daily limit"
                  value={accessLoading ? "—" : `${usedToday}/${dailyLimit}`}
                />
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-3">
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

      {/* ACCESS LOADING / ERROR / GATES */}
      <section className="mx-auto max-w-7xl px-6 pt-6 space-y-4">
        {accessLoading ? (
          <div className="rounded-2xl border border-black/10 bg-white p-6 shadow-sm text-sm text-black/60">
            Checking subscription…
          </div>
        ) : accessErr ? (
          <div className="rounded-2xl border border-black/10 bg-white p-6 shadow-sm">
            <div className="text-sm font-bold text-[#111827]">Couldn’t load access</div>
            <div className="mt-1 text-sm text-black/60">{accessErr}</div>
          </div>
        ) : !canUseCimAnalyzer ? (
          <GateUpgrade />
        ) : limitBlocked ? (
          <GateLimit />
        ) : null}
      </section>

      {/* RATING */}
      <section className="mx-auto max-w-7xl px-6 pt-6">
        <RatingCard rating={rating} hasAnalyzed={hasAnalyzed} loading={loading} />
      </section>

      {/* INPUT + OUTPUT */}
      <section className="mx-auto max-w-7xl px-6 pt-6 grid gap-6 lg:grid-cols-[420px_1fr]">
        <LightCard
          title="CIM Input"
          desc="Paste the CIM text. We’ll generate a memo-style output."
          right={
            <div className="rounded-xl border border-black/10 bg-[#F7F8F6] px-3 py-1 text-xs text-black/60">
              API: /api/cim
            </div>
          }
        >
          <textarea
            value={cimText}
            onChange={(e) => onChangeCim(e.target.value)}
            className="h-[380px] w-full rounded-2xl border border-black/10 bg-white p-4 text-sm text-[#111827] outline-none placeholder:text-black/35 focus:ring-2 focus:ring-[#2F5D50]/15"
            placeholder="Paste CIM text here…"
            disabled={!canUseCimAnalyzer || limitBlocked}
          />

          <button
            onClick={analyze}
            disabled={
              accessLoading ||
              !canUseCimAnalyzer ||
              limitBlocked ||
              loading ||
              !cimText.trim()
            }
            className={cx(
              "mt-4 w-full rounded-xl py-3 font-bold text-white shadow-sm transition",
              accessLoading || !canUseCimAnalyzer || limitBlocked || loading || !cimText.trim()
                ? "opacity-60 cursor-not-allowed"
                : "hover:opacity-95"
            )}
            style={{ background: THEME.accent }}
          >
            {accessLoading
              ? "Checking access…"
              : !canUseCimAnalyzer
              ? "Upgrade to Analyze"
              : limitBlocked
              ? `Daily limit reached (${dailyLimit}/day)`
              : loading
              ? "Analyzing…"
              : `Analyze CIM (${remaining} left today)`}
          </button>

          {err && <div className="mt-3 text-sm text-red-600">{err}</div>}

          {canUseCimAnalyzer && !accessLoading && (
            <div className="mt-3 text-xs text-black/55">
              Today:{" "}
              <span className="font-semibold text-[#111827]">{usedToday}</span> used /{" "}
              <span className="font-semibold text-[#111827]">{dailyLimit}</span> limit •{" "}
              <span className="font-semibold text-[#111827]">{remaining}</span> remaining
              {resetsAt ? (
                <>
                  {" "}
                  • Resets{" "}
                  <span className="font-semibold text-[#111827]">
                    {new Date(resetsAt).toLocaleString()}
                  </span>
                </>
              ) : null}
            </div>
          )}

          <div className="mt-3 text-xs text-black/45">
            Tip: include “Transaction Overview / Asking Price”, “Financials”, “Customers”, and
            “Operations / Owner Role” for best results.
          </div>
        </LightCard>

        <LightCard
          title="Analysis Output"
          desc="We split your memo into sections automatically."
          right={
            <button
              onClick={() => navigator.clipboard.writeText(result || "")}
              disabled={!result}
              className={cx(
                "rounded-xl border px-3 py-1 text-xs font-semibold",
                result
                  ? "border-black/10 bg-white hover:bg-black/[0.03] text-[#111827]"
                  : "border-black/10 bg-[#F7F8F6] text-black/35 cursor-not-allowed"
              )}
            >
              Copy
            </button>
          }
        >
          {!result ? (
            <div className="text-black/50 text-sm">
              {loading ? "Analyzing…" : "No analysis yet."}
            </div>
          ) : (
            <div className="space-y-4">
              {sections.map((s, i) => (
                <div key={i} className="rounded-2xl border border-black/10 bg-[#F7F8F6] p-4">
                  <div className="font-bold text-[#111827]">{s.title}</div>
                  <div className="mt-1 text-sm text-black/70 whitespace-pre-wrap">
                    {s.body}
                  </div>
                </div>
              ))}
            </div>
          )}
        </LightCard>
      </section>

      {/* 5-YEAR PREDICTIONS */}
      <section className="mx-auto max-w-7xl px-6 pb-14 pt-6">
        <LightCard
          title="5-Year Predictions"
          desc="Simple underwriting projection (editable assumptions). Break-even = cumulative cash to equity ≥ equity invested."
          right={
            hasAnalyzed && projection ? (
              <div className="rounded-xl border border-black/10 bg-[#F7F8F6] px-3 py-1 text-xs text-black/60">
                Est. Price:{" "}
                <span className="font-semibold text-[#111827]">{money(extracted.price)}</span>
              </div>
            ) : (
              <div className="rounded-xl border border-black/10 bg-[#F7F8F6] px-3 py-1 text-xs text-black/60">
                {loading ? "Waiting for analysis…" : "Run analysis to unlock projections"}
              </div>
            )
          }
        >
          <div className="grid grid-cols-1 gap-3 md:grid-cols-12">
            <div className="md:col-span-3">
              <label className="block text-xs text-black/50">Annual growth</label>
              <input
                type="number"
                value={growthRatePct}
                onChange={(e) => setGrowthRatePct(Number(e.target.value) || 0)}
                className="mt-1 w-full rounded-xl border border-black/10 bg-white px-3 py-2 text-sm outline-none hover:bg-black/[0.02]"
                disabled={!hasAnalyzed}
              />
              <div className="mt-1 text-[11px] text-black/45">%</div>
            </div>

            <div className="md:col-span-3">
              <label className="block text-xs text-black/50">Debt % (SBA)</label>
              <input
                type="number"
                step="0.01"
                value={debtPct}
                onChange={(e) =>
                  setDebtPct(clamp(Number(e.target.value) || 0, 0, 0.95))
                }
                className="mt-1 w-full rounded-xl border border-black/10 bg-white px-3 py-2 text-sm outline-none hover:bg-black/[0.02]"
                disabled={!hasAnalyzed}
              />
              <div className="mt-1 text-[11px] text-black/45">0.85 = 85%</div>
            </div>

            <div className="md:col-span-3">
              <label className="block text-xs text-black/50">Interest rate</label>
              <input
                type="number"
                value={interestPct}
                onChange={(e) => setInterestPct(Number(e.target.value) || 0)}
                className="mt-1 w-full rounded-xl border border-black/10 bg-white px-3 py-2 text-sm outline-none hover:bg-black/[0.02]"
                disabled={!hasAnalyzed}
              />
              <div className="mt-1 text-[11px] text-black/45">%</div>
            </div>

            <div className="md:col-span-3">
              <label className="block text-xs text-black/50">Loan term</label>
              <input
                type="number"
                value={termYears}
                onChange={(e) => setTermYears(Math.max(1, Number(e.target.value) || 10))}
                className="mt-1 w-full rounded-xl border border-black/10 bg-white px-3 py-2 text-sm outline-none hover:bg-black/[0.02]"
                disabled={!hasAnalyzed}
              />
              <div className="mt-1 text-[11px] text-black/45">years</div>
            </div>

            <div className="md:col-span-3">
              <label className="block text-xs text-black/50">SDE ramp</label>
              <input
                type="number"
                value={marginRampPct}
                onChange={(e) => setMarginRampPct(Number(e.target.value) || 0)}
                className="mt-1 w-full rounded-xl border border-black/10 bg-white px-3 py-2 text-sm outline-none hover:bg-black/[0.02]"
                disabled={!hasAnalyzed}
              />
              <div className="mt-1 text-[11px] text-black/45">% applied each year</div>
            </div>

            <div className="md:col-span-3">
              <label className="block text-xs text-black/50">Capex reserve</label>
              <input
                type="number"
                value={capexPct}
                onChange={(e) => setCapexPct(Number(e.target.value) || 0)}
                className="mt-1 w-full rounded-xl border border-black/10 bg-white px-3 py-2 text-sm outline-none hover:bg-black/[0.02]"
                disabled={!hasAnalyzed}
              />
              <div className="mt-1 text-[11px] text-black/45">% of revenue</div>
            </div>

            <div className="md:col-span-6">
              <div className="rounded-2xl border border-black/10 bg-[#F7F8F6] p-4">
                <div className="text-xs text-black/50">Detected from analysis</div>
                <div className="mt-2 grid grid-cols-1 gap-2 sm:grid-cols-3">
                  <div>
                    <div className="text-[11px] uppercase tracking-wide text-black/45">
                      Asking Price
                    </div>
                    <div className="text-sm font-bold text-[#111827]">
                      {hasAnalyzed ? money(extracted.price) : "—"}
                    </div>
                  </div>
                  <div>
                    <div className="text-[11px] uppercase tracking-wide text-black/45">
                      Revenue
                    </div>
                    <div className="text-sm font-bold text-[#111827]">
                      {hasAnalyzed ? money(extracted.revenue) : "—"}
                    </div>
                  </div>
                  <div>
                    <div className="text-[11px] uppercase tracking-wide text-black/45">
                      SDE
                    </div>
                    <div className="text-sm font-bold text-[#111827]">
                      {hasAnalyzed ? money(extracted.sde) : "—"}
                    </div>
                  </div>
                </div>
                <div className="mt-2 text-xs text-black/45">
                  If SDE or Revenue is missing, we estimate SDE as 12% of revenue (conservative).
                </div>
              </div>
            </div>
          </div>

          {!hasAnalyzed ? (
            <div className="mt-6 text-sm text-black/55">Run analysis to unlock projections.</div>
          ) : !projection ? (
            <div className="mt-6 text-sm text-black/55">
              We couldn’t detect a valid{" "}
              <span className="font-semibold text-[#111827]">Asking Price</span>. Add a line like{" "}
              <span className="font-semibold text-[#111827]">“Asking Price: $2,600,000”</span>.
            </div>
          ) : (
            <div className="mt-6 space-y-4">
              <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
                <div className="rounded-2xl border border-black/10 bg-[#F7F8F6] p-4">
                  <div className="text-xs text-black/50">Equity invested</div>
                  <div className="mt-1 text-lg font-extrabold text-[#111827]">
                    {money(projection.equityInvested)}
                  </div>
                </div>

                <div className="rounded-2xl border border-black/10 bg-[#F7F8F6] p-4">
                  <div className="text-xs text-black/50">Break-even</div>
                  <div className="mt-1 text-lg font-extrabold text-[#111827]">
                    {projection.breakEvenYear ? `Year ${projection.breakEvenYear}` : "Not within 5 years"}
                  </div>
                  <div className="mt-1 text-xs text-black/45">
                    Based on cumulative cash to equity after debt + capex reserve
                  </div>
                </div>

                <div className="rounded-2xl border border-black/10 bg-[#F7F8F6] p-4">
                  <div className="text-xs text-black/50">Year 1 DSCR</div>
                  <div className="mt-1 text-lg font-extrabold text-[#111827]">
                    {projection.rows[0]?.dscr !== undefined ? `${projection.rows[0].dscr.toFixed(2)}x` : "—"}
                  </div>
                  <div className="mt-1 text-xs text-black/45">DSCR = SDE / annual debt service</div>
                </div>
              </div>

              <div className="w-full overflow-x-auto">
                <table className="w-full min-w-[860px] border-separate border-spacing-0">
                  <thead>
                    <tr className="text-xs uppercase tracking-wide text-black/50">
                      {["Year", "Revenue", "SDE", "Debt Service", "DSCR", "Cash to Equity", "Cumulative"].map(
                        (h) => (
                          <th
                            key={h}
                            className="sticky top-0 z-10 whitespace-nowrap border-b border-black/10 bg-white/90 backdrop-blur px-3 py-3 text-right first:text-left"
                          >
                            {h}
                          </th>
                        )
                      )}
                    </tr>
                  </thead>
                  <tbody>
                    {projection.rows.map((r) => (
                      <tr
                        key={r.year}
                        className="border-t border-black/10 hover:bg-black/[0.02] transition-colors"
                      >
                        <td className="whitespace-nowrap border-b border-black/10 px-3 py-3 text-left text-sm font-semibold text-[#111827]">
                          {r.year}
                        </td>
                        <td className="whitespace-nowrap border-b border-black/10 px-3 py-3 text-right text-sm text-black/60">
                          {money(r.revenue)}
                        </td>
                        <td className="whitespace-nowrap border-b border-black/10 px-3 py-3 text-right text-sm font-semibold text-[#111827]">
                          {money(r.sde)}
                        </td>
                        <td className="whitespace-nowrap border-b border-black/10 px-3 py-3 text-right text-sm text-black/60">
                          {money(r.debtService)}
                        </td>
                        <td className="whitespace-nowrap border-b border-black/10 px-3 py-3 text-right text-sm text-black/60">
                          {r.dscr !== undefined ? `${r.dscr.toFixed(2)}x` : "—"}
                        </td>
                        <td className="whitespace-nowrap border-b border-black/10 px-3 py-3 text-right text-sm text-black/60">
                          {money(r.cashToEquity)}
                        </td>
                        <td className="whitespace-nowrap border-b border-black/10 px-3 py-3 text-right text-sm text-black/60">
                          {money(r.cumCashToEquity)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <div className="text-xs text-black/45">
                Notes: simplified screening model. Real underwriting should include taxes, working capital,
                owner replacement, and normalized capex.
              </div>
            </div>
          )}
        </LightCard>
      </section>

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
