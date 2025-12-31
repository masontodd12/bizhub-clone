"use client";

import { useState } from "react";

export default function BillingPage() {
  const [loading, setLoading] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  async function cancelNow() {
    setLoading(true);
    setMsg(null);
    try {
      const res = await fetch("/api/stripe/cancel", { method: "POST" });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || "Cancel failed");
      setMsg("Canceled. Your plan is now Free.");
    } catch (e: any) {
      setMsg(e.message || "Cancel failed");
    } finally {
      setLoading(false);
      // optional: force refresh so entitlements re-fetch
      window.location.reload();
    }
  }

  return (
    <div className="mx-auto max-w-xl p-6">
      <h1 className="text-2xl font-semibold">Billing</h1>
      <p className="mt-2 text-sm opacity-80">
        Manage your subscription.
      </p>

      <div className="mt-6 rounded-xl border p-4">
        <h2 className="font-medium">Cancel membership</h2>
        <p className="mt-1 text-sm opacity-80">
          Cancel immediately and downgrade to Free.
        </p>

        <button
          onClick={cancelNow}
          disabled={loading}
          className="mt-4 rounded-lg border px-4 py-2 text-sm font-medium disabled:opacity-50"
        >
          {loading ? "Canceling..." : "Cancel Membership"}
        </button>

        {msg && <p className="mt-3 text-sm">{msg}</p>}
      </div>
    </div>
  );
}
