"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

export default function PlanStatus() {
  const [data, setData] = useState<{
    plan: string;
    dailyDealCount: number;
  } | null>(null);

  useEffect(() => {
    fetch("/api/me/access")
      .then((r) => r.json())
      .then((d) => setData(d));
  }, []);

  if (!data || data.plan === "free") return null;

  const isProPlus = data.plan === "pro_plus";
  const limit = isProPlus ? "∞" : "3";

  return (
    <Link
      href="/billing"
      className="flex items-center gap-2 rounded-full border border-black/10 bg-white px-3 py-1.5 text-xs hover:bg-black/[0.03]"
      title="Manage subscription"
    >
      <span className="rounded-full bg-[#2F5D50] px-2 py-0.5 text-[10px] font-bold text-white">
        {isProPlus ? "Pro Plus" : "Pro"}
      </span>

      <span className="text-black/60">
        {data.dailyDealCount} / {limit}
      </span>
    </Link>
  );
}
