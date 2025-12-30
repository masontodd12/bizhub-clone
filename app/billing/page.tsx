"use client";

import { useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";

export default function BillingSuccessPage() {
  const sp = useSearchParams();
  const sessionId = sp.get("session_id");

  const [status, setStatus] = useState<"loading" | "ok" | "error">("loading");
  const [message, setMessage] = useState<string>("Finalizing your subscription…");

  async function sync() {
    if (!sessionId) {
      setStatus("error");
      setMessage("Missing session_id. Please return to pricing and try again.");
      return;
    }

    try {
      setStatus("loading");
      setMessage("Finalizing your subscription…");

      const res = await fetch("/api/stripe/sync", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ session_id: sessionId }),
      });

      const data = await res.json().catch(() => ({}));

      if (!res.ok || !data?.ok) {
        throw new Error(data?.error || "Sync failed");
      }

      setStatus("ok");
      setMessage("Subscription activated ✅ Redirecting…");

      // small delay so user sees success
      setTimeout(() => {
        window.location.href = "/account/billing";
      }, 600);
    } catch (e: any) {
      setStatus("error");
      setMessage(
        e?.message ||
          "Could not activate subscription yet. Please retry in a moment."
      );
    }
  }

  useEffect(() => {
    sync();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sessionId]);

  return (
    <main className="min-h-screen bg-[#F7F8F6] px-6 py-12 text-[#111827]">
      <div className="mx-auto max-w-xl rounded-2xl border border-black/10 bg-white p-6 shadow-sm">
        <h1 className="text-2xl font-extrabold tracking-tight">
          Payment successful ✅
        </h1>

        <p className="mt-2 text-sm text-black/60">{message}</p>

        {status === "loading" && (
          <div className="mt-5 h-2 w-full overflow-hidden rounded-full bg-black/10">
            <div className="h-full w-1/2 animate-pulse rounded-full bg-[#2F5D50]" />
          </div>
        )}

        {status === "error" && (
          <div className="mt-6 space-y-3">
            <button
              onClick={sync}
              className="inline-flex w-full items-center justify-center rounded-xl bg-[#2F5D50] px-4 py-2 text-sm font-bold text-white hover:bg-[#3F7668]"
            >
              Retry activation
            </button>

            <a
              href="/account/billing"
              className="block text-center text-sm font-semibold text-black/60 hover:text-black"
            >
              Go to billing
            </a>
          </div>
        )}

        {status === "ok" && (
          <a
            href="/account/billing"
            className="mt-6 inline-flex w-full items-center justify-center rounded-xl bg-[#2F5D50] px-4 py-2 text-sm font-bold text-white hover:bg-[#3F7668]"
          >
            Continue to billing
          </a>
        )}
      </div>
    </main>
  );
}
