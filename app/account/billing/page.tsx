"use client";

export default function BillingPage() {
  const openPortal = async () => {
    try {
      const res = await fetch("/api/billing-portal", { method: "POST" });
      const data = await res.json();

      if (!res.ok) {
        if (data?.redirectTo) window.location.href = data.redirectTo;
        else alert(data?.error ?? "Failed to open billing portal");
        return;
      }

      if (data?.url) {
        window.location.href = data.url;
      } else {
        alert("No billing portal URL returned");
      }
    } catch (e: any) {
      alert(e?.message ?? "Something went wrong");
    }
  };

  return (
    <div className="mx-auto max-w-xl p-6">
      <h1 className="text-2xl font-semibold">Billing</h1>
      <p className="mt-2 text-sm text-black/60">
        Manage your subscription, invoices, and payment method in Stripe.
      </p>

      <button
        type="button"
        onClick={openPortal}
        className="mt-6 w-full rounded-xl bg-[#2F5D50] px-4 py-2 text-white hover:bg-[#3F7668]"
      >
        Open Billing Portal
      </button>

      <a
        href="/account"
        className="mt-4 block text-center text-sm text-black/50 hover:underline"
      >
        Back to account
      </a>
    </div>
  );
}
