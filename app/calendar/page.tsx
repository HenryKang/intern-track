"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  ApplicationWithEvents,
  AppEvent,
  EVENT_TYPE_LABELS,
  daysUntil,
  formatDateShort,
  todayISO,
} from "@/lib/types";
import { SeasonTabs, useSeasonFilter } from "@/components/SeasonFilter";

interface CalEvent extends AppEvent {
  company: string;
  title: string;
}

const WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

function monthLabel(year: number, month: number): string {
  return new Date(year, month, 1).toLocaleDateString("en-US", {
    month: "long",
    year: "numeric",
  });
}

/** 42 cells (6 weeks) covering the given month, Sunday-first. */
function monthCells(year: number, month: number): string[] {
  const first = new Date(year, month, 1);
  const start = new Date(year, month, 1 - first.getDay());
  return Array.from({ length: 42 }, (_, i) => {
    const d = new Date(start.getFullYear(), start.getMonth(), start.getDate() + i);
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(
      d.getDate()
    ).padStart(2, "0")}`;
  });
}

function EventChip({ ev }: { ev: CalEvent }) {
  const isOA = ev.type === "oa_deadline";
  const time =
    ev.starts_at.length > 10
      ? new Date(ev.starts_at).toLocaleTimeString("en-US", {
          hour: "numeric",
          minute: "2-digit",
        })
      : null;
  return (
    <Link
      href={`/?focus=${ev.application_id}`}
      title={`${ev.company} — ${EVENT_TYPE_LABELS[ev.type]}${
        time ? ` at ${time}` : ""
      }${ev.label ? ` (${ev.label})` : ""}`}
      className={`flex items-center gap-1 truncate rounded border border-hairline bg-surface px-1 py-0.5 text-[11px] leading-tight hover:border-baseline ${
        ev.done ? "text-muted line-through opacity-60" : "text-ink-2"
      }`}
    >
      <span
        aria-hidden
        className={`size-1.5 shrink-0 rounded-full ${
          isOA ? "bg-cat-2" : "bg-cat-1"
        }`}
      />
      <span className="truncate">
        {isOA ? "OA · " : ""}
        {ev.company}
      </span>
    </Link>
  );
}

export default function CalendarPage() {
  const now = new Date();
  const [year, setYear] = useState(now.getFullYear());
  const [month, setMonth] = useState(now.getMonth());
  const [apps, setApps] = useState<ApplicationWithEvents[] | null>(null);
  const { season, setSeason, apply } = useSeasonFilter();

  useEffect(() => {
    fetch("/api/applications")
      .then((r) => r.json())
      .then(setApps);
  }, []);

  const events = useMemo<CalEvent[]>(
    () =>
      apply(apps ?? []).flatMap((a) =>
        a.events.map((e) => ({ ...e, company: a.company, title: a.title }))
      ),
    [apps, apply]
  );

  const byDate = useMemo(() => {
    const m = new Map<string, CalEvent[]>();
    for (const e of events) {
      const d = e.starts_at.slice(0, 10);
      const list = m.get(d) ?? [];
      list.push(e);
      m.set(d, list);
    }
    for (const list of m.values())
      list.sort((a, b) => a.starts_at.localeCompare(b.starts_at));
    return m;
  }, [events]);

  const upcoming = useMemo(
    () =>
      events
        .filter((e) => {
          const d = daysUntil(e.starts_at);
          return !e.done && d >= 0 && d <= 14;
        })
        .sort((a, b) => a.starts_at.localeCompare(b.starts_at)),
    [events]
  );

  function shift(delta: number) {
    const d = new Date(year, month + delta, 1);
    setYear(d.getFullYear());
    setMonth(d.getMonth());
  }

  if (apps === null) {
    return <p className="py-12 text-center text-sm text-muted">Loading…</p>;
  }

  const cells = monthCells(year, month);
  const today = todayISO();
  const monthPrefix = `${year}-${String(month + 1).padStart(2, "0")}`;

  return (
    <div className="flex flex-col gap-6 lg:flex-row">
      <div className="min-w-0 flex-1">
        <div className="mb-3 flex items-center justify-between">
          <h1 className="text-sm font-semibold">{monthLabel(year, month)}</h1>
          <div className="flex items-center gap-1">
            <button
              onClick={() => shift(-1)}
              className="rounded-md border border-hairline px-2.5 py-1 text-sm text-ink-2 hover:border-baseline"
              aria-label="Previous month"
            >
              ‹
            </button>
            <button
              onClick={() => {
                setYear(now.getFullYear());
                setMonth(now.getMonth());
              }}
              className="rounded-md border border-hairline px-2.5 py-1 text-xs text-ink-2 hover:border-baseline"
            >
              Today
            </button>
            <button
              onClick={() => shift(1)}
              className="rounded-md border border-hairline px-2.5 py-1 text-sm text-ink-2 hover:border-baseline"
              aria-label="Next month"
            >
              ›
            </button>
          </div>
        </div>

        <div className="mb-2 flex flex-wrap items-center gap-4 text-xs text-ink-2">
          <span className="inline-flex items-center gap-1.5">
            <span aria-hidden className="size-2 rounded-full bg-cat-2" />
            OA deadline
          </span>
          <span className="inline-flex items-center gap-1.5">
            <span aria-hidden className="size-2 rounded-full bg-cat-1" />
            Interview
          </span>
          <SeasonTabs apps={apps ?? []} value={season} onChange={setSeason} />
        </div>

        <div className="overflow-hidden rounded-xl border border-hairline bg-surface">
          <div className="grid grid-cols-7 border-b border-hairline">
            {WEEKDAYS.map((d) => (
              <div
                key={d}
                className="px-2 py-1.5 text-center text-[11px] font-medium text-muted"
              >
                {d}
              </div>
            ))}
          </div>
          <div className="grid grid-cols-7">
            {cells.map((date) => {
              const inMonth = date.startsWith(monthPrefix);
              const isToday = date === today;
              const dayEvents = byDate.get(date) ?? [];
              return (
                <div
                  key={date}
                  className={`min-h-20 border-b border-r border-grid p-1 [&:nth-child(7n)]:border-r-0 ${
                    inMonth ? "" : "bg-page/60"
                  }`}
                >
                  <div
                    className={`mb-1 inline-flex size-5 items-center justify-center rounded-full text-[11px] ${
                      isToday
                        ? "bg-accent font-semibold text-white"
                        : inMonth
                          ? "text-ink-2"
                          : "text-muted"
                    }`}
                  >
                    {Number(date.slice(8))}
                  </div>
                  <div className="flex flex-col gap-0.5">
                    {dayEvents.map((ev) => (
                      <EventChip key={ev.id} ev={ev} />
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      <aside className="w-full shrink-0 lg:w-72">
        <h2 className="mb-3 text-sm font-semibold">Next 14 days</h2>
        {upcoming.length === 0 ? (
          <p className="text-xs text-muted">
            Nothing scheduled. Add OA deadlines and interviews from a row&apos;s
            detail panel on the Tracker page.
          </p>
        ) : (
          <ul className="flex flex-col gap-2">
            {upcoming.map((ev) => {
              const days = daysUntil(ev.starts_at);
              const urgent = days <= 3;
              return (
                <li
                  key={ev.id}
                  className="flex items-start gap-2 rounded-lg border border-hairline bg-surface px-3 py-2 hover:border-baseline"
                >
                  <Link
                    href={`/?focus=${ev.application_id}`}
                    className="flex min-w-0 flex-1 items-start gap-2"
                  >
                    <span
                      aria-hidden
                      className={`mt-1 size-2 shrink-0 rounded-full ${
                        ev.type === "oa_deadline" ? "bg-cat-2" : "bg-cat-1"
                      }`}
                    />
                    <span className="min-w-0 text-xs">
                      <span className="block truncate font-medium text-ink">
                        {ev.company}
                      </span>
                      <span className="block text-ink-2">
                        {EVENT_TYPE_LABELS[ev.type]} ·{" "}
                        {formatDateShort(ev.starts_at)}
                        {ev.label ? ` — ${ev.label}` : ""}
                      </span>
                    </span>
                  </Link>
                  {ev.url && (
                    <a
                      href={ev.url}
                      target="_blank"
                      rel="noreferrer"
                      className="mt-0.5 whitespace-nowrap text-[11px] text-accent hover:underline"
                      title="Open link"
                    >
                      ↗
                    </a>
                  )}
                  <span
                    className={`mt-0.5 whitespace-nowrap text-[11px] ${
                      urgent ? "font-semibold text-critical" : "text-muted"
                    }`}
                  >
                    {days === 0
                      ? "today"
                      : days === 1
                        ? "tomorrow"
                        : `${days}d`}
                  </span>
                </li>
              );
            })}
          </ul>
        )}
      </aside>
    </div>
  );
}
