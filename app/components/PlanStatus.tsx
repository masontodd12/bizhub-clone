"use client";

import { useEffect, useState } from "react";

type AccessResponse =
  | {
      ok: true;
      plan: string;
      entitlements?: any;
      limits?: {
        dealAnalyze?: {
          usedToday?: number;
        };
      };
    }
  | {
      ok: false;
      error: string;
    };

export default function PlanStatus() {
  const [data, setData] = useState<{
    plan: string;
    dailyDealCount: number;
  } | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      let res: Response;

      try {
        res = await fetch("/api/me/access", {
          credentials: "include",
        });
      } catch {
        return;
      }

      if (!res.ok) return;

      let json: AccessResponse;
      try {
        json = await res.json();
      } catch {
        return;
      }

      if (!json.ok || cancelled) return;

      const used = json.entitlements?.limits?.dealAnalyze?.usedToday ?? 0;

      setData({
        plan: json.plan,
        dailyDealCount: used,
      });
    }

    load();
    return () => {
      cancelled = true;
    };
  }, []);

  if (!data || data.plan === "free") return null;

  const isProPlus = data.plan === "pro_plus";
  const limit = isProPlus ? "∞" : "3";

  return (
    <div
      className="flex cursor-pointer items-center gap-2 rounded-full border border-black/10 bg-white px-3 py-1.5 text-xs hover:bg-black/[0.03]"
      title="Manage subscription"
    >
      <span className="rounded-full bg-[#2F5D50] px-2 py-0.5 text-[10px] font-bold text-white">
        {isProPlus ? "Pro Plus" : "Pro"}
      </span>

      <span className="text-black/60">
        {data.dailyDealCount} / {limit}
      </span>

      <span className="text-black/40">Manage</span>
    </div>
  );
}
