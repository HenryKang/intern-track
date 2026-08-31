import { NextRequest, NextResponse } from "next/server";
import {
  createApplication,
  createEvent,
  db,
  setCandidateState,
  updateApplication,
  type Candidate,
} from "@/lib/db";

type Params = { params: Promise<{ id: string }> };

// Confirming a candidate either creates an application (kind: application)
// or applies a stage/status change to an existing one (oa / rejection /
// interview kinds).
export async function POST(req: NextRequest, { params }: Params) {
  const { id } = await params;
  const candidate = db()
    .prepare("SELECT * FROM candidates WHERE id = ? AND state = 'pending'")
    .get(Number(id)) as Candidate | undefined;
  if (!candidate) {
    return NextResponse.json({ error: "not found or not pending" }, { status: 404 });
  }
  const body = await req.json().catch(() => ({}));

  if (candidate.kind === "application") {
    if (!body.title?.trim()) {
      return NextResponse.json({ error: "title required" }, { status: 400 });
    }
    const app = createApplication({
      company: candidate.company,
      title: body.title.trim(),
      url: body.url ?? candidate.url ?? null,
      date_applied: body.date_applied ?? candidate.applied_date ?? null,
      season: body.season ?? null,
      resume: body.resume ?? null,
    });
    setCandidateState(candidate.id, "confirmed", app.id);
    return NextResponse.json({ ok: true, application: app }, { status: 201 });
  }

  const appId = Number(body.application_id);
  if (!appId) {
    return NextResponse.json({ error: "application_id required" }, { status: 400 });
  }
  if (candidate.kind === "oa") {
    updateApplication(appId, { stage: "oa" });
    if (candidate.applied_date) {
      createEvent({
        application_id: appId,
        type: "oa_deadline",
        starts_at: body.deadline ?? candidate.applied_date,
        label: "From email — set real deadline",
        url: candidate.url ?? null,
      });
    }
  } else if (candidate.kind === "rejection") {
    updateApplication(appId, { status: "rejected" });
  } else if (candidate.kind === "interview") {
    updateApplication(appId, { stage: "first_round" });
  }
  setCandidateState(candidate.id, "confirmed", appId);
  return NextResponse.json({ ok: true });
}
