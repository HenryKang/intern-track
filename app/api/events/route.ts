import { NextRequest, NextResponse } from "next/server";
import { createEvent } from "@/lib/db";

export async function POST(req: NextRequest) {
  const body = await req.json();
  if (
    !body.application_id ||
    !["oa_deadline", "interview"].includes(body.type) ||
    !body.starts_at
  ) {
    return NextResponse.json(
      { error: "application_id, type (oa_deadline|interview), starts_at required" },
      { status: 400 }
    );
  }
  return NextResponse.json(createEvent(body), { status: 201 });
}
