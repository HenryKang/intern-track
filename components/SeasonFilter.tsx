"use client";

import { useCallback, useEffect, useState } from "react";
import type { Application } from "@/lib/types";
import { seasonOrder } from "@/lib/types";

export const NO_SEASON = "none";

/** Season filter state shared across pages via localStorage. */
export function useSeasonFilter() {
  const [season, setSeasonState] = useState<string>("all");

  useEffect(() => {
    const stored = localStorage.getItem("seasonFilter");
    if (stored) setSeasonState(stored);
  }, []);

  const setSeason = useCallback((v: string) => {
    setSeasonState(v);
    localStorage.setItem("seasonFilter", v);
  }, []);

  const apply = useCallback(
    <T extends Application>(apps: T[]): T[] => {
      if (season === "all") return apps;
      return apps.filter((a) => (a.season ?? NO_SEASON) === season);
    },
    [season]
  );

  return { season, setSeason, apply };
}

export function SeasonTabs({
  apps,
  value,
  onChange,
}: {
  apps: Application[];
  value: string;
  onChange: (v: string) => void;
}) {
  const seasons = Array.from(
    new Set(apps.map((a) => a.season ?? NO_SEASON))
  ).sort((a, b) =>
    seasonOrder(a === NO_SEASON ? null : a) -
    seasonOrder(b === NO_SEASON ? null : b)
  );
  if (seasons.length < 2 && value === "all") return null;

  const tabs = [
    { key: "all", label: "All" },
    ...seasons.map((s) => ({
      key: s,
      label: s === NO_SEASON ? "No season" : s,
    })),
  ];

  return (
    <div className="flex flex-wrap items-center gap-1">
      {tabs.map((t) => (
        <button
          key={t.key}
          onClick={() => onChange(t.key)}
          className={`rounded-full border px-3 py-1 text-xs transition-colors ${
            value === t.key
              ? "border-accent bg-accent/10 font-medium text-accent"
              : "border-hairline text-ink-2 hover:border-baseline"
          }`}
        >
          {t.label}
        </button>
      ))}
    </div>
  );
}
