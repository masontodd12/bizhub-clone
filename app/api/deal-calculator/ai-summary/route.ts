// app/api/deal-calculator/ai-summary/route.ts

import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { prisma } from "@/src/lib/prisma";
import { getEntitlements } from "@/src/lib/entitlements";
import OpenAI from "openai";

export const runtime = "nodejs";

/* =========================
   Helpers
========================= */

function safeNumber(v: unknown, fallback: number | null = null): number | null {
  if (v === null || v === undefined || v === "") return fallback;
  const n = Number(v);
  return Number.isFinite(n) ? n : fallback;
}

function clampScore(v: unknown) {
  const n = Math.round(Number(v ?? 1));
  return Math.max(1, Math.min(10, n));
}

function safeHostname(url?: string | null) {
  if (!url) return null;
  try {
    return new URL(url.startsWith("http") ? url : `https://${url}`).hostname;
  } catch {
    return null;
  }
}

function pctDelta(a: number, b: number) {
  if (!Number.isFinite(a) || !Number.isFinite(b) || b === 0) return null;
  return (a - b) / b;
}

type AiResp = {
  score: number;
  scoreBreakdown?: {
    debtService: number;
    valuation: number;
    marginQuality: number;
    structure: number;
    dataQuality: number;
  } | null;
  topWeaknesses: string[];
  summary: string;
};

function fallbackResp(msg: string): AiResp {
  return {
    score: 1,
    scoreBreakdown: null,
    topWeaknesses: [
      msg,
      "Try again in a moment, or refresh the page.",
      "If this keeps happening, check server logs for /api/deal-calculator/ai-summary.",
    ],
    summary: msg,
  };
}

/* =========================
   Route
========================= */

