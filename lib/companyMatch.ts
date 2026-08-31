// Client-safe company normalizer (mirror of normalizeCompany in lib/db.ts,
// which can't be imported client-side because of better-sqlite3).
export function normalizeCompanyClient(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9 ]/g, "")
    .replace(/\b(inc|llc|ltd|corp|corporation|co|technologies|technology|labs|group)\b/g, "")
    .replace(/\s+/g, " ")
    .trim();
}
