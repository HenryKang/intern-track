"use client";

import { useEffect, useState } from "react";
import type { Application } from "@/lib/types";
import { normalizeCompanyClient } from "@/lib/companyMatch";

interface Suggestion {
  title: string;
  url: string;
  season: string | null;
  alive: boolean;
}

interface Candidate {
  id: number;
  kind: "application" | "oa" | "rejection" | "interview";
  company: string;
  title: string | null;
  url: string | null;
  applied_date: string | null;
  evidence: string | null;
  suggestions: Suggestion[];
}

const KIND_LABELS = {
  application: "New application",
  oa: "OA invite",
  rejection: "Rejection",
  interview: "Interview",
} as const;

const inputCls =
  "rounded-md border border-hairline bg-surface px-2 py-1 text-xs text-ink outline-none placeholder:text-muted focus:border-accent";

function ApplicationRow({
  c,
  onDone,
}: {
  c: Candidate;
  onDone: () => void;
}) {
  const best = c.suggestions[0];
  const [title, setTitle] = useState(c.title ?? best?.title ?? "");
  const [season, setSeason] = useState(best?.season ?? "");
  const [busy, setBusy] = useState(false);

  async function confirm() {
    if (!title.trim()) return;
    setBusy(true);
    const matched = c.suggestions.find((s) => s.title === title);
    await fetch(`/api/candidates/${c.id}/confirm`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        title: title.trim(),
        season: season || null,
        url: matched?.url ?? c.url ?? null,
      }),
    });
    setBusy(false);
    onDone();
  }

  return (
    <div className="flex flex-wrap items-center gap-2">
      <input
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        list={`cand-titles-${c.id}`}
        placeholder="Position title — pick a match or type"
        className={`${inputCls} w-72`}
      />
      <datalist id={`cand-titles-${c.id}`}>
        {c.suggestions.map((s) => (
          <option key={s.url} value={s.title} />
        ))}
      </datalist>
      <input
        value={season}
        onChange={(e) => setSeason(e.target.value)}
        placeholder="Season"
        className={`${inputCls} w-28`}
      />
      <button
        onClick={confirm}
        disabled={busy || !title.trim()}
        className="rounded-md bg-accent px-3 py-1 text-xs font-medium text-white hover:opacity-90 disabled:opacity-40"
      >
        Confirm
      </button>
      {c.suggestions.length > 0 && (
        <span className="text-[11px] text-muted">
          {c.suggestions.length} radar match
          {c.suggestions.length === 1 ? "" : "es"}
        </span>
      )}
    </div>
  );
}

function UpdateRow({
  c,
  apps,
  onDone,
}: {
  c: Candidate;
  apps: Application[];
  onDone: () => void;
}) {
  const norm = normalizeCompanyClient(c.company);
  const ranked = [...apps].sort((a, b) => {
    const am = normalizeCompanyClient(a.company) === norm ? 0 : 1;
    const bm = normalizeCompanyClient(b.company) === norm ? 0 : 1;
    return am - bm;
  });
  const [appId, setAppId] = useState<number | "">(
    ranked[0] && normalizeCompanyClient(ranked[0].company) === norm
      ? ranked[0].id
      : ""
  );
  const [busy, setBusy] = useState(false);

  const action =
    c.kind === "oa"
      ? "Set stage to OA"
      : c.kind === "rejection"
        ? "Mark rejected"
        : "Set stage to First Round";

  async function apply() {
    if (!appId) return;
    setBusy(true);
    await fetch(`/api/candidates/${c.id}/confirm`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ application_id: appId }),
    });
    setBusy(false);
    onDone();
  }

  return (
    <div className="flex flex-wrap items-center gap-2">
      <select
        value={appId}
        onChange={(e) => setAppId(e.target.value ? Number(e.target.value) : "")}
        className={inputCls}
      >
        <option value="">Pick application…</option>
        {ranked.map((a) => (
          <option key={a.id} value={a.id}>
            {a.company} — {a.title.slice(0, 40)}
          </option>
        ))}
      </select>
      <button
        onClick={apply}
        disabled={busy || !appId}
        className="rounded-md bg-accent px-3 py-1 text-xs font-medium text-white hover:opacity-90 disabled:opacity-40"
      >
        {action}
      </button>
    </div>
  );
}

export default function ReviewQueue({
  apps,
  onChanged,
}: {
  apps: Application[];
  onChanged: () => void;
}) {
  const [candidates, setCandidates] = useState<Candidate[]>([]);

  async function refresh() {
    setCandidates(await (await fetch("/api/candidates")).json());
  }
  useEffect(() => {
    refresh();
  }, []);

  async function dismiss(id: number) {
    await fetch(`/api/candidates/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ state: "dismissed" }),
    });
    refresh();
  }

  if (candidates.length === 0) return null;

  return (
    <section className="mb-6 rounded-xl border border-accent/40 bg-surface p-4">
      <h2 className="mb-3 text-sm font-semibold">
        Inbox review{" "}
        <span className="font-normal text-muted">
          ({candidates.length} from Gmail sync)
        </span>
      </h2>
      <ul className="flex flex-col gap-3">
        {candidates.map((c) => (
          <li
            key={c.id}
            className="flex flex-col gap-2 border-t border-hairline pt-3 first:border-t-0 first:pt-0"
          >
            <div className="flex flex-wrap items-center gap-2 text-xs">
              <span className="rounded-full border border-hairline px-2 py-0.5 text-[11px] text-ink-2">
                {KIND_LABELS[c.kind]}
              </span>
              <span className="font-medium text-ink">{c.company}</span>
              {c.applied_date && (
                <span className="text-muted">{c.applied_date}</span>
              )}
              {c.evidence && (
                <span className="max-w-96 truncate text-muted" title={c.evidence}>
                  “{c.evidence}”
                </span>
              )}
              <button
                onClick={() => dismiss(c.id)}
                className="ml-auto text-muted hover:text-critical"
              >
                Dismiss
              </button>
            </div>
            {c.kind === "application" ? (
              <ApplicationRow
                c={c}
                onDone={() => {
                  refresh();
                  onChanged();
                }}
              />
            ) : (
              <UpdateRow
                c={c}
                apps={apps}
                onDone={() => {
                  refresh();
                  onChanged();
                }}
              />
            )}
          </li>
        ))}
      </ul>
    </section>
  );
}
