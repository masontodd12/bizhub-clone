import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { prisma } from "@/src/lib/prisma";

export async function POST(req: Request) {
  const { userId } = await auth();
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await req.json();

  const created = await prisma.deal.create({
    data: {
      userId,
      year: Number(body?.dealInput?.year ?? 2024),
      title: body?.title ?? body?.dealInput?.industry ?? null,
      payload: body,
    },
    select: { id: true },
  });

  return NextResponse.json({ id: created.id }, { status: 201 });
}

export async function GET() {
  const { userId } = await auth();
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const deals = await prisma.deal.findMany({
    where: { userId },
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      title: true,
      year: true,
      payload: true,
      createdAt: true,
      updatedAt: true,
    },
  });

  return NextResponse.json({ deals });
}
