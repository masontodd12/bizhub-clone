"use client";

import { useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";

export default function BillingSuccessPage() {
  const sp = useSearchParams();
  const sessionId = sp.get("session_id");

  const [loading, setLoading] = useState(true);
  const [resp, setResp] = useState<any>(null);
  const [err, setErr] = useState<string | null>(null);

  async function runSync() {
    setLoading(true);
    setErr(null);
    setResp(null);

    if (!sessionId) {
      setLoading(false);
      setErr("Missing session_id in URL.");
      return;
    }

    try {
      const r = await fetch("/api/stripe/sync", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ session_id: sessionId }),
        cache: "no-store",
      });

      const data = await r.json().catch(() => ({}));

      if (!r.ok || !data?.ok) {
        throw new Error(data?.error || `Sync failed (${r.status})`);
      }

      setResp(data);
    } catch (e: any) {
      setErr(e?.message || "Sync failed");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    runSync();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sessionId]);

  return (
    <main className="min-h-screen bg-black text-white px-6 py-12">
      <div className="mx-auto max-w-2xl rounded-2xl border border-white/10 bg-white/5 p-6">
        <h1 className="text-2xl font-extrabold">Payment successful ✅</h1>
        <p className="mt-2 text-sm text-white/70">
          We’re activating your subscription now.
        </p>

        <div className="mt-6 rounded-xl border border-white/10 bg-black/40 p-4 text-xs">
          <div className="text-white/60">session_id</div>
          <div className="mt-1 break-all">{sessionId ?? "(missing)"}</div>
        </div>

        {loading && (
          <p className="mt-6 text-sm text-white/70">Syncing with Stripe…</p>
        )}

        {err && (
          <div className="mt-6 rounded-xl border border-red-400/30 bg-red-500/10 p-4">
            <p className="text-sm font-semibold text-red-200">Sync error</p>
            <p className="mt-1 text-xs text-red-200/80 break-all">{err}</p>

            <button
              onClick={runSync}
              className="mt-4 w-full rounded-xl bg-white px-4 py-2 text-sm font-bold text-black hover:bg-white/90"
            >
              Retry activation
            </button>
          </div>
        )}

        {resp && (
          <div className="mt-6 rounded-xl border border-white/10 bg-black/40 p-4">
            <p className="text-sm font-semibold">✅ Sync response</p>
            <pre className="mt-3 overflow-auto text-xs text-white/80">
{JSON.stringify(resp, null, 2)}
            </pre>
          </div>
        )}

        <div className="mt-6 flex gap-3">
          <a
            href="/account/billing"
            className="rounded-xl bg-white px-4 py-2 text-sm font-bold text-black hover:bg-white/90"
          >
            Go to Billing
          </a>
          <a
            href="/pricing"
            className="rounded-xl border border-white/15 px-4 py-2 text-sm font-semibold text-white hover:bg-white/5"
          >
            Back to Pricing
          </a>
        </div>
      </div>
    </main>
  );
}
