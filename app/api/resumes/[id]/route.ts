import { NextRequest, NextResponse } from "next/server";
import { deleteResumeFile, getResumeFile } from "@/lib/db";

type Params = { params: Promise<{ id: string }> };

export async function DELETE(_req: NextRequest, { params }: Params) {
  const { id } = await params;
  deleteResumeFile(Number(id));
  return NextResponse.json({ ok: true });
}

export async function GET(_req: NextRequest, { params }: Params) {
  const { id } = await params;
  const resume = getResumeFile(Number(id));
  if (!resume) return NextResponse.json({ error: "not found" }, { status: 404 });
  return NextResponse.json(resume);
}
