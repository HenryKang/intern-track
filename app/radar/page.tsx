"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { todayISO } from "@/lib/types";

interface RadarRow {
  id: string;
  company: string;
  title: string;
  url: string;
  locations: string[];
  season: string | null;
  category: "faang" | "quant" | "other";
  alive: boolean;
  date_found: number;
  applied_id: number | null;
  match_kind: "url" | "title" | "manual" | null;
  matched_title: string | null;
}
interface CompanyRow {
  norm: string;
  company: string;
  count: number;
  category: "faang" | "quant" | "other";
}
interface Target {
  company: string;
  ats: string;
  slug: string;
  role_type: string;
  enabled: boolean;
}

const CATEGORY_TABS = [
  { key: "all", label: "All" },
  { key: "faang", label: "FAANG+" },
  { key: "quant", label: "Quant" },
  { key: "other", label: "Other" },
] as const;

const CATEGORY_BADGE: Record<string, string> = {
  faang: "FAANG+",
  quant: "Quant",
};

const inputCls =
  "rounded-md border border-hairline bg-surface px-2.5 py-1.5 text-sm text-ink outline-none placeholder:text-muted focus:border-accent";

const MATCH_NOTE: Record<string, string> = {
  url: "Matched to a tracker application by posting link",
  title: "Matched to a tracker application by company + title",
  manual: "Marked applied from Radar",
};

function PostingCard({
  p,
  adding,
  onApplied,
  onUnmark,
}: {
  p: RadarRow;
  adding: boolean;
  onApplied: () => void;
  onUnmark: (deleteApplication: boolean) => void;
}) {
  const [undoing, setUndoing] = useState(false);
  return (
    <div
      className={`flex flex-col gap-2 rounded-xl border border-hairline bg-surface p-4 ${
        p.alive ? "" : "opacity-50"
      }`}
    >
      <div className="flex items-start gap-3">
        <span
          aria-hidden
          className="flex size-10 shrink-0 items-center justify-center rounded-lg border border-hairline bg-page text-base font-semibold text-ink-2"
        >
          {p.company.charAt(0).toUpperCase()}
        </span>
        <div className="min-w-0">
          <a
            href={p.url}
            target="_blank"
            rel="noreferrer"
            title={p.title}
            className="line-clamp-2 text-sm font-medium leading-snug text-ink hover:text-accent hover:underline"
          >
            {p.title}
          </a>
          <p className="truncate text-xs text-ink-2">{p.company}</p>
        </div>
      </div>
      <div className="flex flex-wrap items-center gap-1.5 text-[11px]">
        {CATEGORY_BADGE[p.category] && (
          <span className="rounded-full border border-accent/40 px-2 py-0.5 text-accent">
            {CATEGORY_BADGE[p.category]}
          </span>
        )}
        {p.locations.slice(0, 2).map((loc) => (
          <span
            key={loc}
            className="rounded-full border border-hairline px-2 py-0.5 text-ink-2"
          >
            {loc}
          </span>
        ))}
        {p.locations.length > 2 && (
          <span className="text-muted">+{p.locations.length - 2} more</span>
        )}
        {p.season && (
          <span className="rounded-full border border-hairline px-2 py-0.5 text-ink-2">
            {p.season}
          </span>
        )}
        {!p.alive && <span className="text-muted">closed</span>}
      </div>
      <div className="mt-auto flex flex-wrap items-center justify-between gap-2 pt-1">
        <span className="text-[11px] text-muted">
          {p.date_found
            ? "Found · " +
              new Date(p.date_found * 1000).toLocaleDateString("en-US", {
                month: "short",
                day: "numeric",
              })
            : ""}
        </span>
        {undoing ? (
          <span className="flex items-center gap-1.5 text-[11px]">
            <button
              onClick={() => {
                setUndoing(false);
                onUnmark(false);
              }}
              title="Keep the tracker row, just clear the ✓ here"
              className="rounded-md border border-hairline px-2 py-1 text-ink-2 hover:border-baseline"
            >
              Unmark only
            </button>
            <button
              onClick={() => {
                setUndoing(false);
                onUnmark(true);
              }}
              title={`Delete “${p.matched_title ?? p.title}” from the tracker`}
              className="rounded-md border border-hairline px-2 py-1 text-critical hover:border-critical"
            >
              Delete row
            </button>
            <button
              onClick={() => setUndoing(false)}
              className="px-1 text-muted hover:text-ink"
            >
              Cancel
            </button>
          </span>
        ) : p.applied_id ? (
          <button
            onClick={() => setUndoing(true)}
            title={`${MATCH_NOTE[p.match_kind ?? "manual"]}${
              p.matched_title ? `: “${p.matched_title}”` : ""
            } — click to undo`}
            className="rounded-md px-2 py-1 text-xs font-medium text-good-text hover:bg-hairline"
          >
            ✓ Applied
          </button>
        ) : (
          <button
            onClick={onApplied}
            disabled={adding}
            className="rounded-md border border-hairline px-2.5 py-1 text-xs text-ink-2 hover:border-baseline disabled:opacity-50"
          >
            {adding ? "Adding…" : "I applied"}
          </button>
        )}
      </div>
    </div>
  );
}

