// app/layout.tsx
import "./globals.css";
import Link from "next/link";
import { ClerkProvider, SignedIn, SignedOut } from "@clerk/nextjs";

import ProfileMenu from "./components/ProfileMenu";
import AccessBootstrapper from "./components/AccessBootstrapper";
import PlanStatus from "@/app/components/PlanStatus";


export const metadata = {
  title: "Underwrite",
  description: "Market data and deal analysis tools",
};

function Navbar() {
  return (
    <header className="sticky top-0 z-50 border-b border-black/10 bg-white/80 backdrop-blur">
      <div className="relative mx-auto flex h-14 max-w-7xl items-center px-6">
        {/* Brand */}
        <Link
          href="/"
          className="text-sm font-extrabold tracking-tight text-[#111827]"
        >
          Underwrite
        </Link>

        {/* Center nav */}
        <nav className="absolute left-1/2 hidden -translate-x-1/2 gap-6 text-sm text-black/60 md:flex">
          <Link href="/" className="hover:text-black">
            Home
          </Link>
          <Link href="/data" className="hover:text-black">
            Data
          </Link>
          <Link href="/deal-calculator" className="hover:text-black">
            Deal Calculator
          </Link>
          <Link href="/cim-analyzer" className="hover:text-black">
            CIM Analyzer
          </Link>
          <Link href="/about" className="hover:text-black">
            About
          </Link>
        </nav>

        {/* Right side */}
        <div className="ml-auto flex items-center gap-3">
          <Link
            href="/data"
            className="rounded-full border border-[#2F5D50]/30 bg-[#2F5D50] px-4 py-1.5 text-xs font-semibold text-white hover:bg-[#3F7668] transition"
          >
            Explore Data
          </Link>

          <SignedOut>
            <Link
              href="/login"
              className="rounded-full border border-black/10 bg-white px-4 py-1.5 text-xs font-semibold text-[#111827] hover:bg-black/[0.03] transition"
            >
              Log in
            </Link>
          </SignedOut>

          <SignedIn>
            {/* Ensure UserAccess row exists */}
            <AccessBootstrapper />

            {/* ✅ Plan badge + usage meter */}
            <PlanStatus />

            <ProfileMenu />
          </SignedIn>
        </div>
      </div>
    </header>
  );
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <ClerkProvider>
      <html lang="en">
        <body className="bg-[#F7F8F6] text-[#111827] antialiased">
          <Navbar />
          {children}
        </body>
      </html>
    </ClerkProvider>
  );
}
