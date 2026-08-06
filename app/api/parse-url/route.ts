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

// Workday posting pages have a public CxS JSON endpoint mirroring the URL path.
async function workday(
  host: string,
  tenant: string,
  site: string,
  jobPath: string
): Promise<Parsed> {
  const data = (await getJson(
    `https://${host}/wday/cxs/${tenant}/${site}${jobPath}`
  )) as {
    jobPostingInfo?: { title?: string };
    hiringOrganization?: { name?: string };
  };
  const title = data.jobPostingInfo?.title ?? "";
  if (!title) throw new Error("posting not found on Workday");
  return {
    company: data.hiringOrganization?.name || prettifySlug(tenant),
    title,
    ats: "workday",
  };
}

// Generic fallback for any careers page: schema.org JobPosting JSON-LD first
// (most ATS-rendered pages embed it server-side), then OpenGraph/<title> tags.
function findJobPosting(node: unknown): { title?: string; org?: string } | null {
  if (Array.isArray(node)) {
    for (const item of node) {
      const found = findJobPosting(item);
      if (found) return found;
    }
    return null;
  }
  if (node && typeof node === "object") {
    const obj = node as Record<string, unknown>;
    const type = obj["@type"];
    const isJob = Array.isArray(type)
      ? type.includes("JobPosting")
      : type === "JobPosting";
    if (isJob) {
      const org = obj.hiringOrganization;
      return {
        title: typeof obj.title === "string" ? obj.title : undefined,
        org:
          typeof org === "string"
            ? org
            : org && typeof org === "object"
              ? String((org as Record<string, unknown>).name ?? "")
              : undefined,
      };
    }
    if (obj["@graph"]) return findJobPosting(obj["@graph"]);
  }
  return null;
}

const PAGE_HEADERS = {
  "User-Agent":
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 Safari/537.36",
  Accept: "text/html,application/xhtml+xml",
};

function decodeEntities(s: string): string {
  return s
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#0?39;|&apos;/g, "'")
    .trim();
}

function metaContent(html: string, property: string): string {
  const re = new RegExp(
    `<meta[^>]+(?:property|name)=["']${property}["'][^>]*content=["']([^"']*)["']|<meta[^>]+content=["']([^"']*)["'][^>]*(?:property|name)=["']${property}["']`,
    "i"
  );
  const m = html.match(re);
  return decodeEntities(m?.[1] ?? m?.[2] ?? "");
}

async function genericPage(url: string): Promise<Parsed> {
  const res = await fetch(url, {
    headers: PAGE_HEADERS,
    signal: AbortSignal.timeout(15000),
    redirect: "follow",
  });
  if (!res.ok) throw new Error(`${res.status} fetching page`);
  const html = await res.text();

  // 1) JSON-LD JobPosting
  const ldBlocks = html.matchAll(
    /<script[^>]+type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi
  );
  for (const [, block] of ldBlocks) {
    try {
      const found = findJobPosting(JSON.parse(block.trim()));
      if (found?.title || found?.org) {
        return {
          company: decodeEntities(found.org ?? ""),
          title: decodeEntities(found.title ?? ""),
          ats: "page metadata",
        };
      }
    } catch {
      // malformed JSON-LD block — try the next one
    }
  }

  // 2) OpenGraph / <title>
  const ogTitle = metaContent(html, "og:title");
  const ogSite = metaContent(html, "og:site_name");
  const titleTag = decodeEntities(
    html.match(/<title[^>]*>([\s\S]*?)<\/title>/i)?.[1] ?? ""
  );
  const title = ogTitle || titleTag;
  if (!title && !ogSite) throw new Error("no job metadata found on page");
  return { company: ogSite, title, ats: "page metadata" };
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
  // Workday: {tenant}.wd5.myworkdayjobs.com/[locale/]{site}/job/...
  m = url.match(
    /https?:\/\/(([a-z0-9-]+)\.wd\d+\.myworkdayjobs\.com)\/(?:[a-z]{2}-[A-Z]{2}\/)?([^/?#]+)(\/job\/[^?#]+)/
  );
  if (m) {
    const [, host, tenant, site, jobPath] = m;
    return () => workday(host, tenant, site, jobPath);
  }
  // Embedded Greenhouse on a company site (stripe.com/jobs/...?gh_jid=123):
  // guess the board from the domain, fall back to reading the page.
  const ghJid = url.match(/[?&]gh_jid=(\d+)/);
  if (ghJid) {
    const board = new URL(url).hostname.replace(/^www\./, "").split(".")[0];
    return async () => {
      try {
        return await greenhouse(board, ghJid[1], false);
      } catch {
        return genericPage(url);
      }
    };
  }
  // Anything else: read the page itself.
  if (/^https?:\/\//i.test(url)) {
    return () => genericPage(url);
  }
  return null;
}

export async function POST(req: NextRequest) {
  const { url } = (await req.json()) as { url?: string };
  if (!url?.trim()) {
    return NextResponse.json({ error: "url required" }, { status: 400 });
  }
  const trimmed = url.trim();
  const fetcher = match(
    /^https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`
  );
  if (!fetcher) {
    return NextResponse.json(
      { supported: false, error: "Not a valid URL — fill in fields manually" },
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
