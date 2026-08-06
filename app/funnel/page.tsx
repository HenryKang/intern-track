"use client";

import { useEffect, useMemo, useState } from "react";
import { ResponsiveSankey } from "@nivo/sankey";
import {
  ApplicationWithEvents,
  STAGES,
  STAGE_LABELS,
  Stage,
} from "@/lib/types";
import { SeasonTabs, useSeasonFilter } from "@/components/SeasonFilter";

function useDarkMode(): boolean {
  const [dark, setDark] = useState(false);
  useEffect(() => {
    const mq = window.matchMedia("(prefers-color-scheme: dark)");
    setDark(mq.matches);
    const fn = (e: MediaQueryListEvent) => setDark(e.matches);
    mq.addEventListener("change", fn);
    return () => mq.removeEventListener("change", fn);
  }, []);
  return dark;
}

// Hexes mirror globals.css — nivo needs concrete colors, not CSS vars.
const STAGE_HEX: Record<"light" | "dark", Record<Stage, string>> = {
  light: {
    applied: "#86b6ef",
    oa: "#6694cd",
    first_round: "#4874ab",
    final_round: "#2b548b",
    offer: "#0d366b",
  },
  dark: {
    applied: "#184f95",
    oa: "#256abf",
    first_round: "#3987e5",
    final_round: "#6da7ec",
    offer: "#cde2fb",
  },
};

const TERMINAL_HEX = {
  Rejected: { light: "#d03b3b", dark: "#d03b3b" },
  Ghosted: { light: "#ec835a", dark: "#ec835a" },
  "Awaiting response": { light: "#898781", dark: "#898781" },
  Accepted: { light: "#0ca30c", dark: "#0ca30c" },
};

type Terminal = keyof typeof TERMINAL_HEX;

function buildSankey(apps: ApplicationWithEvents[]) {
  const linkWeights = new Map<string, number>();
  const bump = (source: string, target: string) => {
    const key = `${source}\x1f${target}`;
    linkWeights.set(key, (linkWeights.get(key) ?? 0) + 1);
  };

  for (const app of apps) {
    const reached = STAGES.indexOf(app.stage);
    for (let i = 0; i < reached; i++) {
      bump(STAGE_LABELS[STAGES[i]], STAGE_LABELS[STAGES[i + 1]]);
    }
    // Terminals: rejected/ghosted/accepted branch off the stage they ended at.
    // Ongoing apps still waiting to hear back after applying flow to
    // "Awaiting response" (same column as OA/Rejected); ongoing apps already
    // past "applied" simply end at their current stage node — no filler bar.
    if (app.status === "rejected") {
      bump(STAGE_LABELS[app.stage], "Rejected");
    } else if (app.status === "accepted") {
      bump(STAGE_LABELS[app.stage], "Accepted");
    } else if (app.status === "ghosted") {
      bump(STAGE_LABELS[app.stage], "Ghosted");
    } else if (app.stage === "applied") {
      bump(STAGE_LABELS.applied, "Awaiting response");
    }
  }

  const links = Array.from(linkWeights, ([key, value]) => {
    const [source, target] = key.split("\x1f");
    return { source, target, value };
  });
  const ids = new Set(links.flatMap((l) => [l.source, l.target]));
  // Preserve stage order, then terminals — nivo keeps layer order stable.
  const ordered = [
    ...STAGES.map((s) => STAGE_LABELS[s]),
    "Awaiting response",
    "Rejected",
    "Ghosted",
    "Accepted",
  ].filter((id) => ids.has(id));
  return { nodes: ordered.map((id) => ({ id })), links };
}

function stageCounts(apps: ApplicationWithEvents[]) {
  return STAGES.map((s) => {
    const reachedHere = apps.filter(
      (a) => STAGES.indexOf(a.stage) >= STAGES.indexOf(s)
    );
    return {
      stage: STAGE_LABELS[s],
      reached: reachedHere.length,
      rejectedAt: apps.filter((a) => a.stage === s && a.status === "rejected")
        .length,
    };
  });
}

