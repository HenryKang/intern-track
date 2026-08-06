import { NextRequest, NextResponse } from "next/server";
import { deleteEvent, updateEvent } from "@/lib/db";

type Params = { params: Promise<{ id: string }> };

export async function PATCH(req: NextRequest, { params }: Params) {
  const { id } = await params;
  const body = await req.json();
  if (body.type !== undefined && !["oa_deadline", "interview"].includes(body.type)) {
    return NextResponse.json({ error: "invalid type" }, { status: 400 });
  }
  const event = updateEvent(Number(id), body);
  if (!event) return NextResponse.json({ error: "not found" }, { status: 404 });
  return NextResponse.json(event);
}

export async function DELETE(_req: NextRequest, { params }: Params) {
  const { id } = await params;
  deleteEvent(Number(id));
  return NextResponse.json({ ok: true });
}