export async function POST(req: Request) {
  try {
    // ✅ FIX: auth() must be awaited in your version
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const access =
      (await prisma.userAccess.findUnique({
        where: { userId },
        select: { plan: true, isAdmin: true },
      })) ?? ({ plan: "free", isAdmin: false } as any);

    const ent = getEntitlements(access);

    if (!ent.isPro && !ent.isProPlus && !ent.isAdmin) {
      return NextResponse.json({ error: "Subscription required" }, { status: 403 });
    }

    const body = (await req.json()) as any;

    const askingPrice = safeNumber(body.askingPrice, null);
    const revenue = safeNumber(body.revenue, null);
    const sde = safeNumber(body.sde, null);

    const dscr = safeNumber(body.dscr, null);
    const cashflowMultiple = safeNumber(body.cashflowMultiple, null);
    const revenueMultiple = safeNumber(body.revenueMultiple, null);
    const profitMarginPct = safeNumber(body.profitMarginPct, null);
    const upfrontCash = safeNumber(body.upfrontCash, null);

    const benchObj: any =
      body?.benchmark && typeof body.benchmark === "object" ? body.benchmark : null;

    const benchCfMultiple = benchObj ? safeNumber(benchObj.price_to_sde_multiple, null) : null;
    const benchRevMultiple = benchObj
      ? safeNumber(benchObj.price_to_revenue_multiple, null)
      : null;

    const benchMarginDec = benchObj ? safeNumber(benchObj.cashflow_margin_pct, null) : null;
    const benchMarginPct = benchMarginDec === null ? null : benchMarginDec * 100;

    const cfVsBench =
      cashflowMultiple !== null && benchCfMultiple !== null
        ? pctDelta(cashflowMultiple, benchCfMultiple)
        : null;

    const revVsBench =
      revenueMultiple !== null && benchRevMultiple !== null
        ? pctDelta(revenueMultiple, benchRevMultiple)
        : null;

    const prompt = {
      industry: String(body.industry ?? "Unknown"),
      listingHost: safeHostname(body.listingUrl ?? null),

      askingPrice,
      revenue,
      sde,

      dscr,
      cashflowMultiple,
      revenueMultiple,
      profitMarginPct,
      upfrontCash,

      benchmark: benchObj
        ? {
            price_to_sde_multiple: benchCfMultiple,
            price_to_revenue_multiple: benchRevMultiple,
            cashflow_margin_pct: benchMarginPct,
            median_sde: safeNumber(benchObj.median_sde, null),
            median_revenue: safeNumber(benchObj.median_revenue, null),
            median_asking_price: safeNumber(benchObj.median_asking_price, null),
          }
        : null,

      derived: {
        cfMultiple_vs_benchmark_pct: cfVsBench === null ? null : Math.round(cfVsBench * 100),
        revMultiple_vs_benchmark_pct: revVsBench === null ? null : Math.round(revVsBench * 100),
      },
    };

    if (askingPrice === null || sde === null) {
      const resp: AiResp = {
        score: 1,
        scoreBreakdown: null,
        topWeaknesses: [
          "Missing required inputs (Asking Price and/or SDE).",
          "Add at least Asking Price + SDE to generate a real score.",
          "Without SDE, debt coverage and valuation can’t be assessed.",
        ],
        summary: "Enter Asking Price and SDE to generate an underwriting score and top weaknesses.",
      };
      return NextResponse.json(resp);
    }

    const key = process.env.OPENAI_API_KEY;
    if (!key) {
      return NextResponse.json(fallbackResp("Server is missing OPENAI_API_KEY."), {
        status: 500,
      });
    }

    const system = `
You are a blunt, professional small-business underwriting assistant.
Score deals from 1–10 using a STRICT rubric.

CALIBRATION:
- 10/10 must be RARE (<5% of deals).
- Most deals should score 4–7.

HARD CAPS (must follow):
- If dscr is null: cap score at 6.
- If dscr < 1.00: score MUST be 1–2.
- If 1.00 <= dscr < 1.15: score MUST be <= 3.
- If 1.15 <= dscr < 1.25: score MUST be <= 6.
- If dscr >= 1.25: score can exceed 6 ONLY if valuation and structure are strong.

VALUATION (use benchmark when present):
- If cashflowMultiple > benchmark by 20%+: subtract 2 points.
- If cashflowMultiple > benchmark by 40%+: subtract 4 points.
- If cashflowMultiple below benchmark by 10%+: add 1 point (still obey DSCR caps).
- If benchmark is missing: include a weakness about missing comps.

MARGIN QUALITY (profitMarginPct):
- <10% => -2
- 10–20% => -1
- 20–30% => 0
- >30% => +1

MISSING DATA:
- If revenue is null: -1 and include a weakness about incomplete revenue/margin.

Return ONLY valid JSON with:
{
  "score": integer 1-10,
  "scoreBreakdown": {
    "debtService": number 0-10,
    "valuation": number 0-10,
    "marginQuality": number 0-10,
    "structure": number 0-10,
    "dataQuality": number 0-10
  },
  "topWeaknesses": [3-5 short bullets],
  "summary": "one short paragraph; include DSCR and multiples when available"
}
`.trim();

    const openai = new OpenAI({ apiKey: key });

    let raw = "";
    try {
      const completion = await openai.chat.completions.create({
        model: "gpt-4o-mini",
        temperature: 0.1,
        response_format: { type: "json_object" },
        messages: [
          { role: "system", content: system },
          { role: "user", content: JSON.stringify(prompt, null, 2) },
        ],
      });

      raw = completion.choices?.[0]?.message?.content ?? "";
    } catch (e) {
      console.error("OpenAI call failed:", e);
      return NextResponse.json(fallbackResp("AI service error while generating analysis."), {
        status: 502,
      });
    }

    if (!raw || raw.trim().length === 0) {
      return NextResponse.json(fallbackResp("AI returned an empty response."), { status: 502 });
    }

    let parsed: any = null;
    try {
      parsed = JSON.parse(raw);
    } catch (e) {
      console.error("AI JSON parse failed. Raw:", raw);
      return NextResponse.json(fallbackResp("AI returned invalid JSON."), { status: 502 });
    }

    const resp: AiResp = {
      score: clampScore(parsed?.score),
      scoreBreakdown:
        parsed && typeof parsed.scoreBreakdown === "object" ? parsed.scoreBreakdown : null,
      topWeaknesses: Array.isArray(parsed?.topWeaknesses)
        ? parsed.topWeaknesses.slice(0, 5).map(String)
        : ["No weaknesses returned (AI output missing topWeaknesses)."],
      summary: String(parsed?.summary ?? "").trim() || "No summary returned by AI.",
    };

    return NextResponse.json(resp);
  } catch (err) {
    console.error("ai-summary route crashed:", err);
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}
