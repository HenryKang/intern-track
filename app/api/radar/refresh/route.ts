import { NextRequest, NextResponse } from "next/server";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import os from "node:os";
import path from "node:path";

export const dynamic = "force-dynamic";

const RADAR_DIR = process.env.RADAR_DIR ?? path.join(os.homedir(), "intern-radar");
const run = promisify(execFile);

// action:"trigger" kicks radar's crawl workflow on GitHub (a real search, on
// demand); action:"pull" fast-forwards the local repo to grab its committed
// results. The client polls pull until the crawl's commit lands.
export async function POST(req: NextRequest) {
  const { action } = await req.json();
  try {
    if (action === "trigger") {
      await run("gh", ["workflow", "run", "crawl.yml"], { cwd: RADAR_DIR });
      return NextResponse.json({ ok: true });
    }
    if (action === "pull") {
      const before = (await run("git", ["-C", RADAR_DIR, "rev-parse", "HEAD"])).stdout.trim();
      await run("git", ["-C", RADAR_DIR, "fetch", "--quiet"]);
      await run("git", ["-C", RADAR_DIR, "pull", "--ff-only", "--quiet"]);
      const after = (await run("git", ["-C", RADAR_DIR, "rev-parse", "HEAD"])).stdout.trim();
      return NextResponse.json({ ok: true, updated: before !== after });
    }
    return NextResponse.json({ error: "unknown action" }, { status: 400 });
  } catch (e) {
    return NextResponse.json(
      { error: String((e as Error).message).slice(0, 300) },
      { status: 500 }
    );
  }
}
