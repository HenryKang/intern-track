import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { normalizeCompany } from "./db";

// Reads intern-radar's postings archive for the Radar tab and for suggesting
// position titles when a confirmation email doesn't name the role.

export interface RadarPosting {
  id: string;
  company: string;
  title: string;
  locations: string[];
  url: string;
  season: string; // "Summer", "Fall", ...
  source: string;
  role_type: string;
  category: string;
  sponsorship?: string;
  date_posted?: number; // epoch seconds
  date_found?: number;
  alive: boolean;
}

const RADAR_FILE = path.join(
  process.env.RADAR_DIR ?? path.join(os.homedir(), "intern-radar"),
  "data",
  "postings.json"
);

let cache: { mtimeMs: number; postings: RadarPosting[] } | null = null;

export function loadRadarPostings(): RadarPosting[] {
  try {
    const stat = fs.statSync(RADAR_FILE);
    if (!cache || cache.mtimeMs !== stat.mtimeMs) {
      const raw = JSON.parse(fs.readFileSync(RADAR_FILE, "utf8"));
      cache = { mtimeMs: stat.mtimeMs, postings: Array.isArray(raw) ? raw : [] };
    }
    return cache.postings;
  } catch {
    return []; // radar repo not present — Radar tab shows an explainer instead
  }
}

/** Postings for a company, live ones first, most recently found first. */
export function suggestPostings(company: string, limit = 6): RadarPosting[] {
  const norm = normalizeCompany(company);
  if (!norm) return [];
  return loadRadarPostings()
    .filter((p) => {
      const pn = normalizeCompany(p.company);
      return pn === norm || pn.includes(norm) || norm.includes(pn);
    })
    .sort(
      (a, b) =>
        Number(b.alive) - Number(a.alive) ||
        (b.date_found ?? 0) - (a.date_found ?? 0)
    )
    .slice(0, limit);
}

/** "Summer 2027" from a posting's season + a year found in its title, if any. */
export function guessSeason(p: RadarPosting): string | null {
  const year = p.title.match(/20(2[5-9]|3\d)/)?.[0];
  if (!p.season || !year) return null;
  return `${p.season} ${year}`;
}
