// app/signup/page.tsx
import Link from "next/link";
import { SignUp } from "@clerk/nextjs";

export const metadata = {
  title: "Sign up — Underwrite",
};

export default function SignupPage() {
  return (
    <main className="min-h-screen bg-[#F7F8F6] text-[#111827]">
      {/* Top bar */}
      <header className="sticky top-0 z-10 border-b border-black/10 bg-white/80 backdrop-blur">
        <div className="mx-auto flex h-14 max-w-7xl items-center justify-between px-6">
          <Link href="/" className="text-sm font-bold tracking-tight">
            Underwrite
          </Link>

          <Link
            href="/login"
            className="rounded-full border border-black/10 bg-white px-4 py-1.5 text-xs font-semibold hover:bg-black/[0.03] transition"
          >
            Log in
          </Link>
        </div>
      </header>

      {/* Auth */}
      <section className="mx-auto flex min-h-[calc(100vh-56px)] max-w-7xl items-center justify-center px-6 py-12">
        <div className="w-full max-w-md">
          <div className="rounded-2xl border border-black/10 bg-white p-7 shadow-sm">
            <div className="flex items-center justify-between">
              <div>
                <div className="text-xs uppercase tracking-wide text-black/45">
                  Create account
                </div>
                <h1 className="mt-1 text-xl font-extrabold tracking-tight">
                  Sign up
                </h1>
                <p className="mt-1 text-sm text-black/55">
                  Start saving deals and building your workspace.
                </p>
              </div>

              <div className="rounded-full border border-[#2F5D50]/25 bg-[#2F5D50]/10 px-3 py-1 text-xs font-semibold text-[#2F5D50]">
                New
              </div>
            </div>

            <div className="mt-6">
              <SignUp
                redirectUrl="/data"
                appearance={{
                  variables: { colorPrimary: "#2F5D50" },
                  elements: {
                    card: "shadow-none border-none p-0 bg-transparent",
                    headerTitle: "hidden",
                    headerSubtitle: "hidden",
                    footer: "hidden",
                    socialButtonsBlockButton:
                      "rounded-xl border border-black/10 hover:bg-black/[0.03] transition",
                    dividerLine: "bg-black/10",
                    dividerText: "text-black/40",
                    formFieldLabel: "text-black/60 text-xs",
                    formFieldInput:
                      "rounded-xl border border-black/10 bg-white focus:ring-2 focus:ring-[#2F5D50]/15",
                    formButtonPrimary:
                      "rounded-xl bg-[#2F5D50] hover:bg-[#3F7668] text-white transition",
                  },
                }}
              />
            </div>

            <div className="mt-5 border-t border-black/10 pt-4 text-xs text-black/45">
              By creating an account, you agree to our{" "}
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

          <div className="mt-4 text-center text-xs text-black/40">
            © {new Date().getFullYear()} Underwrite
          </div>
        </div>
      </section>
    </main>
  );
}
