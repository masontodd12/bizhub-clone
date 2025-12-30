"use client";

import Link from "next/link";
import React, { useEffect, useMemo, useState } from "react";
import { useUser } from "@clerk/nextjs";

function money(n?: number | null) {
  if (n === undefined || n === null || !Number.isFinite(n)) return "—";
  return n.toLocaleString(undefined, {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  });
}
function num(n?: number | null, digits = 0) {
  if (n === undefined || n === null || !Number.isFinite(n)) return "—";
  return n.toLocaleString(undefined, { maximumFractionDigits: digits });
}
function pct(dec?: number | null, digits = 1) {
  if (dec === undefined || dec === null || !Number.isFinite(dec)) return "—";
  return `${(dec * 100).toFixed(digits)}%`;
}

function fmtDateTime(iso?: string) {
  if (!iso) return "—";
  try {
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return iso;
    return d.toLocaleString(undefined, {
      year: "numeric",
      month: "short",
      day: "2-digit",
      hour: "numeric",
      minute: "2-digit",
    });
  } catch {
    return iso;
  }
}

function Card({
  title,
  value,
  sub,
  right,
}: {
  title: string;
  value: string;
  sub?: string;
  right?: string;
}) {
  return (
    <div className="rounded-2xl border border-black/10 bg-white p-4 shadow-sm">
      <div className="flex items-start justify-between gap-2">
        <div className="text-xs uppercase tracking-wide text-black/50">
          {title}
        </div>
        {right ? (
          <div className="rounded-lg border border-black/10 bg-[#F7F8F6] px-2 py-0.5 text-[11px] text-black/60">
            {right}
          </div>
        ) : null}
      </div>
      <div className="mt-1 text-lg font-extrabold tracking-tight text-[#111827]">
        {value}
      </div>
      {sub ? <div className="mt-1 text-xs text-black/50">{sub}</div> : null}
    </div>
  );
}

type DealRow = {
  id: string;
  title: string | null;
  year: number;
  createdAt: string;
  payload: any;
};

