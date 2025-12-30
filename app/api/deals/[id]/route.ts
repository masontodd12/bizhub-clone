import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { prisma } from "@/src/lib/prisma";

// make sure this runs on Node (Prisma + Clerk)
export const runtime = "nodejs";

export async function DELETE(
  _req: Request,
  { params }: { params: { id: string } }
) {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const id = params.id;

    // ✅ no-throw delete (scoped to owner)
    const result = await prisma.deal.deleteMany({
      where: { id, userId },
    });

    if (result.count === 0) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    return NextResponse.json({ ok: true });
  } catch (e: any) {
    console.error("DELETE /api/deals/[id] failed:", e);
    return NextResponse.json(
      { error: "Server error", detail: String(e?.message ?? e) },
      { status: 500 }
    );
  }
}
