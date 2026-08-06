import { NextRequest, NextResponse } from "next/server";
import {
  createApplication,
  listApplications,
  STAGES,
  STATUSES,
} from "@/lib/db";

export const dynamic = "force-dynamic";

export function GET() {
  return NextResponse.json(listApplications());
}

export async function POST(req: NextRequest) {
  const body = await req.json();
  if (!body.company?.trim() || !body.title?.trim()) {
    return NextResponse.json(
      { error: "company and title are required" },
      { status: 400 }
    );
  }
  if (body.stage && !STAGES.includes(body.stage)) {
    return NextResponse.json({ error: "invalid stage" }, { status: 400 });
  }
  if (body.status && !STATUSES.includes(body.status)) {
    return NextResponse.json({ error: "invalid status" }, { status: 400 });
  }
  return NextResponse.json(createApplication(body), { status: 201 });
}
