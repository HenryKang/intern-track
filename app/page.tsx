"use client";

import {
  Suspense,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { useSearchParams } from "next/navigation";
import {
  ApplicationWithEvents,
  AppEvent,
  EventType,
  EVENT_TYPE_LABELS,
  Stage,
  Status,
  daysUntil,
  formatDateShort,
  nextUpcomingEvent,
  todayISO,
} from "@/lib/types";
import { StageSelect, StatusSelect } from "@/components/chips";

async function api(path: string, init?: RequestInit) {
  const res = await fetch(path, {
    headers: { "Content-Type": "application/json" },
    ...init,
  });
  return res.json();
}

const inputCls =
  "rounded-md border border-hairline bg-surface px-2.5 py-1.5 text-sm text-ink outline-none placeholder:text-muted focus:border-accent";

function QuickAdd({ onAdded }: { onAdded: () => void }) {
  const [url, setUrl] = useState("");
  const [company, setCompany] = useState("");
  const [title, setTitle] = useState("");
  const [dateApplied, setDateApplied] = useState(todayISO());
  const [resume, setResume] = useState("");
  const [note, setNote] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function autofill() {
    if (!url.trim()) return;
    setBusy(true);
    setNote(null);
    const data = await api("/api/parse-url", {
      method: "POST",
      body: JSON.stringify({ url }),
    });
    setBusy(false);
    if (data.supported) {
      setCompany(data.company);
      setTitle(data.title);
      setNote(`Autofilled from ${data.ats}`);
    } else {
      setNote(data.error);
    }
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!company.trim() || !title.trim()) return;
    await api("/api/applications", {
      method: "POST",
      body: JSON.stringify({
        company: company.trim(),
        title: title.trim(),
        url: url.trim() || null,
        date_applied: dateApplied || null,
        resume: resume.trim() || null,
      }),
    });
    setUrl("");
    setCompany("");
    setTitle("");
    setDateApplied(todayISO());
    setNote(null);
    onAdded();
  }

  return (
    <form
      onSubmit={submit}
      className="mb-6 rounded-xl border border-hairline bg-surface p-4"
    >
      <div className="mb-3 flex gap-2">
        <input
          value={url}
          onChange={(e) => setUrl(e.target.value)}
          placeholder="Paste a job posting URL (Greenhouse / Lever / Ashby) — or fill in manually below"
          className={`${inputCls} flex-1`}
        />
        <button
          type="button"
          onClick={autofill}
          disabled={busy || !url.trim()}
          className="rounded-md border border-hairline px-3 py-1.5 text-sm text-ink-2 hover:border-baseline disabled:opacity-50"
        >
          {busy ? "Looking up…" : "Autofill"}
        </button>
      </div>
      <div className="flex flex-wrap items-end gap-2">
        <label className="flex flex-1 basis-40 flex-col gap-1 text-xs text-muted">
          Company
          <input
            required
            value={company}
            onChange={(e) => setCompany(e.target.value)}
            className={inputCls}
          />
        </label>
        <label className="flex flex-[2] basis-60 flex-col gap-1 text-xs text-muted">
          Position
          <input
            required
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            className={inputCls}
          />
        </label>
        <label className="flex basis-36 flex-col gap-1 text-xs text-muted">
          Date applied
          <input
            type="date"
            value={dateApplied}
            onChange={(e) => setDateApplied(e.target.value)}
            className={inputCls}
          />
        </label>
        <label className="flex basis-40 flex-col gap-1 text-xs text-muted">
          Resume used
          <input
            value={resume}
            onChange={(e) => setResume(e.target.value)}
            list="resume-options"
            placeholder="e.g. swe-v3"
            className={inputCls}
          />
        </label>
        <button
          type="submit"
          className="rounded-md bg-accent px-4 py-1.5 text-sm font-medium text-white hover:opacity-90"
        >
          Add
        </button>
      </div>
      {note && <p className="mt-2 text-xs text-muted">{note}</p>}
    </form>
  );
}

function NextDeadlineCell({ app }: { app: ApplicationWithEvents }) {
  const ev = nextUpcomingEvent(app.events);
  if (!ev) return <span className="text-muted">—</span>;
  const days = daysUntil(ev.starts_at);
  const urgent = days <= 3;
  const dayText = days === 0 ? "today" : days === 1 ? "tomorrow" : `in ${days}d`;
  return (
    <span className="inline-flex items-center gap-1.5 whitespace-nowrap text-xs">
      <span
        aria-hidden
        className={`inline-block size-2 rounded-full ${
          ev.type === "oa_deadline" ? "bg-cat-2" : "bg-cat-1"
        }`}
      />
      <span className="text-ink-2">
        {ev.type === "oa_deadline" ? "OA due" : "Interview"}{" "}
        {formatDateShort(ev.starts_at)}
      </span>
      <span className={urgent ? "font-semibold text-critical" : "text-muted"}>
        {urgent ? "⚠ " : ""}
        {dayText}
      </span>
    </span>
  );
}

