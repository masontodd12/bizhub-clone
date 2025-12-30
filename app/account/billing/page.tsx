// app/billing/success/page.tsx
export default function BillingSuccessPage() {
  return (
    <main style={{ padding: 40 }}>
      <h1>Payment successful ✅</h1>
      <p>Your subscription is active.</p>
      <a href="/account/billing">Go to billing</a>
    </main>
  );
}