export default function FunnelPage() {
  const [allApps, setAllApps] = useState<ApplicationWithEvents[] | null>(null);
  const dark = useDarkMode();
  const { season, setSeason, apply } = useSeasonFilter();

  useEffect(() => {
    fetch("/api/applications")
      .then((r) => r.json())
      .then(setAllApps);
  }, []);

  const apps = useMemo(
    () => (allApps === null ? null : apply(allApps)),
    [allApps, apply]
  );
  const data = useMemo(() => (apps ? buildSankey(apps) : null), [apps]);
  const counts = useMemo(() => (apps ? stageCounts(apps) : []), [apps]);

  if (apps === null || allApps === null) {
    return <p className="py-12 text-center text-sm text-muted">Loading…</p>;
  }
  if (allApps.length === 0) {
    return (
      <p className="py-12 text-center text-sm text-muted">
        No applications yet — add some on the Tracker page and the funnel will
        appear here.
      </p>
    );
  }

  const mode = dark ? "dark" : "light";
  const nodeColor = (node: { id: string | number }) => {
    const id = String(node.id);
    const stage = STAGES.find((s) => STAGE_LABELS[s] === id);
    if (stage) return STAGE_HEX[mode][stage];
    return TERMINAL_HEX[id as Terminal]?.[mode] ?? "#898781";
  };

  return (
    <>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
        <h1 className="text-sm font-semibold">Application funnel</h1>
        <SeasonTabs apps={allApps} value={season} onChange={setSeason} />
        <span className="text-xs text-muted">
          {apps.length} application{apps.length === 1 ? "" : "s"} · hover a band
          for counts
        </span>
      </div>

      <div className="rounded-xl border border-hairline bg-surface p-2">
        <div className="h-[480px]">
          <ResponsiveSankey
            data={data!}
            margin={{ top: 20, right: 130, bottom: 20, left: 110 }}
            colors={nodeColor}
            nodeThickness={10}
            nodeSpacing={28}
            nodeBorderRadius={2}
            nodeOpacity={1}
            nodeHoverOthersOpacity={0.35}
            linkOpacity={0.55}
            linkHoverOpacity={0.8}
            linkHoverOthersOpacity={0.15}
            linkBlendMode="normal"
            enableLinkGradient
            label={(node) => `${node.id}: ${node.value}`}
            labelPosition="outside"
            labelPadding={12}
            labelTextColor={dark ? "#c3c2b7" : "#52514e"}
            theme={{
              text: {
                fontSize: 12,
                fontFamily:
                  'var(--font-geist-sans), system-ui, -apple-system, "Segoe UI", sans-serif',
              },
              tooltip: {
                container: {
                  background: dark ? "#1a1a19" : "#fcfcfb",
                  color: dark ? "#ffffff" : "#0b0b0b",
                  fontSize: 12,
                  borderRadius: 8,
                  boxShadow: "0 2px 8px rgba(0,0,0,0.25)",
                },
              },
            }}
          />
        </div>
      </div>

      <div className="mt-4 overflow-x-auto rounded-xl border border-hairline bg-surface">
        <table className="w-full min-w-96 border-collapse text-sm">
          <thead>
            <tr className="border-b border-hairline text-left text-xs text-muted">
              <th className="px-4 py-2 font-medium">Stage</th>
              <th className="px-4 py-2 text-right font-medium">Reached</th>
              <th className="px-4 py-2 text-right font-medium">Rejected here</th>
            </tr>
          </thead>
          <tbody>
            {counts.map((row) => (
              <tr
                key={row.stage}
                className="border-b border-hairline last:border-b-0"
              >
                <td className="px-4 py-2 text-ink-2">{row.stage}</td>
                <td className="px-4 py-2 text-right tabular-nums">
                  {row.reached}
                </td>
                <td className="px-4 py-2 text-right tabular-nums">
                  {row.rejectedAt}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}
