import { NextRequest, NextResponse } from "next/server";
import { setCandidateState } from "@/lib/db";

type Params = { params: Promise<{ id: string }> };

export async function PATCH(req: NextRequest, { params }: Params) {
  const { id } = await params;
  const body = await req.json();
  if (body.state !== "dismissed") {
    return NextResponse.json({ error: "only state:'dismissed' supported" }, { status: 400 });
  }
  setCandidateState(Number(id), "dismissed");
  return NextResponse.json({ ok: true });
}
