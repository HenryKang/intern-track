import Database from "better-sqlite3";
import fs from "node:fs";
import path from "node:path";
import type {
  Application,
  ApplicationWithEvents,
  AppEvent,
  EventType,
  Stage,
  Status,
} from "./types";

export { STAGES, STATUSES } from "./types";
export type { Application, ApplicationWithEvents, AppEvent };

const DATA_DIR = path.join(process.cwd(), "data");

let _db: Database.Database | null = null;

export function db(): Database.Database {
  if (_db) return _db;
  fs.mkdirSync(DATA_DIR, { recursive: true });
  _db = new Database(path.join(DATA_DIR, "tracker.db"));
  _db.pragma("journal_mode = WAL");
  _db.pragma("foreign_keys = ON");
  _db.exec(`
    CREATE TABLE IF NOT EXISTS applications (
      id            INTEGER PRIMARY KEY,
      company       TEXT NOT NULL,
      title         TEXT NOT NULL,
      url           TEXT,
      date_applied  TEXT,
      status        TEXT NOT NULL DEFAULT 'ongoing',
      stage         TEXT NOT NULL DEFAULT 'applied',
      resume        TEXT,
      notes         TEXT,
      created_at    TEXT DEFAULT (datetime('now'))
    );
    CREATE TABLE IF NOT EXISTS events (
      id             INTEGER PRIMARY KEY,
      application_id INTEGER NOT NULL REFERENCES applications(id) ON DELETE CASCADE,
      type           TEXT NOT NULL,
      starts_at      TEXT NOT NULL,
      label          TEXT
    );
  `);
  return _db;
}

export function listApplications(): ApplicationWithEvents[] {
  const apps = db()
    .prepare("SELECT * FROM applications ORDER BY id DESC")
    .all() as Application[];
  const events = db()
    .prepare("SELECT * FROM events ORDER BY starts_at")
    .all() as AppEvent[];
  const byApp = new Map<number, AppEvent[]>();
  for (const e of events) {
    const list = byApp.get(e.application_id) ?? [];
    list.push(e);
    byApp.set(e.application_id, list);
  }
  return apps.map((a) => ({ ...a, events: byApp.get(a.id) ?? [] }));
}

export function createApplication(input: {
  company: string;
  title: string;
  url?: string | null;
  date_applied?: string | null;
  status?: Status;
  stage?: Stage;
  resume?: string | null;
  notes?: string | null;
}): ApplicationWithEvents {
  const res = db()
    .prepare(
      `INSERT INTO applications (company, title, url, date_applied, status, stage, resume, notes)
       VALUES (@company, @title, @url, @date_applied, @status, @stage, @resume, @notes)`
    )
    .run({
      company: input.company,
      title: input.title,
      url: input.url ?? null,
      date_applied: input.date_applied ?? null,
      status: input.status ?? "ongoing",
      stage: input.stage ?? "applied",
      resume: input.resume ?? null,
      notes: input.notes ?? null,
    });
  const app = db()
    .prepare("SELECT * FROM applications WHERE id = ?")
    .get(res.lastInsertRowid) as Application;
  return { ...app, events: [] };
}

const APP_COLUMNS = new Set([
  "company",
  "title",
  "url",
  "date_applied",
  "status",
  "stage",
  "resume",
  "notes",
]);

export function updateApplication(
  id: number,
  patch: Record<string, unknown>
): Application | null {
  const keys = Object.keys(patch).filter((k) => APP_COLUMNS.has(k));
  if (keys.length > 0) {
    const sets = keys.map((k) => `${k} = @${k}`).join(", ");
    db()
      .prepare(`UPDATE applications SET ${sets} WHERE id = @id`)
      .run({ ...patch, id });
  }
  return (
    (db().prepare("SELECT * FROM applications WHERE id = ?").get(id) as
      | Application
      | undefined) ?? null
  );
}

export function deleteApplication(id: number): void {
  db().prepare("DELETE FROM applications WHERE id = ?").run(id);
}

export function createEvent(input: {
  application_id: number;
  type: EventType;
  starts_at: string;
  label?: string | null;
}): AppEvent {
  const res = db()
    .prepare(
      `INSERT INTO events (application_id, type, starts_at, label)
       VALUES (@application_id, @type, @starts_at, @label)`
    )
    .run({ ...input, label: input.label ?? null });
  return db()
    .prepare("SELECT * FROM events WHERE id = ?")
    .get(res.lastInsertRowid) as AppEvent;
}

const EVENT_COLUMNS = new Set(["type", "starts_at", "label"]);

export function updateEvent(
  id: number,
  patch: Record<string, unknown>
): AppEvent | null {
  const keys = Object.keys(patch).filter((k) => EVENT_COLUMNS.has(k));
  if (keys.length > 0) {
    const sets = keys.map((k) => `${k} = @${k}`).join(", ");
    db()
      .prepare(`UPDATE events SET ${sets} WHERE id = @id`)
      .run({ ...patch, id });
  }
  return (
    (db().prepare("SELECT * FROM events WHERE id = ?").get(id) as
      | AppEvent
      | undefined) ?? null
  );
}

export function deleteEvent(id: number): void {
  db().prepare("DELETE FROM events WHERE id = ?").run(id);
}

export function listResumes(): string[] {
  const rows = db()
    .prepare(
      "SELECT DISTINCT resume FROM applications WHERE resume IS NOT NULL AND resume != '' ORDER BY resume"
    )
    .all() as { resume: string }[];
  return rows.map((r) => r.resume);
}