function EventRow({
  ev,
  onDelete,
}: {
  ev: AppEvent;
  onDelete: () => void;
}) {
  const past = daysUntil(ev.starts_at) < 0;
  return (
    <li className="flex items-center gap-2 text-xs">
      <span
        aria-hidden
        className={`inline-block size-2 rounded-full ${
          ev.type === "oa_deadline" ? "bg-cat-2" : "bg-cat-1"
        }`}
      />
      <span className={past ? "text-muted line-through" : "text-ink-2"}>
        {EVENT_TYPE_LABELS[ev.type]} · {formatDateShort(ev.starts_at)}
        {ev.starts_at.length > 10 &&
          " " +
            new Date(ev.starts_at).toLocaleTimeString("en-US", {
              hour: "numeric",
              minute: "2-digit",
            })}
        {ev.label ? ` — ${ev.label}` : ""}
      </span>
      <button
        onClick={onDelete}
        className="text-muted hover:text-critical"
        title="Delete event"
      >
        ✕
      </button>
    </li>
  );
}

function DetailPanel({
  app,
  refresh,
  onPatch,
}: {
  app: ApplicationWithEvents;
  refresh: () => void;
  onPatch: (patch: Partial<ApplicationWithEvents>) => void;
}) {
  const [notes, setNotes] = useState(app.notes ?? "");
  const [evType, setEvType] = useState<EventType>("oa_deadline");
  const [evDate, setEvDate] = useState("");
  const [evTime, setEvTime] = useState("");
  const [evLabel, setEvLabel] = useState("");
  const [editUrl, setEditUrl] = useState(app.url ?? "");

  async function addEvent(e: React.FormEvent) {
    e.preventDefault();
    if (!evDate) return;
    const starts_at =
      evType === "interview" && evTime ? `${evDate}T${evTime}` : evDate;
    await api("/api/events", {
      method: "POST",
      body: JSON.stringify({
        application_id: app.id,
        type: evType,
        starts_at,
        label: evLabel.trim() || null,
      }),
    });
    setEvDate("");
    setEvTime("");
    setEvLabel("");
    refresh();
  }

  async function deleteEvent(id: number) {
    await api(`/api/events/${id}`, { method: "DELETE" });
    refresh();
  }

  async function deleteApp() {
    if (!confirm(`Delete ${app.company} — ${app.title}?`)) return;
    await api(`/api/applications/${app.id}`, { method: "DELETE" });
    refresh();
  }

  return (
    <div className="grid gap-4 border-t border-hairline bg-page/50 px-4 py-4 text-sm md:grid-cols-2">
      <div className="flex flex-col gap-3">
        <label className="flex flex-col gap-1 text-xs text-muted">
          Notes
          <textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            onBlur={() => {
              if (notes !== (app.notes ?? "")) onPatch({ notes });
            }}
            rows={3}
            placeholder="Recruiter names, referral, prep notes…"
            className={`${inputCls} resize-y`}
          />
        </label>
        <label className="flex flex-col gap-1 text-xs text-muted">
          Job posting URL
          <input
            value={editUrl}
            onChange={(e) => setEditUrl(e.target.value)}
            onBlur={() => {
              if (editUrl !== (app.url ?? "")) onPatch({ url: editUrl || null });
            }}
            className={inputCls}
          />
        </label>
        <button
          onClick={deleteApp}
          className="self-start text-xs text-muted hover:text-critical"
        >
          Delete application
        </button>
      </div>
      <div className="flex flex-col gap-2">
        <span className="text-xs text-muted">OA deadlines & interviews</span>
        {app.events.length > 0 ? (
          <ul className="flex flex-col gap-1.5">
            {app.events.map((ev) => (
              <EventRow key={ev.id} ev={ev} onDelete={() => deleteEvent(ev.id)} />
            ))}
          </ul>
        ) : (
          <p className="text-xs text-muted">None yet.</p>
        )}
        <form onSubmit={addEvent} className="mt-1 flex flex-wrap items-center gap-2">
          <select
            value={evType}
            onChange={(e) => setEvType(e.target.value as EventType)}
            className={`${inputCls} text-xs`}
          >
            <option value="oa_deadline">OA deadline</option>
            <option value="interview">Interview</option>
          </select>
          <input
            type="date"
            required
            value={evDate}
            onChange={(e) => setEvDate(e.target.value)}
            className={`${inputCls} text-xs`}
          />
          {evType === "interview" && (
            <input
              type="time"
              value={evTime}
              onChange={(e) => setEvTime(e.target.value)}
              className={`${inputCls} text-xs`}
            />
          )}
          <input
            value={evLabel}
            onChange={(e) => setEvLabel(e.target.value)}
            placeholder="Label (optional)"
            className={`${inputCls} w-36 text-xs`}
          />
          <button
            type="submit"
            className="rounded-md border border-hairline px-2.5 py-1.5 text-xs text-ink-2 hover:border-baseline"
          >
            Add
          </button>
        </form>
      </div>
    </div>
  );
}

