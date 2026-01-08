import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { prisma } from "@/src/lib/prisma";
import { getEntitlements } from "@/src/lib/entitlements";
import OpenAI from "openai";

export const runtime = "nodejs";

/* =========================
   Helpers
========================= */

function safeNumber(v: any, fallback: number | null = null) {
  if (v === null || v === undefined || v === "") return fallback;
  const n = Number(v);
  return Number.isFinite(n) ? n : fallback;
}

function clampScore(v: any) {
  const n = Math.round(Number(v ?? 1));
  return Math.max(1, Math.min(10, n));
}

/* =========================
   Route
========================= */

export async function POST(req: Request) {
  console.log("AI SUMMARY ROUTE HIT");

  try {
    // 🔒 AUTH (bulletproof)
    let userId: string | null = null;

    try {
      const a = await auth();
      userId = a.userId ?? null;
    } catch (e) {
      console.error("Clerk auth error:", e);
      return NextResponse.json({ error: "Auth failed" }, { status: 401 });
    }

    if (!userId) {
      return NextResponse.json({ error: "Not signed in" }, { status: 401 });
    }

    // 💳 Access
    const access =
      (await prisma.userAccess.findUnique({
        where: { userId },
        select: { plan: true, isAdmin: true },
      })) ?? { plan: "free", isAdmin: false };

    const ent = getEntitlements(access);

    if (!ent.isPro && !ent.isProPlus && !ent.isAdmin) {
      return NextResponse.json({ error: "Subscription required" }, { status: 403 });
    }

    // 📦 Body
    const body = await req.json();

    const askingPrice = safeNumber(body.askingPrice);
    const sde = safeNumber(body.sde);
    const dscr = safeNumber(body.dscr);

    if (askingPrice === null || sde === null) {
      return NextResponse.json({
        score: 1,
        scoreBreakdown: null,
        topWeaknesses: [
          "Missing Asking Price or SDE",
          "Cannot evaluate valuation or debt service",
        ],
        summary: "Add Asking Price and SDE to analyze this deal.",
      });
    }

    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) {
      return NextResponse.json(
        { error: "OPENAI_API_KEY missing" },
        { status: 500 }
      );
    }

    // 🤖 AI
    const openai = new OpenAI({ apiKey });

    let raw = "";
    try {
      const completion = await openai.chat.completions.create({
        model: "gpt-4o-mini",
        temperature: 0.1,
        response_format: { type: "json_object" },
        messages: [
          {
            role: "system",
            content:
              "Return ONLY valid JSON with keys: score (1-10), topWeaknesses (array), summary (string).",
          },
          {
            role: "user",
            content: JSON.stringify({
              askingPrice,
              sde,
              dscr,
            }),
          },
        ],
      });

      raw = completion.choices?.[0]?.message?.content ?? "";
    } catch (e) {
      console.error("OpenAI error:", e);
      return NextResponse.json(
        { error: "AI failed" },
        { status: 502 }
      );
    }

    if (!raw) {
      return NextResponse.json(
        { error: "Empty AI response" },
        { status: 502 }
      );
    }

    let parsed: any;
    try {
      parsed = JSON.parse(raw);
    } catch (e) {
      console.error("Bad AI JSON:", raw);
      return NextResponse.json(
        { error: "Invalid AI JSON" },
        { status: 502 }
      );
    }

    return NextResponse.json({
      score: clampScore(parsed.score),
      scoreBreakdown: null,
      topWeaknesses: Array.isArray(parsed.topWeaknesses)
        ? parsed.topWeaknesses
        : ["AI did not return weaknesses"],
      summary: String(parsed.summary ?? "No summary"),
    });
  } catch (err) {
    console.error("AI SUMMARY CRASH:", err);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
