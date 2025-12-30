// app/page.tsx
import Link from "next/link";
import { SignedIn, SignedOut, SignIn } from "@clerk/nextjs";

export default function HomePage() {
  return (
    <main className="min-h-screen bg-[#F7F8F6] text-[#111827]">
      {/* ✅ If logged out: force auth UI on home */}
      <SignedOut>
        <section className="mx-auto max-w-6xl px-6 pt-24 pb-24">
          <div className="grid gap-10 md:grid-cols-2 md:items-start">
            <div className="max-w-[560px]">
              <p className="mb-4 inline-flex items-center gap-2 rounded-full border border-black/10 bg-white px-4 py-1 text-xs text-black/70 shadow-sm">
                <span className="h-1.5 w-1.5 rounded-full bg-[#2F5D50]" />
                Market Data + Deal Tools
              </p>

              <h1 className="text-4xl font-extrabold leading-tight md:text-5xl">
                Analyze any Business{" "}
                <span className="text-black/55">in Seconds</span>
              </h1>

              <p className="mt-5 text-base leading-relaxed text-black/70">
                You need an account to access the data, calculator, and CIM tools.
                Sign in or create an account to continue.
              </p>

              <div className="mt-9 flex flex-wrap gap-6 text-xs text-black/50">
                <div>✓ Cleaned CSV benchmarks</div>
                <div>✓ Year filtering</div>
                <div>✓ Deal scoring ready</div>
              </div>
            </div>

            {/* Auth card */}
            <div className="rounded-2xl border border-black/10 bg-white p-6 shadow-sm">
              <div className="mb-3">
                <p className="text-xs text-black/50">Underwrite</p>
                <p className="mt-1 text-lg font-bold">Log in / Sign up</p>
                <p className="mt-1 text-sm text-black/60">
                  Continue to the dashboard after signing in.
                </p>
              </div>

              <SignIn redirectUrl="/" />

              <div className="mt-4 text-xs text-black/45">
                By continuing, you agree to our{" "}
                <Link href="/about" className="text-[#2F5D50] hover:opacity-80">
                  terms
                </Link>{" "}
                and{" "}
                <Link href="/about" className="text-[#2F5D50] hover:opacity-80">
                  privacy
                </Link>
                .
              </div>
            </div>
          </div>
        </section>
      </SignedOut>

      {/* ✅ If logged in: show normal homepage */}
      <SignedIn>
        {/* Hero */}
        <section className="mx-auto max-w-6xl px-6 pt-24 pb-24">
          <div className="grid gap-16 md:grid-cols-2 md:items-center">
            {/* Left */}
            <div className="max-w-[560px]">
              <p className="mb-4 inline-flex items-center gap-2 rounded-full border border-black/10 bg-white px-4 py-1 text-xs text-black/70 shadow-sm">
                <span className="h-1.5 w-1.5 rounded-full bg-[#2F5D50]" />
                Market Data + Deal Tools
              </p>

              <h1 className="text-4xl font-extrabold leading-tight md:text-5xl">
                Analyze any Business{" "}
                <span className="text-black/55">in Seconds</span>
              </h1>

              <p className="mt-5 text-base leading-relaxed text-black/70">
                Quickly sanity-check valuation, compare industry benchmarks, and
                score deals with clean multi-year data — all in one focused,
                white-and-matte-green dashboard.
              </p>

              <div className="mt-9 flex flex-wrap gap-3">
                <a
                  href="/data"
                  className="rounded-xl bg-[#2F5D50] px-6 py-3 text-sm font-bold text-white hover:bg-[#3F7668] shadow-sm"
                >
                  View Market Data
                </a>
              </div>

              <div className="mt-9 flex flex-wrap gap-6 text-xs text-black/50">
                <div>✓ Cleaned CSV benchmarks</div>
                <div>✓ Year filtering</div>
                <div>✓ Deal scoring ready</div>
              </div>
            </div>

            {/* Right Card */}
            <div className="rounded-2xl border border-black/10 bg-white p-6 shadow-sm">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs text-black/50">Current Market</p>
                  <p className="mt-1 text-lg font-bold">Industry Benchmarks</p>
                </div>
                <div className="rounded-lg border border-black/10 bg-white px-3 py-1 text-xs text-black/60">
                  Updated
                </div>
              </div>

              <div className="mt-6 space-y-3">
                {[
                  ["Cash Flow Multiple", "2.4x"],
                  ["Median Asking Price", "$560k"],
                  ["Median SDE", "$206k"],
                  ["Days on Market", "197"],
                ].map(([k, v]) => (
                  <div
                    key={k}
                    className="flex items-center justify-between rounded-xl border border-black/10 bg-[#F7F8F6] px-4 py-3"
                  >
                    <span className="text-sm text-black/65">{k}</span>
                    <span className="text-sm font-bold text-[#111827]">{v}</span>
                  </div>
                ))}
              </div>

              <div className="mt-6 text-xs text-black/50">
                Uses multi-year transaction data from cleaned CSV sources.
              </div>
            </div>
          </div>
        </section>

        {/* Core Tools */}
        <section className="mx-auto max-w-6xl px-6 pb-24">
          <div className="mb-10">
            <h2 className="text-lg font-semibold">Core Tools</h2>
            <p className="mt-1 text-sm text-black/60">
              Evaluate a deal from first look to close.
            </p>
          </div>

          <div className="grid gap-4 md:grid-cols-3">
            <FeatureCard
              title="Explore Industry Data"
              desc="Benchmark pricing, margins, and time-to-sale across industries."
              href="/data"
              primary
              cta="Browse industries"
            />
            <FeatureCard
              title="Deal Calculator"
              desc="Quickly model valuation ranges, leverage, DSCR, and equity returns."
              href="/deal-calculator"
              cta="Open calculator"
            />
            <FeatureCard
              title="CIM Analyzer"
              desc="Upload a CIM to surface risks, highlights, and underwriting notes."
              href="/cim-analyzer"
              cta="Upload CIM"
            />
          </div>
        </section>
      </SignedIn>
    </main>
  );
}

function FeatureCard({
  title,
  desc,
  href,
  cta,
  primary = false,
}: {
  title: string;
  desc: string;
  href: string;
  cta: string;
  primary?: boolean;
}) {
  return (
    <div
      className={`rounded-2xl border p-6 transition shadow-sm ${
        primary
          ? "border-[#2F5D50]/25 bg-white"
          : "border-black/10 bg-white hover:bg-black/[0.02]"
      }`}
    >
      <h3 className="text-lg font-bold">{title}</h3>
      <p className="mt-2 text-sm leading-relaxed text-black/65">{desc}</p>

      <a
        href={href}
        className={`mt-5 inline-flex rounded-xl border px-4 py-2 text-sm font-semibold transition ${
          primary
            ? "border-[#2F5D50]/30 bg-[#2F5D50] text-white hover:bg-[#3F7668]"
            : "border-black/10 bg-white text-[#111827] hover:bg-black/[0.03]"
        }`}
      >
        {cta} →
      </a>
    </div>
  );
}