function sortKey(app: ApplicationWithEvents): [number, string, string] {
  const ev = nextUpcomingEvent(app.events);
  // Apps with an upcoming event first (soonest first), then by applied date desc.
  return ev
    ? [0, ev.starts_at, ""]
    : [1, "", app.date_applied ? "" : "z"];
}

function Tracker() {
  const [apps, setApps] = useState<ApplicationWithEvents[] | null>(null);
  const [activeOnly, setActiveOnly] = useState(true);
  const [expanded, setExpanded] = useState<number | null>(null);
  const searchParams = useSearchParams();
  const focusId = searchParams.get("focus");
  const focusedRef = useRef(false);

  const [uploadedResumes, setUploadedResumes] = useState<string[]>([]);

  const refresh = useCallback(async () => {
    setApps(await api("/api/applications"));
  }, []);

  useEffect(() => {
    fetch("/api/resumes")
      .then((r) => r.json())
      .then((list: { name: string }[]) =>
        setUploadedResumes(list.map((r) => r.name))
      );
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  useEffect(() => {
    if (focusId && apps && !focusedRef.current) {
      focusedRef.current = true;
      setExpanded(Number(focusId));
      document
        .getElementById(`app-${focusId}`)
        ?.scrollIntoView({ block: "center" });
    }
  }, [focusId, apps]);

  async function patchApp(id: number, patch: Partial<ApplicationWithEvents>) {
    setApps(
      (prev) =>
        prev?.map((a) => (a.id === id ? { ...a, ...patch } : a)) ?? prev
    );
    await api(`/api/applications/${id}`, {
      method: "PATCH",
      body: JSON.stringify(patch),
    });
  }

  const resumes = useMemo(
    () =>
      Array.from(
        new Set([
          ...uploadedResumes,
          ...(apps ?? [])
            .map((a) => a.resume)
            .filter((r): r is string => !!r),
        ])
      ),
    [apps, uploadedResumes]
  );

  const visible = useMemo(() => {
    let list = apps ?? [];
    if (activeOnly) list = list.filter((a) => a.status === "ongoing");
    return [...list].sort((a, b) => {
      const [ga, ea] = sortKey(a);
      const [gb, eb] = sortKey(b);
      if (ga !== gb) return ga - gb;
      if (ga === 0) return ea.localeCompare(eb);
      return (b.date_applied ?? "").localeCompare(a.date_applied ?? "");
    });
  }, [apps, activeOnly]);

  if (apps === null) {
    return <p className="py-12 text-center text-sm text-muted">Loading…</p>;
  }

  return (
    <>
      <datalist id="resume-options">
        {resumes.map((r) => (
          <option key={r} value={r} />
        ))}
      </datalist>

      <QuickAdd onAdded={refresh} />

      <div className="mb-2 flex items-center justify-between">
        <h1 className="text-sm font-semibold text-ink">
          Applications{" "}
          <span className="font-normal text-muted">({visible.length})</span>
        </h1>
        <label className="flex cursor-pointer items-center gap-1.5 text-xs text-ink-2">
          <input
            type="checkbox"
            checked={activeOnly}
            onChange={(e) => setActiveOnly(e.target.checked)}
            className="accent-[var(--accent)]"
          />
          Active only
        </label>
      </div>

      <div className="overflow-x-auto rounded-xl border border-hairline bg-surface">
        <table className="w-full min-w-[820px] border-collapse text-sm">
          <thead>
            <tr className="border-b border-hairline text-left text-xs text-muted">
              <th className="px-4 py-2.5 font-medium">Company</th>
              <th className="px-3 py-2.5 font-medium">Position</th>
              <th className="px-3 py-2.5 font-medium">Applied</th>
              <th className="px-3 py-2.5 font-medium">Stage</th>
              <th className="px-3 py-2.5 font-medium">Status</th>
              <th className="px-3 py-2.5 font-medium">Next deadline</th>
              <th className="px-3 py-2.5 font-medium">Resume</th>
              <th className="w-10 px-2 py-2.5" />
            </tr>
          </thead>
          <tbody>
            {visible.length === 0 && (
              <tr>
                <td colSpan={8} className="px-4 py-10 text-center text-muted">
                  {activeOnly && (apps.length > 0)
                    ? "No active applications — uncheck “Active only” to see all."
                    : "No applications yet. Add your first one above."}
                </td>
              </tr>
            )}
            {visible.map((app) => (
              <TrackerRow
                key={app.id}
                app={app}
                expanded={expanded === app.id}
                onToggle={() =>
                  setExpanded(expanded === app.id ? null : app.id)
                }
                onPatch={(p) => patchApp(app.id, p)}
                refresh={refresh}
              />
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}

function TrackerRow({
  app,
  expanded,
  onToggle,
  onPatch,
  refresh,
}: {
  app: ApplicationWithEvents;
  expanded: boolean;
  onToggle: () => void;
  onPatch: (patch: Partial<ApplicationWithEvents>) => void;
  refresh: () => void;
}) {
  const [editingResume, setEditingResume] = useState(false);
  const [resumeDraft, setResumeDraft] = useState(app.resume ?? "");
  const done = app.status !== "ongoing";

  return (
    <>
      <tr
        id={`app-${app.id}`}
        className={`border-b border-hairline last:border-b-0 hover:bg-page/60 ${
          done ? "opacity-60" : ""
        }`}
      >
        <td className="px-4 py-2.5 font-medium text-ink">{app.company}</td>
        <td className="max-w-64 truncate px-3 py-2.5">
          {app.url ? (
            <a
              href={app.url}
              target="_blank"
              rel="noreferrer"
              className="text-accent hover:underline"
              title={app.title}
            >
              {app.title}
            </a>
          ) : (
            <span className="text-ink-2" title={app.title}>
              {app.title}
            </span>
          )}
        </td>
        <td className="whitespace-nowrap px-3 py-2.5 text-xs text-ink-2">
          {app.date_applied ? formatDateShort(app.date_applied) : "—"}
        </td>
        <td className="px-3 py-2.5">
          <StageSelect
            value={app.stage}
            onChange={(stage: Stage) => onPatch({ stage })}
          />
        </td>
        <td className="px-3 py-2.5">
          <StatusSelect
            value={app.status}
            onChange={(status: Status) => onPatch({ status })}
          />
        </td>
        <td className="px-3 py-2.5">
          <NextDeadlineCell app={app} />
        </td>
        <td className="px-3 py-2.5 text-xs text-ink-2">
          {editingResume ? (
            <input
              autoFocus
              value={resumeDraft}
              list="resume-options"
              onChange={(e) => setResumeDraft(e.target.value)}
              onBlur={() => {
                setEditingResume(false);
                if (resumeDraft !== (app.resume ?? ""))
                  onPatch({ resume: resumeDraft || null });
              }}
              onKeyDown={(e) => {
                if (e.key === "Enter") (e.target as HTMLInputElement).blur();
              }}
              className={`${inputCls} w-24 px-1.5 py-0.5 text-xs`}
            />
          ) : (
            <button
              onClick={() => {
                setResumeDraft(app.resume ?? "");
                setEditingResume(true);
              }}
              className="rounded px-1 py-0.5 hover:bg-hairline"
              title="Edit resume used"
            >
              {app.resume || <span className="text-muted">—</span>}
            </button>
          )}
        </td>
        <td className="px-2 py-2.5 text-center">
          <button
            onClick={onToggle}
            className="rounded p-1 text-muted hover:bg-hairline hover:text-ink"
            title={expanded ? "Collapse" : "Notes & events"}
          >
            <span
              className={`inline-block text-xs transition-transform ${
                expanded ? "rotate-90" : ""
              }`}
            >
              ▸
            </span>
          </button>
        </td>
      </tr>
      {expanded && (
        <tr className="border-b border-hairline last:border-b-0">
          <td colSpan={8} className="p-0">
            <DetailPanel app={app} refresh={refresh} onPatch={onPatch} />
          </td>
        </tr>
      )}
    </>
  );
}

export default function Page() {
  return (
    <Suspense>
      <Tracker />
    </Suspense>
  );
}
