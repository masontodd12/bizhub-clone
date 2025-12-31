"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";

export default function BillingPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  async function cancelNow() {
    if (loading) return;

    setLoading(true);
    setMsg(null);

    try {
      const res = await fetch("/api/stripe/cancel", {
        method: "POST",
        credentials: "include",
        cache: "no-store",
        headers: { "Content-Type": "application/json" },
      });

      const data = await res.json().catch(() => ({} as any));
      if (!res.ok || !data?.ok) throw new Error(data?.error || "Cancel failed");

      await fetch("/api/me/access", {
        credentials: "include",
        cache: "no-store",
      }).catch(() => {});

      router.refresh();
      router.push("/"); // ✅ go home after cancel
    } catch (e: any) {
      setMsg(e?.message || "Cancel failed");
      setLoading(false);
    }
  }

  return (
    <div className="min-h-[calc(100vh-56px)] bg-[#F7F8F6] px-6 py-10 text-[#111827]">
      <div className="mx-auto max-w-3xl">
        {/* Top row */}
        <div className="mb-6 flex items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight">Billing</h1>
            <p className="mt-1 text-sm text-black/60">Manage your subscription.</p>
          </div>

          <Link
            href="/"
            className="rounded-full border border-black/10 bg-white px-4 py-2 text-xs font-semibold hover:bg-black/[0.03] transition"
          >
            Back to Home
          </Link>
        </div>

        {/* Centered card */}
        <div className="mx-auto max-w-2xl rounded-2xl border border-[#2F5D50]/20 bg-white shadow-sm">
          <div className="border-b border-black/10 px-6 py-5">
            <div className="inline-flex items-center gap-2 rounded-full border border-[#2F5D50]/25 bg-[#2F5D50]/10 px-3 py-1 text-xs font-semibold text-[#2F5D50]">
              Underwrite Pro
            </div>

            <h2 className="mt-3 text-lg font-semibold">Cancel membership</h2>
            <p className="mt-1 text-sm text-black/60">
              Cancel immediately and downgrade to Free.
            </p>
          </div>

          <div className="px-6 py-6">
            <div className="rounded-xl border border-[#2F5D50]/20 bg-[#2F5D50]/[0.06] p-4">
              <p className="text-sm">
                You’ll lose Pro features right away after canceling.
              </p>
              <p className="mt-1 text-xs text-black/60">
                You can always re-upgrade later from the pricing page.
              </p>
            </div>

            <div className="mt-5 flex items-center justify-between">
              <Link
                href="/pricing"
                className="text-sm font-semibold text-[#2F5D50] hover:opacity-80 transition"
              >
                View plans
              </Link>

              <button
                onClick={cancelNow}
                disabled={loading}
                className="rounded-xl bg-[#2F5D50] px-5 py-2.5 text-sm font-semibold text-white hover:bg-[#3F7668] transition disabled:opacity-60 disabled:hover:bg-[#2F5D50]"
              >
                {loading ? "Canceling..." : "Cancel Membership"}
              </button>
            </div>

            {msg && (
              <div className="mt-4 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
                {msg}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
