import { NextRequest, NextResponse } from "next/server";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

export const dynamic = "force-dynamic";

// View/edit intern-radar's ats_targets in config/sources.yaml. Entries are
// uniform single-line flow maps, so edits are surgical text replacements that
// preserve the file's comments. Edits are local until pushed (see POST push).

const RADAR_DIR = process.env.RADAR_DIR ?? path.join(os.homedir(), "intern-radar");
const SOURCES = path.join(RADAR_DIR, "config", "sources.yaml");
const run = promisify(execFile);

// groups: 1=company 2=ats 3=slug 4=role_type? 5=enabled
const LINE_RX =
  /^\s*-\s*\{\s*company:\s*"([^"]+)",\s*ats:\s*([\w-]+),\s*slug:\s*(\S+?),\s*(?:role_type:\s*([\w-]+),\s*)?enabled:\s*(true|false)\s*\}\s*$/;

interface Target {
  line: number;
  company: string;
  ats: string;
  slug: string;
  role_type: string;
  enabled: boolean;
}

function parseTargets(): { lines: string[]; targets: Target[] } {
  const lines = fs.readFileSync(SOURCES, "utf8").split("\n");
  const targets: Target[] = [];
  let inTargets = false;
  lines.forEach((line, i) => {
    if (/^ats_targets:/.test(line)) inTargets = true;
    else if (/^\S/.test(line) && inTargets) inTargets = false;
    if (!inTargets) return;
    const m = line.match(LINE_RX);
    if (m) {
      targets.push({
        line: i,
        company: m[1],
        ats: m[2],
        slug: m[3].replace(/,$/, ""),
        role_type: m[4] ?? "intern",
        enabled: m[5] === "true",
      });
    }
  });
  return { lines, targets };
}

async function configDirty(): Promise<boolean> {
  try {
    const { stdout } = await run("git", ["-C", RADAR_DIR, "status", "--porcelain", "config/sources.yaml"]);
    return stdout.trim().length > 0;
  } catch {
    return false;
  }
}

export async function GET() {
  try {
    const { targets } = parseTargets();
    return NextResponse.json({ targets, dirty: await configDirty() });
  } catch {
    return NextResponse.json({ targets: [], dirty: false, error: "sources.yaml not found" });
  }
}

// PATCH: toggle an existing target's enabled flag.
export async function PATCH(req: NextRequest) {
  const { company, ats, slug, role_type, enabled } = await req.json();
  const { lines, targets } = parseTargets();
  const t = targets.find(
    (x) => x.slug === slug && x.ats === ats && x.role_type === (role_type ?? "intern") && x.company === company
  );
  if (!t) return NextResponse.json({ error: "target not found" }, { status: 404 });
  lines[t.line] = lines[t.line].replace(/enabled:\s*(true|false)/, `enabled: ${enabled ? "true" : "false"}`);
  fs.writeFileSync(SOURCES, lines.join("\n"));
  return NextResponse.json({ ok: true });
}

// POST: {action:"add", company, ats, slug, role_type} appends a target;
//       {action:"push"} commits + pushes config/sources.yaml to the radar repo.
export async function POST(req: NextRequest) {
  const body = await req.json();
  if (body.action === "push") {
    try {
      await run("git", ["-C", RADAR_DIR, "add", "config/sources.yaml"]);
      await run("git", ["-C", RADAR_DIR, "commit", "-m", "Update ats_targets from intern-track UI"]);
      await run("git", ["-C", RADAR_DIR, "push"]);
      return NextResponse.json({ ok: true });
    } catch (e) {
      return NextResponse.json({ error: String((e as Error).message).slice(0, 300) }, { status: 500 });
    }
  }
  if (body.action === "add") {
    const { company, ats, slug, role_type } = body;
    if (!company?.trim() || !["greenhouse", "lever", "ashby", "workday"].includes(ats) || !slug?.trim()) {
      return NextResponse.json({ error: "company, ats (greenhouse|lever|ashby|workday), slug required" }, { status: 400 });
    }
    const entry = `  - { company: "${company.trim()}", ats: ${ats}, slug: ${slug.trim()}, role_type: ${role_type === "new_grad" ? "new_grad" : "intern"}, enabled: true }`;
    fs.appendFileSync(SOURCES, `${entry}\n`);
    return NextResponse.json({ ok: true });
  }
  return NextResponse.json({ error: "unknown action" }, { status: 400 });
}
