import { NextRequest, NextResponse } from "next/server";
import { getProfile, setProfile } from "@/lib/db";

export const dynamic = "force-dynamic";

const PROFILE_KEYS = new Set([
  "name",
  "email",
  "phone",
  "school",
  "graduation",
  "github",
  "linkedin",
  "website",
]);

export function GET() {
  return NextResponse.json(getProfile());
}

export async function PUT(req: NextRequest) {
  const body = (await req.json()) as Record<string, unknown>;
  const entries: Record<string, string> = {};
  for (const [k, v] of Object.entries(body)) {
    if (PROFILE_KEYS.has(k) && typeof v === "string") entries[k] = v;
  }
  setProfile(entries);
  return NextResponse.json(getProfile());
}
