import { NextResponse } from "next/server";
import { listApplications, listRadarLinks, normalizeCompany } from "@/lib/db";
import { guessSeason, loadRadarPostings } from "@/lib/radar";
import { categoryResolver } from "@/lib/categories";
import { matchPosting } from "@/lib/match";

export const dynamic = "force-dynamic";

// Radar tab data. Applied-state precedence:
//   1. an explicit override (I applied / unmarked) recorded in radar_links
//   2. otherwise a fuzzy cross-check against every tracker application, so
//      applications added by quick-add or the Gmail queue light up here too.
export function GET() {
  const postings = loadRadarPostings();
  const apps = listApplications();
  const links = listRadarLinks();
  const categoryOf = categoryResolver();
  const matchable = apps.map((a) => ({
    id: a.id,
    company: a.company,
    title: a.title,
    url: a.url,
  }));
  const appById = new Map(apps.map((a) => [a.id, a]));

  const rows = postings.map((p) => {
    const link = links[p.id];
    let appliedId: number | null = null;
    let matchKind: "url" | "title" | "manual" | null = null;
    let matchedTitle: string | null = null;

    if (link?.state === "not_applied") {
      appliedId = null;
    } else if (link?.state === "applied" && link.application_id && appById.has(link.application_id)) {
      appliedId = link.application_id;
      matchKind = "manual";
      matchedTitle = appById.get(link.application_id)!.title;
    } else {
      const m = matchPosting(p, matchable, normalizeCompany);
      if (m) {
        appliedId = m.id;
        matchKind = m.kind;
        matchedTitle = m.title;
      }
    }
    return {
      id: p.id,
      company: p.company,
      title: p.title,
      url: p.url,
      locations: p.locations,
      season: guessSeason(p),
      category: categoryOf(p.company),
      alive: p.alive,
      date_found: p.date_found ?? 0,
      applied_id: appliedId,
      match_kind: matchKind,
      matched_title: matchedTitle,
    };
  });
  rows.sort((a, b) => b.date_found - a.date_found);
  return NextResponse.json({ available: rows.length > 0, postings: rows });
}
