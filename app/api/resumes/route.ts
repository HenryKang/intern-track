import { NextRequest, NextResponse } from "next/server";
import fs from "node:fs";
import path from "node:path";
import { createResumeFile, listResumeFiles, RESUME_DIR } from "@/lib/db";

export const dynamic = "force-dynamic";

const ALLOWED_MIME = new Set([
  "application/pdf",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
]);
const MAX_SIZE = 10 * 1024 * 1024; // 10 MB

export function GET() {
  return NextResponse.json(listResumeFiles());
}

export async function POST(req: NextRequest) {
  const form = await req.formData();
  const file = form.get("file");
  const name = String(form.get("name") ?? "").trim();

  if (!(file instanceof File)) {
    return NextResponse.json({ error: "file is required" }, { status: 400 });
  }
  if (!name) {
    return NextResponse.json(
      { error: "name is required (e.g. swe-v3)" },
      { status: 400 }
    );
  }
  if (!ALLOWED_MIME.has(file.type)) {
    return NextResponse.json(
      { error: "only PDF or Word documents are allowed" },
      { status: 400 }
    );
  }
  if (file.size > MAX_SIZE) {
    return NextResponse.json({ error: "file exceeds 10 MB" }, { status: 400 });
  }

  const safeBase = file.name.replace(/[^a-zA-Z0-9._-]/g, "_");
  const filename = `${Date.now()}-${safeBase}`;
  fs.mkdirSync(RESUME_DIR, { recursive: true });
  fs.writeFileSync(
    path.join(RESUME_DIR, filename),
    Buffer.from(await file.arrayBuffer())
  );

  const resume = createResumeFile({
    name,
    filename,
    mime: file.type,
    size: file.size,
  });
  return NextResponse.json(resume, { status: 201 });
}
