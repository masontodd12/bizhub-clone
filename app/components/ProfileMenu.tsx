"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useClerk, useUser } from "@clerk/nextjs";

export default function ProfileMenu() {
  const { user, isLoaded } = useUser();
  const { signOut } = useClerk();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    function onClick(e: MouseEvent) {
      if (!ref.current) return;
      if (!ref.current.contains(e.target as Node)) setOpen(false);
    }
    window.addEventListener("mousedown", onClick);
    return () => window.removeEventListener("mousedown", onClick);
  }, []);

  if (!isLoaded || !user) return null;

  const initials =
    (user.firstName?.[0] || "") + (user.lastName?.[0] || user.username?.[0] || "");

  return (
    <div className="relative" ref={ref}>
      {/* ✅ Clicking Mason only opens dropdown */}
      <button
        onClick={() => setOpen((v) => !v)}
        className="flex items-center gap-2 rounded-full border border-black/10 bg-white px-3 py-1.5 text-xs font-semibold text-[#111827] hover:bg-black/[0.03] transition"
      >
        <div className="grid h-7 w-7 place-items-center rounded-full bg-[#F7F8F6] text-[11px] font-bold text-black/70">
          {initials || "U"}
        </div>
        <span className="hidden sm:block max-w-[120px] truncate">
          {user.firstName || "Account"}
        </span>
        <span className="text-black/40">▾</span>
      </button>

      {open && (
        <div className="absolute right-0 mt-2 w-56 overflow-hidden rounded-2xl border border-black/10 bg-white shadow-lg">
          <div className="border-b border-black/10 px-4 py-3">
            <div className="text-sm font-bold text-[#111827] truncate">
              {user.fullName || user.username}
            </div>
            <div className="text-xs text-black/50 truncate">
              {user.primaryEmailAddress?.emailAddress}
            </div>
          </div>

          <div className="p-2">
            {/* ✅ THIS is the only change you needed */}
            <MenuItem href="/account/deals" onSelect={() => setOpen(false)}>
              Saved Deals
            </MenuItem>

            {/* Keep these if you have pages, otherwise they'll 404 */}
            {/* <MenuItem href="/account/subscription" onSelect={() => setOpen(false)}>
              Manage Subscription
            </MenuItem>
            <MenuItem href="/account/security" onSelect={() => setOpen(false)}>
              Security
            </MenuItem> */}

            <div className="my-2 h-px bg-black/10" />

            <button
              onClick={() => signOut({ redirectUrl: "/" })}
              className="w-full rounded-xl px-3 py-2 text-left text-xs font-semibold text-red-600 hover:bg-red-50 transition"
            >
              Sign out
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

function MenuItem({
  href,
  children,
  onSelect,
}: {
  href: string;
  children: React.ReactNode;
  onSelect?: () => void;
}) {
  return (
    <Link
      href={href}
      onClick={onSelect}
      className="block rounded-xl px-3 py-2 text-xs font-semibold text-[#111827] hover:bg-black/[0.03] transition"
    >
      {children}
    </Link>
  );
}
