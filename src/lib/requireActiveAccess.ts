// src/lib/requireActiveAccess.ts
import { redirect } from "next/navigation";
import { auth } from "@clerk/nextjs/server";
import { prisma } from "@/src/lib/prisma";
import { getEntitlements } from "@/src/lib/entitlements";

export async function requireActiveAccess() {
  const { userId } = await auth();
  if (!userId) redirect("/sign-in");

  const access =
    (await prisma.userAccess.findUnique({ where: { userId } })) ??
    ({ plan: "free", isAdmin: false } as any);

  const ent = getEntitlements(access);

  // ✅ allow if plan/entitlements allow it (Pro or Pro+ or admin)
  if (!ent.canUseDealCalculator) {
    redirect("/pricing");
  }

  return access;
}
