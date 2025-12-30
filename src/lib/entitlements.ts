// src/lib/entitlements.ts

export type Entitlements = {
  canUseCimAnalyzer: boolean;
  canUseDealCalculator: boolean;

  // ✅ NEW: Analyze button entitlement (Pro OR Pro+)
  canAnalyzeDeal: boolean;

  // Pro+ only
  canUse5YearProjection: boolean;

  canSaveDeals: boolean;

  isFree: boolean;
  isPro: boolean;
  isProPlus: boolean;
  isAdmin: boolean;

  // optional limits filled by /api/me/access
  limits?: {
    cimAnalyzer?: {
      dailyLimit: number;
      usedToday: number;
      remaining: number;
      resetsAt?: string;
    };
    dealAnalyze?: {
      dailyLimit: number | null; // null = unlimited
      usedToday: number;
      remaining: number | null;
      resetsAt?: string;
    };
    [k: string]: any;
  };
};

export function getEntitlements(params: { plan: string; isAdmin: boolean }): Entitlements {
  const { plan, isAdmin } = params;

  // Admin gets everything
  if (isAdmin) {
    return {
      canUseCimAnalyzer: true,
      canUseDealCalculator: true,
      canAnalyzeDeal: true,
      canUse5YearProjection: true,
      canSaveDeals: true,

      isFree: false,
      isPro: true,
      isProPlus: true,
      isAdmin: true,
    };
  }

  const isFree = plan === "free";
  const isPro = plan === "pro";
  const isProPlus = plan === "pro_plus";

  return {
    canUseCimAnalyzer: isPro || isProPlus,
    canUseDealCalculator: isPro || isProPlus,

    // ✅ Pro can Analyze, Pro+ can Analyze
    canAnalyzeDeal: isPro || isProPlus,

    // ✅ Pro+ only
    canUse5YearProjection: isProPlus,

    canSaveDeals: isPro || isProPlus,

    isFree,
    isPro,
    isProPlus,
    isAdmin: false,
  };
}
