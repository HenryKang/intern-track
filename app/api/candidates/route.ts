import { NextRequest, NextResponse } from "next/server";
import { createCandidate, listPendingCandidates } from "@/lib/db";
import { guessSeason, suggestPostings } from "@/lib/radar";

export const dynamic = "force-dynamic";

const KINDS = new Set(["application", "oa", "rejection", "interview"]);

export function GET() {
  const candidates = listPendingCandidates().map((c) => ({
    ...c,
    suggestions: suggestPostings(c.company).map((p) => ({
      title: p.title,
      url: p.url,
      season: guessSeason(p),
      alive: p.alive,
    })),
  }));
  return NextResponse.json(candidates);
}

export async function POST(req: NextRequest) {
  const body = await req.json();
  if (!body.company?.trim()) {
    return NextResponse.json({ error: "company required" }, { status: 400 });
  }
  if (body.kind !== undefined && !KINDS.has(body.kind)) {
    return NextResponse.json({ error: "invalid kind" }, { status: 400 });
  }
  const result = createCandidate({ ...body, company: body.company.trim() });
  return NextResponse.json(result, { status: result.candidate ? 201 : 200 });
}
