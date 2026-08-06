import { NextRequest, NextResponse } from "next/server";
import fs from "node:fs";
import path from "node:path";
import { getResumeFile, RESUME_DIR } from "@/lib/db";

type Params = { params: Promise<{ id: string }> };

export async function GET(_req: NextRequest, { params }: Params) {
  const { id } = await params;
  const resume = getResumeFile(Number(id));
  if (!resume) return NextResponse.json({ error: "not found" }, { status: 404 });

  const filePath = path.join(RESUME_DIR, path.basename(resume.filename));
  if (!fs.existsSync(filePath)) {
    return NextResponse.json({ error: "file missing on disk" }, { status: 404 });
  }
  return new NextResponse(new Uint8Array(fs.readFileSync(filePath)), {
    headers: {
      "Content-Type": resume.mime ?? "application/octet-stream",
      "Content-Disposition": `inline; filename="${resume.filename.replace(/^\d+-/, "")}"`,
    },
  });
}
