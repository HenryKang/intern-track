import { NextRequest, NextResponse } from "next/server";
import { normalizeCompany, setCategoryOverride } from "@/lib/db";
import { categoryResolver } from "@/lib/categories";
import { loadRadarPostings } from "@/lib/radar";

export const dynamic = "force-dynamic";

// Companies appearing in radar postings, with their resolved category —
// the editable list behind the Radar tab's category filter.
export function GET() {
  const categoryOf = categoryResolver();
  const counts = new Map<string, { company: string; count: number }>();
  for (const p of loadRadarPostings()) {
    const norm = normalizeCompany(p.company);
    const cur = counts.get(norm);
    if (cur) cur.count++;
    else counts.set(norm, { company: p.company, count: 1 });
  }
  const rows = Array.from(counts.entries())
    .map(([norm, { company, count }]) => ({
      norm,
      company,
      count,
      category: categoryOf(company),
    }))
    .sort((a, b) => b.count - a.count);
  return NextResponse.json(rows);
}

export async function PUT(req: NextRequest) {
  const { company, category } = await req.json();
  if (!company?.trim() || !["faang", "quant", "other", null].includes(category)) {
    return NextResponse.json(
      { error: "company and category (faang|quant|other|null) required" },
      { status: 400 }
    );
  }
  setCategoryOverride(normalizeCompany(company), category);
  return NextResponse.json({ ok: true });
}
