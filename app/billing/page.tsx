"use client";

export default function BillingPage() {
  return (
    <main className="min-h-screen bg-[#F7F8F6] px-6 py-12 text-[#111827]">
      <div className="mx-auto max-w-xl rounded-2xl border border-black/10 bg-white p-6 shadow-sm">
        <h1 className="text-2xl font-extrabold tracking-tight">Billing</h1>
        <p className="mt-2 text-sm text-black/60">
          Manage your subscription, invoices, and payment method in Stripe.
        </p>

        <a
          href="/api/billing-portal"
          className="mt-6 inline-flex w-full items-center justify-center rounded-xl bg-[#2F5D50] px-4 py-2 text-sm font-bold text-white hover:bg-[#3F7668]"
        >
          Open Billing Portal
        </a>

        <a
          href="/account/deals"
          className="mt-3 block text-center text-sm font-semibold text-black/60 hover:text-black"
        >
          Back to account
        </a>
      </div>
    </main>
  );
}
