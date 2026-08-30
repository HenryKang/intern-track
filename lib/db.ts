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
    CREATE TABLE IF NOT EXISTS profile (
      key   TEXT PRIMARY KEY,
      value TEXT
    );
    CREATE TABLE IF NOT EXISTS resumes (
      id          INTEGER PRIMARY KEY,
      name        TEXT NOT NULL,
      filename    TEXT NOT NULL,
      mime        TEXT,
      size        INTEGER,
      uploaded_at TEXT DEFAULT (datetime('now'))
    );
  `);
  // Additive migrations for columns introduced after the original schema.
  const appCols = _db.prepare("PRAGMA table_info(applications)").all() as {
    name: string;
  }[];
  if (!appCols.some((c) => c.name === "season")) {
    _db.exec("ALTER TABLE applications ADD COLUMN season TEXT");
  }
  if (!appCols.some((c) => c.name === "status_manual")) {
    _db.exec(
      "ALTER TABLE applications ADD COLUMN status_manual INTEGER DEFAULT 0"
    );
  }
  const eventCols = _db.prepare("PRAGMA table_info(events)").all() as {
    name: string;
  }[];
  if (!eventCols.some((c) => c.name === "url")) {
    _db.exec("ALTER TABLE events ADD COLUMN url TEXT");
  }
  if (!eventCols.some((c) => c.name === "done")) {
    _db.exec("ALTER TABLE events ADD COLUMN done INTEGER DEFAULT 0");
  }
  // The tech_call stage was removed 2026-08; fold old rows into first_round.
  _db.exec(
    "UPDATE applications SET stage = 'first_round' WHERE stage = 'tech_call'"
  );
  if (!appCols.some((c) => c.name === "updated_at")) {
    _db.exec("ALTER TABLE applications ADD COLUMN updated_at TEXT");
    _db.exec("UPDATE applications SET updated_at = created_at");
  }
  return _db;
}

export function listApplications(): ApplicationWithEvents[] {
  // Auto-ghost: still sitting at "applied" with no outcome 60+ days after the
  // apply date means the company went silent. Runs lazily on every list; a
  // manual status change on the row overrides it from then on.
  db()
    .prepare(
      `UPDATE applications SET status = 'ghosted'
       WHERE status = 'ongoing' AND stage = 'applied'
         AND COALESCE(status_manual, 0) = 0
         AND date_applied IS NOT NULL
         AND date(date_applied) <= date('now', '-60 days')`
    )
    .run();
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
  season?: string | null;
  resume?: string | null;
  notes?: string | null;
}): ApplicationWithEvents {
  const res = db()
    .prepare(
      `INSERT INTO applications (company, title, url, date_applied, status, stage, season, resume, notes, updated_at)
       VALUES (@company, @title, @url, @date_applied, @status, @stage, @season, @resume, @notes, datetime('now'))`
    )
    .run({
      company: input.company,
      title: input.title,
      url: input.url ?? null,
      date_applied: input.date_applied ?? null,
      status: input.status ?? "ongoing",
      stage: input.stage ?? "applied",
      season: input.season ?? null,
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
  "season",
  "resume",
  "notes",
]);

export function updateApplication(
  id: number,
  patch: Record<string, unknown>
): Application | null {
  const keys = Object.keys(patch).filter((k) => APP_COLUMNS.has(k));
  if (keys.length > 0) {
    // A user-set status opts the row out of the auto-ghost sweep; stage or
    // status changes stamp updated_at so "recently updated" sorting works.
    const sets = keys
      .map((k) => `${k} = @${k}`)
      .concat(keys.includes("status") ? ["status_manual = 1"] : [])
      .concat(
        keys.includes("stage") || keys.includes("status")
          ? ["updated_at = datetime('now')"]
          : []
      )
      .join(", ");
    db()
      .prepare(`UPDATE applications SET ${sets} WHERE id = @id`)
      .run({ ...Object.fromEntries(keys.map((k) => [k, patch[k]])), id });
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
  url?: string | null;
}): AppEvent {
  const res = db()
    .prepare(
      `INSERT INTO events (application_id, type, starts_at, label, url)
       VALUES (@application_id, @type, @starts_at, @label, @url)`
    )
    .run({ ...input, label: input.label ?? null, url: input.url ?? null });
  return db()
    .prepare("SELECT * FROM events WHERE id = ?")
    .get(res.lastInsertRowid) as AppEvent;
}

const EVENT_COLUMNS = new Set(["type", "starts_at", "label", "url", "done"]);

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

// --- profile ---------------------------------------------------------------

export function getProfile(): Record<string, string> {
  const rows = db().prepare("SELECT key, value FROM profile").all() as {
    key: string;
    value: string;
  }[];
  return Object.fromEntries(rows.map((r) => [r.key, r.value]));
}

export function setProfile(entries: Record<string, string>): void {
  const stmt = db().prepare(
    "INSERT INTO profile (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value"
  );
  const tx = db().transaction((e: Record<string, string>) => {
    for (const [k, v] of Object.entries(e)) stmt.run(k, v);
  });
  tx(entries);
}

// --- resume files ----------------------------------------------------------

export interface ResumeFile {
  id: number;
  name: string;
  filename: string;
  mime: string | null;
  size: number | null;
  uploaded_at: string;
}

export const RESUME_DIR = path.join(DATA_DIR, "resumes");

export function listResumeFiles(): ResumeFile[] {
  return db()
    .prepare("SELECT * FROM resumes ORDER BY uploaded_at DESC")
    .all() as ResumeFile[];
}

export function getResumeFile(id: number): ResumeFile | null {
  return (
    (db().prepare("SELECT * FROM resumes WHERE id = ?").get(id) as
      | ResumeFile
      | undefined) ?? null
  );
}

export function createResumeFile(input: {
  name: string;
  filename: string;
  mime: string | null;
  size: number | null;
}): ResumeFile {
  const res = db()
    .prepare(
      "INSERT INTO resumes (name, filename, mime, size) VALUES (@name, @filename, @mime, @size)"
    )
    .run(input);
  return getResumeFile(Number(res.lastInsertRowid))!;
}

export function deleteResumeFile(id: number): void {
  const r = getResumeFile(id);
  if (r) {
    try {
      fs.unlinkSync(path.join(RESUME_DIR, r.filename));
    } catch {
      // file already gone — still remove the row
    }
    db().prepare("DELETE FROM resumes WHERE id = ?").run(id);
  }
}
