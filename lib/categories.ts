import { listCategoryOverrides, normalizeCompany } from "./db";

// Built-in classification for the Radar tab's FAANG+ / Quant / Other filter.
// DB overrides (company_category table, edited in the UI) win over these lists.

const QUANT = [
  "jane street", "citadel", "citadel securities", "two sigma",
  "hudson river trading", "hrt", "jump trading", "drw", "imc", "imc trading",
  "optiver", "susquehanna", "sig", "akuna capital", "five rings",
  "tower research", "tower research capital", "virtu", "virtu financial",
  "de shaw", "d e shaw", "point72", "millennium", "balyasny", "bam",
  "voleon", "old mission", "belvedere trading", "flow traders", "cubist",
  "pdt partners", "xtx markets", "qube research", "aquatic", "radix trading",
  "wolverine trading", "chicago trading", "cts", "geneva trading",
  "transmarket", "valkyrie trading", "headlands", "jump crypto",
].map((c) => c.replace(/\s+/g, " "));

const FAANG = [
  "google", "alphabet", "meta", "facebook", "amazon", "apple", "netflix",
  "microsoft", "nvidia", "openai", "anthropic", "tesla", "uber", "airbnb",
  "stripe", "databricks", "tiktok", "bytedance", "linkedin", "snap",
  "palantir", "spotify", "atlassian", "salesforce", "adobe", "oracle",
].map((c) => c.replace(/\s+/g, " "));

export type Category = "faang" | "quant" | "other";

export function categoryResolver(): (company: string) => Category {
  const overrides = listCategoryOverrides();
  return (company: string) => {
    const norm = normalizeCompany(company);
    const o = overrides[norm];
    if (o === "faang" || o === "quant" || o === "other") return o;
    if (QUANT.some((q) => norm === q || norm.includes(q))) return "quant";
    if (FAANG.some((f) => norm === f || norm.startsWith(f + " "))) return "faang";
    return "other";
  };
}
