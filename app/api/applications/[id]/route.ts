import { NextRequest, NextResponse } from "next/server";
import {
  deleteApplication,
  updateApplication,
  STAGES,
  STATUSES,
} from "@/lib/db";

type Params = { params: Promise<{ id: string }> };

export async function PATCH(req: NextRequest, { params }: Params) {
  const { id } = await params;
  const body = await req.json();
  if (body.stage !== undefined && !STAGES.includes(body.stage)) {
    return NextResponse.json({ error: "invalid stage" }, { status: 400 });
  }
  if (body.status !== undefined && !STATUSES.includes(body.status)) {
    return NextResponse.json({ error: "invalid status" }, { status: 400 });
  }
  const app = updateApplication(Number(id), body);
  if (!app) return NextResponse.json({ error: "not found" }, { status: 404 });
  return NextResponse.json(app);
}

export async function DELETE(_req: NextRequest, { params }: Params) {
  const { id } = await params;
  deleteApplication(Number(id));
  return NextResponse.json({ ok: true });
}