export default function AccountDealsPage() {
  const { user, isLoaded } = useUser();

  const [deals, setDeals] = useState<DealRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const [deletingId, setDeletingId] = useState<string | null>(null);

  // (optional) local fallback key from your old system
  const storageKey = useMemo(() => {
    if (!user?.id) return null;
    return `underwrite:lastSavedDeal:${user.id}`;
  }, [user?.id]);

  async function loadDeals() {
    setErr(null);
    setLoading(true);
    try {
      const res = await fetch("/api/deals", { method: "GET" });
      if (!res.ok) {
        const txt = await res.text().catch(() => "");
        throw new Error(`Failed to load deals (${res.status}) ${txt}`);
      }
      const data = (await res.json()) as { deals?: DealRow[] };

      const list = Array.isArray(data.deals) ? data.deals : [];
      setDeals(list);
      setErr(
        list.length
          ? null
          : "No saved deals yet. Save a deal from the Deal Calculator first."
      );
    } catch (e: any) {
      // Optional fallback: if DB fetch fails, show the local last-saved deal (old behavior)
      if (storageKey) {
        try {
          const raw = localStorage.getItem(storageKey);
          if (raw) {
            const localPayload = JSON.parse(raw);
            setDeals([
              {
                id: "local",
                title: localPayload?.dealInput?.industry ?? "Saved Deal",
                year: Number(localPayload?.dealInput?.year ?? 2024),
                createdAt: localPayload?.createdAt ?? new Date().toISOString(),
                payload: localPayload,
              },
            ]);
            setErr("Showing locally saved deal (DB fetch failed).");
            setLoading(false);
            return;
          }
        } catch {
          // ignore
        }
      }

      setDeals([]);
      setErr(String(e?.message ?? "Failed to load saved deals."));
    } finally {
      setLoading(false);
    }
  }

  async function deleteDeal(id: string) {
    // local fallback “deal”
    if (id === "local") {
      const ok = window.confirm("Delete this saved deal? This cannot be undone.");
      if (!ok) return;

      if (storageKey) localStorage.removeItem(storageKey);
      setDeals((prev) => prev.filter((d) => d.id !== id));
      return;
    }

    const ok = window.confirm("Delete this saved deal? This cannot be undone.");
    if (!ok) return;

    setDeletingId(id);
    try {
      const res = await fetch(`/api/deals/${id}`, { method: "DELETE" });
      if (!res.ok) {
        const txt = await res.text().catch(() => "");
        throw new Error(`Delete failed (${res.status}) ${txt}`);
      }
      setDeals((prev) => prev.filter((d) => d.id !== id));
    } catch (e: any) {
      alert(String(e?.message ?? "Failed to delete deal."));
    } finally {
      setDeletingId(null);
    }
  }

  useEffect(() => {
    if (!isLoaded) return;
    if (!user) return;
    loadDeals();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isLoaded, user?.id]);

  // newest first (API already does this, but this keeps UI safe)
  const sortedDeals = useMemo(() => {
    return [...deals].sort((a, b) => {
      const ta = new Date(a.createdAt).getTime();
      const tb = new Date(b.createdAt).getTime();
      return tb - ta;
    });
  }, [deals]);

  return (
    <main className="min-h-[calc(100vh-56px)] bg-[#F7F8F6] text-[#111827]">
      <div className="mx-auto max-w-7xl px-6 py-10">
        <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
          <div>
            <div className="text-xs uppercase tracking-wide text-black/45">
              Account
            </div>
            <h1 className="mt-1 text-2xl font-extrabold tracking-tight">
              Saved Deals
            </h1>
            <p className="mt-1 text-sm text-black/55">
              All deals saved to this account.
            </p>
          </div>

          <div className="flex flex-wrap gap-2">
            <Link
              href="/deal-calculator"
              className="rounded-xl bg-[#2F5D50] px-4 py-2 text-sm font-bold text-white hover:bg-[#3F7668]"
            >
              New Deal
            </Link>

            <button
              onClick={loadDeals}
              className="rounded-xl border border-black/10 bg-white px-4 py-2 text-sm font-semibold hover:bg-black/[0.03]"
            >
              Refresh
            </button>
          </div>
        </div>

        {!isLoaded ? (
          <div className="mt-6 rounded-2xl border border-black/10 bg-white p-6 shadow-sm">
            <div className="text-sm font-bold">Loading…</div>
            <div className="mt-2 text-sm text-black/70">Getting your account.</div>
          </div>
        ) : null}

        {isLoaded && !user ? (
          <div className="mt-6 rounded-2xl border border-black/10 bg-white p-6 shadow-sm">
            <div className="text-sm font-bold">Not signed in</div>
            <div className="mt-2 text-sm text-black/70">
              Please log in to view saved deals.
            </div>
            <div className="mt-4">
              <Link
                href="/login"
                className="inline-flex rounded-xl bg-[#2F5D50] px-4 py-2 text-sm font-bold text-white hover:bg-[#3F7668]"
              >
                Log in
              </Link>
            </div>
          </div>
        ) : null}

        {isLoaded && user ? (
          <>
            {loading ? (
              <div className="mt-6 rounded-2xl border border-black/10 bg-white p-6 shadow-sm">
                <div className="text-sm font-bold">Loading saved deals…</div>
                <div className="mt-2 text-sm text-black/70">
                  Fetching from your account.
                </div>
              </div>
            ) : null}

            {!loading && err ? (
              <div className="mt-6 rounded-2xl border border-black/10 bg-white p-6 shadow-sm">
                <div className="text-sm font-bold">
                  {sortedDeals.length ? "Note" : "Nothing here yet"}
                </div>
                <div className="mt-2 text-sm text-black/70">{err}</div>
                {!sortedDeals.length ? (
                  <div className="mt-4">
                    <Link
                      href="/deal-calculator"
                      className="inline-flex rounded-xl bg-[#2F5D50] px-4 py-2 text-sm font-bold text-white hover:bg-[#3F7668]"
                    >
                      Go save a deal
                    </Link>
                  </div>
                ) : null}
              </div>
            ) : null}

            {!loading && sortedDeals.length ? (
              <div className="mt-6 space-y-4">
                {sortedDeals.map((d) => {
                  const input = d.payload?.dealInput ?? {};
                  const computed = d.payload?.computed ?? {};
                  const listingUrl: string | null =
                    typeof input?.listingUrl === "string" &&
                    input.listingUrl.trim().length
                      ? input.listingUrl.trim()
                      : null;

                  const dscr = computed?.dscr ?? null;
                  const isDeleting = deletingId === d.id;

                  return (
                    <div
                      key={d.id}
                      className="rounded-2xl border border-black/10 bg-white p-6 shadow-sm"
                    >
                      <div className="flex flex-col gap-2 md:flex-row md:items-end md:justify-between">
                        <div>
                          <div className="text-sm font-bold">
                            {d.title || input?.industry || "Saved Deal"}
                          </div>
                          {/* ✅ removed "• Year 2024" */}
                          <div className="mt-1 text-xs text-black/50">
                            Saved {fmtDateTime(d.createdAt)}
                          </div>
                        </div>

                        <div className="flex flex-wrap items-center gap-2">
                          {listingUrl ? (
                            <a
                              href={listingUrl}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="text-sm font-semibold text-[#2F5D50] hover:underline"
                            >
                              View listing →
                            </a>
                          ) : null}

                          <button
                            onClick={() => deleteDeal(d.id)}
                            disabled={isDeleting}
                            className="rounded-xl border border-black/10 bg-white px-3 py-1.5 text-sm font-semibold text-black/70 hover:bg-black/[0.03] disabled:opacity-60"
                            title="Delete saved deal"
                          >
                            {isDeleting ? "Deleting…" : "Delete"}
                          </button>
                        </div>
                      </div>

                      <div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-4">
                        <Card title="Asking" value={money(input?.askingPrice ?? null)} />
                        <Card title="Revenue" value={money(input?.revenue ?? null)} />
                        <Card title="SDE (Adj.)" value={money(computed?.sdeAdjusted ?? null)} />
                        <Card
                          title="DSCR"
                          value={dscr == null ? "—" : num(dscr, 2)}
                          right={
                            dscr == null
                              ? ""
                              : dscr >= 1.25
                              ? "Healthy"
                              : dscr >= 1.15
                              ? "Borderline"
                              : "Risk"
                          }
                        />
                      </div>

                      <div className="mt-3 grid gap-3 md:grid-cols-3">
                        <Card
                          title="Cash Flow Multiple"
                          value={
                            computed?.cfMultiple == null
                              ? "—"
                              : `${num(computed.cfMultiple, 2)}x`
                          }
                        />
                        <Card
                          title="Profit Margin"
                          value={
                            computed?.margin == null ? "—" : pct(computed.margin, 1)
                          }
                        />
                        <Card
                          title="Upfront Cash"
                          value={money(computed?.upfrontCash ?? null)}
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : null}
          </>
        ) : null}
      </div>
    </main>
  );
}
