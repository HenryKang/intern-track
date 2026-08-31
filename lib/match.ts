// Fuzzy matching between radar postings and tracker applications, so an
// application added ANYWHERE (quick-add, Gmail review queue, radar) shows as
// applied on the Radar tab without a second click.

/** Host + path, lowercased, without www/query/fragment/trailing slash. */
export function canonicalUrl(url: string | null | undefined): string {
  if (!url) return "";
  try {
    const u = new URL(url.trim());
    const host = u.hostname.replace(/^www\./, "").toLowerCase();
    const path = u.pathname.replace(/\/+$/, "").toLowerCase();
    return `${host}${path}`;
  } catch {
    return url.trim().toLowerCase().replace(/\/+$/, "");
  }
}

/** Long digit/uuid runs in a URL — ATS job ids survive path/domain changes. */
export function urlJobIds(url: string | null | undefined): string[] {
  if (!url) return [];
  return (
    url.match(
      /\d{5,}|[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/gi
    ) ?? []
  ).map((s) => s.toLowerCase());
}

// Dropped before comparing titles: seasons, years, and role boilerplate that
// varies between a posting and how it was recorded.
const NOISE = new Set([
  "the", "a", "an", "and", "or", "of", "for", "to", "at", "in", "on", "with",
  "intern", "interns", "internship", "internships", "co", "op", "coop",
  "program", "programme", "position", "role", "opening", "opportunity",
  "student", "university", "grad", "graduate", "undergrad", "undergraduate",
  "summer", "fall", "autumn", "winter", "spring", "remote", "hybrid",
  "onsite", "us", "usa", "new", "job", "hiring", "level", "i", "ii",
]);

export function titleTokens(title: string): Set<string> {
  const raw = title
    .toLowerCase()
    .replace(/20\d\d/g, " ")
    .replace(/[^a-z0-9+#]+/g, " ")
    .split(/\s+/)
    .filter(Boolean);
  const filtered = raw.filter((t) => !NOISE.has(t) && t.length > 1);
  // Keep the unfiltered set when stripping leaves nothing meaningful.
  return new Set(filtered.length >= 2 ? filtered : raw);
}

export function titleSimilarity(a: string, b: string): number {
  const A = titleTokens(a);
  const B = titleTokens(b);
  if (A.size === 0 || B.size === 0) return 0;
  let shared = 0;
  for (const t of A) if (B.has(t)) shared++;
  const jaccard = shared / (A.size + B.size - shared);
  const subset = shared === Math.min(A.size, B.size);
  // A contained title ("Software Engineer" inside "Software Engineer, Australia")
  // counts at a lower bar, but only when the extra words are few.
  return subset ? Math.max(jaccard, jaccard >= 0.6 ? 0.7 : jaccard) : jaccard;
}

export const TITLE_THRESHOLD = 0.7;

export interface MatchableApp {
  id: number;
  company: string;
  title: string;
  url: string | null;
}

export type MatchKind = "url" | "title" | null;

/**
 * Best application for a posting: an exact-enough URL match wins, otherwise
 * same company plus a similar title.
 */
export function matchPosting(
  posting: { company: string; title: string; url: string },
  apps: MatchableApp[],
  normalize: (s: string) => string
): { id: number; kind: Exclude<MatchKind, null>; title: string } | null {
  const pUrl = canonicalUrl(posting.url);
  const pIds = urlJobIds(posting.url);
  for (const a of apps) {
    if (!a.url) continue;
    if (pUrl && canonicalUrl(a.url) === pUrl) {
      return { id: a.id, kind: "url", title: a.title };
    }
    if (pIds.length) {
      const aIds = urlJobIds(a.url);
      if (pIds.some((id) => aIds.includes(id))) {
        return { id: a.id, kind: "url", title: a.title };
      }
    }
  }
  const pCompany = normalize(posting.company);
  let best: { id: number; score: number; title: string } | null = null;
  for (const a of apps) {
    const aCompany = normalize(a.company);
    const companyMatch =
      aCompany === pCompany ||
      (aCompany.length > 3 && pCompany.length > 3 &&
        (aCompany.includes(pCompany) || pCompany.includes(aCompany)));
    if (!companyMatch) continue;
    const score = titleSimilarity(posting.title, a.title);
    if (score >= TITLE_THRESHOLD && (!best || score > best.score)) {
      best = { id: a.id, score, title: a.title };
    }
  }
  return best ? { id: best.id, kind: "title", title: best.title } : null;
}
