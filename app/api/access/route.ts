// app/api/access/route.ts
import { auth } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import { getOrCreateUserAccess, isTrialActive } from "@/src/lib/access";


export async function GET() {
  const { userId } = await auth();

  if (!userId) {
    return NextResponse.json({ ok: false, error: "Not signed in" }, { status: 401 });
  }

  const access = await getOrCreateUserAccess(userId);

  return NextResponse.json({
    ok: true,
    access: {
      plan: access.plan,
      trialStartedAt: access.trialStartedAt,
      trialEndsAt: access.trialEndsAt,
      trialActive: isTrialActive(access.trialEndsAt),
      createdAt: access.createdAt,
      updatedAt: access.updatedAt,
    },
  });
}
