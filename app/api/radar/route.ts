import { NextResponse } from "next/server";
import { listApplications, normalizeCompany } from "@/lib/db";
import { guessSeason, loadRadarPostings } from "@/lib/radar";
import { categoryResolver } from "@/lib/categories";

export const dynamic = "force-dynamic";

// Radar tab data: recent postings annotated with whether an application
// already exists for them (matched by URL, else company+title).
export function GET() {
  const postings = loadRadarPostings();
  const apps = listApplications();
  const byUrl = new Map(apps.filter((a) => a.url).map((a) => [a.url, a.id]));
  const byKey = new Map(
    apps.map((a) => [
      `${normalizeCompany(a.company)}|${a.title.toLowerCase().trim()}`,
      a.id,
    ])
  );
  const categoryOf = categoryResolver();
  const rows = postings
    .map((p) => ({
      id: p.id,
      category: categoryOf(p.company),
      company: p.company,
      title: p.title,
      url: p.url,
      locations: p.locations,
      season: guessSeason(p),
      alive: p.alive,
      date_found: p.date_found ?? 0,
      applied_id:
        byUrl.get(p.url) ??
        byKey.get(`${normalizeCompany(p.company)}|${p.title.toLowerCase().trim()}`) ??
        null,
    }))
    .sort((a, b) => b.date_found - a.date_found);
  return NextResponse.json({ available: rows.length > 0, postings: rows });
}
