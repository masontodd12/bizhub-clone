import { NextResponse } from "next/server";
import OpenAI from "openai";
import { auth } from "@clerk/nextjs/server";
import { prisma } from "@/src/lib/prisma";
import { getEntitlements } from "@/src/lib/entitlements";

export const runtime = "nodejs"; // important for file uploads + openai sdk
export const dynamic = "force-dynamic";

function stripRatingJson(text: string) {
  // Hard-kill any legacy "RATING_JSON" blocks if the model ever slips
  return (text || "")
    .replace(/RATING_JSON:\s*\{[\s\S]*?\}\s*---?/gi, "")
    .replace(/RATING_JSON:\s*\{[\s\S]*?\}/gi, "")
    .trim();
}

function buildPrompt(mode: "fast" | "deep", text: string) {
  return `
You are an M&A underwriter. Produce a concise underwriting memo.

CRITICAL RULES (must follow):
- DO NOT output any score, grade, rating, verdict, or recommendation label.
- DO NOT output JSON.
- DO NOT write "RATING_JSON".
- Return ONLY the memo sections below, in plain text, using these headings EXACTLY.

## Executive Summary
## Key Metrics
## Business Overview
## Financial Quality
## Customers & Concentration
## Operations & Owner Dependency
## Risks / Red Flags
## Diligence Questions
## Deal Structure Thoughts
## Investment Memo

Mode: ${mode}

CIM TEXT:
${text}
`.trim();
}

/* =========================
   Usage helpers
========================= */

function startOfDayUTC(d = new Date()) {
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
}

function dailyLimitForPlan(plan: string, isAdmin: boolean) {
  if (isAdmin) return Number.MAX_SAFE_INTEGER;
  if (plan === "pro_plus") return 10;
  if (plan === "pro") return 3;
  return 0;
}

export async function POST(req: Request) {
  try {
    // ✅ AUTH
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // ✅ LOAD USER ACCESS (plan/admin)
    const ua = await prisma.userAccess.findUnique({ where: { userId } });
    const plan = String(ua?.plan ?? "free");
    const isAdmin = Boolean(ua?.isAdmin ?? false);

    // ✅ ENTITLEMENTS
    const entitlements = getEntitlements({ plan, isAdmin });
    if (!entitlements.canUseCimAnalyzer) {
      return NextResponse.json(
        { error: "Upgrade required to use the CIM Analyzer." },
        { status: 403 }
      );
    }

    // ✅ LIMIT CHECK (server-enforced)
    const feature = "cimAnalyzer";
    const day = startOfDayUTC();
    const dailyLimit = dailyLimitForPlan(plan, isAdmin);

    const usage = await prisma.featureUsage.findUnique({
      where: { userId_feature_day: { userId, feature, day } },
    });

    const usedToday = usage?.count ?? 0;
    if (!isAdmin && usedToday >= dailyLimit) {
      return NextResponse.json(
        { error: `Daily limit reached (${dailyLimit}/day).` },
        { status: 429 }
      );
    }

    // ✅ OPENAI KEY
    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) {
      return NextResponse.json(
        { error: "Missing OPENAI_API_KEY (set it in Vercel env vars)" },
        { status: 500 }
      );
    }

    const openai = new OpenAI({ apiKey });
    const contentType = req.headers.get("content-type") || "";

    let text = "";
    let mode: "fast" | "deep" = "deep";

    // JSON mode: { text, mode }
    if (contentType.includes("application/json")) {
      const body = await req.json();
      text = String(body?.text ?? "");
      mode = body?.mode === "fast" ? "fast" : "deep";

      if (!text.trim()) {
        return NextResponse.json({ error: "Missing text" }, { status: 400 });
      }
    }
    // Form-data mode: file upload
    else if (contentType.includes("multipart/form-data")) {
      const form = await req.formData();
      const file = form.get("file");

      if (!(file instanceof File)) {
        return NextResponse.json({ error: "Missing file" }, { status: 400 });
      }

      const bytes = await file.arrayBuffer();
      const buffer = Buffer.from(bytes);

      // NOTE: This is not real PDF extraction. It just interprets bytes as utf8.
      // (Later we can add proper PDF text extraction if you want.)
      text = buffer.toString("utf8").slice(0, 200000);

      if (!text.trim()) {
        return NextResponse.json(
          { error: "Could not read text from file (empty/unsupported)" },
          { status: 400 }
        );
      }

      mode = "deep";
    } else {
      return NextResponse.json(
        { error: `Content-Type not supported: ${contentType}` },
        { status: 415 }
      );
    }

    // ✅ RUN ANALYSIS
    const prompt = buildPrompt(mode, text);

    const resp = await openai.responses.create({
      model: "gpt-4.1-mini",
      input: prompt,
    });

    const out = stripRatingJson(resp.output_text || "");

    // ✅ INCREMENT USAGE ONLY ON SUCCESS (non-admin)
    if (!isAdmin) {
      await prisma.featureUsage.upsert({
        where: { userId_feature_day: { userId, feature, day } },
        create: { userId, feature, day, count: 1 },
        update: { count: { increment: 1 } },
      });
    }

    return NextResponse.json(
      { result: out },
      {
        headers: {
          "Cache-Control": "no-store",
        },
      }
    );
  } catch (err: any) {
    return NextResponse.json(
      { error: err?.message ?? "Server error" },
      { status: 500 }
    );
  }
}
