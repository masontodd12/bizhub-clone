// src/lib/access.ts
import { prisma } from "@/src/lib/prisma";

export type Plan = "free" | "starter" | "pro";

export function isTrialActive(trialEndsAt?: Date | string | null) {
  if (!trialEndsAt) return false;
  const d = typeof trialEndsAt === "string" ? new Date(trialEndsAt) : trialEndsAt;
  return d.getTime() > Date.now();
}

export async function getUserAccess(userId: string) {
  return prisma.userAccess.findUnique({
    where: { userId },
  });
}

export async function getOrCreateUserAccess(userId: string) {
  const existing = await prisma.userAccess.findUnique({ where: { userId } });
  if (existing) return existing;

  return prisma.userAccess.create({
    data: {
      userId,
      plan: "free",
      trialStartedAt: null,
      trialEndsAt: null,
    },
  });
}

export function hasPlan(
  access: { plan: Plan; trialEndsAt?: Date | string | null },
  required: Plan
) {
  const trialOn = isTrialActive(access.trialEndsAt);

  if (required === "free") return true;
  if (required === "starter") return access.plan === "starter" || access.plan === "pro" || trialOn;
  if (required === "pro") return access.plan === "pro";
  return false;
}
