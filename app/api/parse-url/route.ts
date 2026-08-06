import { NextRequest, NextResponse } from "next/server";

// ATS endpoints mirror intern-radar's fetch_ats.py (Greenhouse/Lever/Ashby
// public JSON APIs), adapted to fetch a single posting from its URL.

const HEADERS = { "User-Agent": "intern-track (localhost personal tracker)" };

async function getJson(url: string): Promise<unknown> {
  const r = await fetch(url, { headers: HEADERS, signal: AbortSignal.timeout(15000) });
  if (!r.ok) throw new Error(`${r.status} from ${url}`);
  return r.json();
}

function prettifySlug(slug: string): string {
  return slug
    .split(/[-_]/)
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(" ");
}

interface Parsed {
  company: string;
  title: string;
  ats: string;
}

async function greenhouse(
  board: string,
  jobId: string,
  eu: boolean
): Promise<Parsed> {
  const api = eu
    ? "https://boards.eu.greenhouse.io/v1/boards"
    : "https://boards-api.greenhouse.io/v1/boards";
  const job = (await getJson(`${api}/${board}/jobs/${jobId}`)) as {
    title?: string;
  };
  let company = prettifySlug(board);
  try {
    const boardInfo = (await getJson(`${api}/${board}`)) as { name?: string };
    if (boardInfo.name) company = boardInfo.name;
  } catch {
    // board metadata is optional; slug fallback is fine
  }
  return { company, title: job.title ?? "", ats: "greenhouse" };
}

async function lever(slug: string, postingId: string): Promise<Parsed> {
  const job = (await getJson(
    `https://api.lever.co/v0/postings/${slug}/${postingId}`
  )) as { text?: string };
  return { company: prettifySlug(slug), title: job.text ?? "", ats: "lever" };
}

async function ashby(org: string, jobId: string): Promise<Parsed> {
  const data = (await getJson(
    `https://api.ashbyhq.com/posting-api/job-board/${org}`
  )) as { jobs?: { id?: string; title?: string; jobUrl?: string }[] };
  const job = (data.jobs ?? []).find(
    (j) => j.id === jobId || j.jobUrl?.includes(jobId)
  );
  if (!job) throw new Error("posting not found on Ashby board");
  return { company: prettifySlug(org), title: job.title ?? "", ats: "ashby" };
}

const UUID = "[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}";

function match(url: string): (() => Promise<Parsed>) | null {
  // Handles boards.greenhouse.io, job-boards.greenhouse.io, and the .eu
  // variants; both /{board}/jobs/{id} paths and embed/job_app?token= links.
  let m = url.match(
    /(?:boards|job-boards)\.(eu\.)?greenhouse\.io\/(?:embed\/job_app\?[^#]*token=([^&#]+)[^#]*gh_jid=(\d+)|([^/?#]+)\/jobs\/(\d+))/
  );
  if (m) {
    const eu = !!m[1];
    const board = m[2] ?? m[4];
    const jobId = m[3] ?? m[5];
    return () => greenhouse(board, jobId, eu);
  }
  m = url.match(new RegExp(`jobs\\.(?:eu\\.)?lever\\.co\\/([^/?#]+)\\/(${UUID})`));
  if (m) {
    const [, slug, id] = m;
    return () => lever(slug, id);
  }
  m = url.match(new RegExp(`jobs\\.ashbyhq\\.com\\/([^/?#]+)\\/(${UUID})`));
  if (m) {
    const [, org, id] = m;
    return () => ashby(org, id);
  }
  return null;
}

export async function POST(req: NextRequest) {
  const { url } = (await req.json()) as { url?: string };
  if (!url?.trim()) {
    return NextResponse.json({ error: "url required" }, { status: 400 });
  }
  const fetcher = match(url.trim());
  if (!fetcher) {
    return NextResponse.json(
      { supported: false, error: "Unrecognized ATS — fill in fields manually" },
      { status: 200 }
    );
  }
  try {
    const parsed = await fetcher();
    return NextResponse.json({ supported: true, ...parsed });
  } catch (e) {
    return NextResponse.json(
      { supported: false, error: `Lookup failed (${(e as Error).message}) — fill in manually` },
      { status: 200 }
    );
  }
}