function CompaniesPanel({ onCategoryChanged }: { onCategoryChanged: () => void }) {
  const [companies, setCompanies] = useState<CompanyRow[]>([]);
  const [targets, setTargets] = useState<Target[]>([]);
  const [dirty, setDirty] = useState(false);
  const [filter, setFilter] = useState("");
  const [pushMsg, setPushMsg] = useState<string | null>(null);
  const [add, setAdd] = useState({ company: "", ats: "greenhouse", slug: "", role_type: "intern" });

  async function refresh() {
    setCompanies(await (await fetch("/api/radar/companies")).json());
    const t = await (await fetch("/api/radar/targets")).json();
    setTargets(t.targets ?? []);
    setDirty(t.dirty ?? false);
  }
  useEffect(() => {
    refresh();
  }, []);

  async function setCategory(row: CompanyRow, category: string) {
    await fetch("/api/radar/companies", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ company: row.company, category }),
    });
    refresh();
    onCategoryChanged();
  }

  async function toggleTarget(t: Target) {
    await fetch("/api/radar/targets", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...t, enabled: !t.enabled }),
    });
    refresh();
  }

  async function addTarget(e: React.FormEvent) {
    e.preventDefault();
    if (!add.company.trim() || !add.slug.trim()) return;
    await fetch("/api/radar/targets", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "add", ...add }),
    });
    setAdd({ company: "", ats: "greenhouse", slug: "", role_type: "intern" });
    refresh();
  }

  async function push() {
    setPushMsg("Pushing…");
    const r = await fetch("/api/radar/targets", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "push" }),
    });
    const d = await r.json();
    setPushMsg(r.ok ? "Pushed ✓" : `Failed: ${d.error}`);
    refresh();
  }

  const shownCompanies = companies
    .filter((c) => c.company.toLowerCase().includes(filter.toLowerCase()))
    .slice(0, 40);

  return (
    <section className="mb-5 grid gap-5 rounded-xl border border-hairline bg-surface p-4 lg:grid-cols-2">
      <div>
        <h2 className="mb-1 text-sm font-semibold">Company categories</h2>
        <p className="mb-2 text-xs text-muted">
          Drives the FAANG+ / Quant / Other filter. Built-in defaults; changes
          here override them.
        </p>
        <input
          value={filter}
          onChange={(e) => setFilter(e.target.value)}
          placeholder="Find a company…"
          className={`${inputCls} mb-2 w-full text-xs`}
        />
        <ul className="flex max-h-72 flex-col gap-1 overflow-y-auto pr-1">
          {shownCompanies.map((c) => (
            <li key={c.norm} className="flex items-center gap-2 text-xs">
              <span className="min-w-0 flex-1 truncate text-ink-2">
                {c.company}{" "}
                <span className="text-muted">({c.count})</span>
              </span>
              <select
                value={c.category}
                onChange={(e) => setCategory(c, e.target.value)}
                className="rounded-md border border-hairline bg-surface px-1.5 py-0.5 text-xs text-ink outline-none"
              >
                <option value="faang">FAANG+</option>
                <option value="quant">Quant</option>
                <option value="other">Other</option>
              </select>
            </li>
          ))}
        </ul>
      </div>
      <div>
        <h2 className="mb-1 text-sm font-semibold">Radar ATS targets</h2>
        <p className="mb-2 text-xs text-muted">
          Company boards intern-radar polls directly (config/sources.yaml).
          Edits are local until you push them to GitHub, where the scheduled
          crawl runs.
        </p>
        <ul className="flex max-h-60 flex-col gap-1 overflow-y-auto pr-1">
          {targets.map((t) => (
            <li
              key={`${t.slug}-${t.ats}-${t.role_type}-${t.company}`}
              className="flex items-center gap-2 text-xs"
            >
              <input
                type="checkbox"
                checked={t.enabled}
                onChange={() => toggleTarget(t)}
                className="accent-[var(--accent)]"
                title={t.enabled ? "Disable target" : "Enable target"}
              />
              <span className="min-w-0 flex-1 truncate text-ink-2">
                {t.company}
                <span className="text-muted">
                  {" "}
                  · {t.ats}:{t.slug} · {t.role_type}
                </span>
              </span>
            </li>
          ))}
        </ul>
        <form onSubmit={addTarget} className="mt-2 flex flex-wrap items-center gap-1.5">
          <input
            value={add.company}
            onChange={(e) => setAdd({ ...add, company: e.target.value })}
            placeholder="Company"
            className={`${inputCls} w-28 text-xs`}
          />
          <select
            value={add.ats}
            onChange={(e) => setAdd({ ...add, ats: e.target.value })}
            className={`${inputCls} text-xs`}
          >
            <option value="greenhouse">greenhouse</option>
            <option value="lever">lever</option>
            <option value="ashby">ashby</option>
            <option value="workday">workday</option>
          </select>
          <input
            value={add.slug}
            onChange={(e) => setAdd({ ...add, slug: e.target.value })}
            placeholder="board slug"
            className={`${inputCls} w-28 text-xs`}
          />
          <select
            value={add.role_type}
            onChange={(e) => setAdd({ ...add, role_type: e.target.value })}
            className={`${inputCls} text-xs`}
          >
            <option value="intern">intern</option>
            <option value="new_grad">new_grad</option>
          </select>
          <button
            type="submit"
            className="rounded-md border border-hairline px-2.5 py-1 text-xs text-ink-2 hover:border-baseline"
          >
            Add
          </button>
        </form>
        {dirty && (
          <div className="mt-2 flex items-center gap-2">
            <button
              onClick={push}
              className="rounded-md bg-accent px-3 py-1 text-xs font-medium text-white hover:opacity-90"
            >
              Push config to GitHub
            </button>
            {pushMsg && <span className="text-xs text-muted">{pushMsg}</span>}
          </div>
        )}
      </div>
    </section>
  );
}

