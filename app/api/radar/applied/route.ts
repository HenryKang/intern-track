import { NextRequest, NextResponse } from "next/server";
import {
  createApplication,
  deleteApplication,
  getRadarLink,
  setRadarLink,
} from "@/lib/db";

export const dynamic = "force-dynamic";

// POST  { posting_id, company, title, url, date_applied, season }
//   -> creates the tracker application and records an explicit link.
// DELETE { posting_id, delete_application }
//   -> unmarks the card (suppresses auto-match) and, when asked, removes the
//      linked application from the tracker.
export async function POST(req: NextRequest) {
  const body = await req.json();
  if (!body.posting_id || !body.company?.trim() || !body.title?.trim()) {
    return NextResponse.json(
      { error: "posting_id, company, title required" },
      { status: 400 }
    );
  }
  const app = createApplication({
    company: body.company.trim(),
    title: body.title.trim(),
    url: body.url ?? null,
    date_applied: body.date_applied ?? null,
    season: body.season ?? null,
  });
  setRadarLink(body.posting_id, "applied", app.id);
  return NextResponse.json({ ok: true, application: app }, { status: 201 });
}

export async function DELETE(req: NextRequest) {
  const body = await req.json();
  if (!body.posting_id) {
    return NextResponse.json({ error: "posting_id required" }, { status: 400 });
  }
  const appId = Number(body.application_id) || getRadarLink(body.posting_id)?.application_id;
  if (body.delete_application && appId) deleteApplication(appId);
  setRadarLink(body.posting_id, "not_applied", null);
  return NextResponse.json({ ok: true, deleted: !!(body.delete_application && appId) });
}