export default function RadarPage() {
  const [data, setData] = useState<{ available: boolean; postings: RadarRow[] } | null>(null);
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState<string>("all");
  const [liveOnly, setLiveOnly] = useState(true);
  const [adding, setAdding] = useState<string | null>(null);
  const [showCompanies, setShowCompanies] = useState(false);
  const [refreshState, setRefreshState] = useState<string | null>(null);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  async function refresh() {
    setData(await (await fetch("/api/radar")).json());
  }
  useEffect(() => {
    refresh();
    return () => {
      if (pollRef.current) clearInterval(pollRef.current);
    };
  }, []);

  async function runSearch() {
    setRefreshState("Starting crawl…");
    const r = await fetch("/api/radar/refresh", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "trigger" }),
    });
    if (!r.ok) {
      const d = await r.json();
      setRefreshState(`Trigger failed: ${d.error}`);
      return;
    }
    setRefreshState("Crawling on GitHub… results usually land in 1–3 min");
    let tries = 0;
    pollRef.current = setInterval(async () => {
      tries++;
      const pr = await fetch("/api/radar/refresh", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "pull" }),
      });
      const pd = await pr.json();
      if (pd.updated) {
        if (pollRef.current) clearInterval(pollRef.current);
        setRefreshState("Updated ✓");
        refresh();
        setTimeout(() => setRefreshState(null), 4000);
      } else if (tries > 18) {
        if (pollRef.current) clearInterval(pollRef.current);
        setRefreshState("No new commit yet — check back shortly");
        setTimeout(() => setRefreshState(null), 6000);
      }
    }, 15000);
  }

  const rows = useMemo(() => {
    let list = data?.postings ?? [];
    if (liveOnly) list = list.filter((p) => p.alive || p.applied_id !== null);
    if (category !== "all") list = list.filter((p) => p.category === category);
    const q = query.trim().toLowerCase();
    if (q) {
      list = list.filter(
        (p) =>
          p.company.toLowerCase().includes(q) || p.title.toLowerCase().includes(q)
      );
    }
    return list.slice(0, 120);
  }, [data, query, liveOnly, category]);

  async function markApplied(p: RadarRow) {
    setAdding(p.id);
    await fetch("/api/radar/applied", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        posting_id: p.id,
        company: p.company,
        title: p.title,
        url: p.url,
        date_applied: todayISO(),
        season: p.season,
      }),
    });
    setAdding(null);
    refresh();
  }

  async function unmarkApplied(p: RadarRow, deleteApplication: boolean) {
    await fetch("/api/radar/applied", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        posting_id: p.id,
        application_id: p.applied_id,
        delete_application: deleteApplication,
      }),
    });
    refresh();
  }

  if (data === null) {
    return <p className="py-12 text-center text-sm text-muted">Loading…</p>;
  }
  if (!data.available) {
    return (
      <p className="py-12 text-center text-sm text-muted">
        intern-radar archive not found — expected postings at
        ~/intern-radar/data/postings.json (override with RADAR_DIR).
      </p>
    );
  }

  return (
    <>
      <div className="mb-4 flex flex-wrap items-center gap-2">
        <h1 className="mr-1 text-sm font-semibold">Radar</h1>
        <div className="flex items-center gap-1">
          {CATEGORY_TABS.map((t) => (
            <button
              key={t.key}
              onClick={() => setCategory(t.key)}
              className={`rounded-full border px-3 py-1 text-xs transition-colors ${
                category === t.key
                  ? "border-accent bg-accent/10 font-medium text-accent"
                  : "border-hairline text-ink-2 hover:border-baseline"
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Filter by company or title…"
          className={`${inputCls} w-56 text-xs`}
        />
        <label className="flex cursor-pointer items-center gap-1.5 text-xs text-ink-2">
          <input
            type="checkbox"
            checked={liveOnly}
            onChange={(e) => setLiveOnly(e.target.checked)}
            className="accent-[var(--accent)]"
          />
          Live only
        </label>
        <div className="ml-auto flex items-center gap-2">
          <button
            onClick={() => setShowCompanies(!showCompanies)}
            className={`rounded-md border px-2.5 py-1 text-xs ${
              showCompanies
                ? "border-accent text-accent"
                : "border-hairline text-ink-2 hover:border-baseline"
            }`}
          >
            Companies
          </button>
          <button
            onClick={runSearch}
            disabled={refreshState !== null && refreshState.includes("…")}
            className="rounded-md border border-hairline px-2.5 py-1 text-xs text-ink-2 hover:border-baseline disabled:opacity-50"
          >
            Refresh
          </button>
        </div>
      </div>
      {refreshState && (
        <p className="mb-3 text-xs text-muted">{refreshState}</p>
      )}

      {showCompanies && <CompaniesPanel onCategoryChanged={refresh} />}

      <p className="mb-3 text-xs text-muted">
        {rows.length} posting{rows.length === 1 ? "" : "s"} · newest first ·
        “I applied” adds a prefilled row to the tracker
      </p>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {rows.map((p) => (
          <PostingCard
            key={p.id}
            p={p}
            adding={adding === p.id}
            onApplied={() => markApplied(p)}
            onUnmark={(del) => unmarkApplied(p, del)}
          />
        ))}
      </div>
    </>
  );
}
