// Shared between server (lib/db.ts) and client components — no Node deps here.

export type Status = "ongoing" | "rejected" | "accepted";
export type Stage =
  | "applied"
  | "oa"
  | "first_round"
  | "tech_call"
  | "final_round"
  | "offer";
export type EventType = "oa_deadline" | "interview";

export const STAGES: Stage[] = [
  "applied",
  "oa",
  "first_round",
  "tech_call",
  "final_round",
  "offer",
];
export const STATUSES: Status[] = ["ongoing", "rejected", "accepted"];

export const STAGE_LABELS: Record<Stage, string> = {
  applied: "Applied",
  oa: "OA",
  first_round: "First Round",
  tech_call: "Tech Call",
  final_round: "Final Round",
  offer: "Offer",
};
export const STATUS_LABELS: Record<Status, string> = {
  ongoing: "Ongoing",
  rejected: "Rejected",
  accepted: "Accepted",
};
export const EVENT_TYPE_LABELS: Record<EventType, string> = {
  oa_deadline: "OA deadline",
  interview: "Interview",
};

// CSS custom property per stage — values live in globals.css (light+dark).
export const STAGE_COLOR_VARS: Record<Stage, string> = {
  applied: "var(--stage-1)",
  oa: "var(--stage-2)",
  first_round: "var(--stage-3)",
  tech_call: "var(--stage-4)",
  final_round: "var(--stage-5)",
  offer: "var(--stage-6)",
};

export interface AppEvent {
  id: number;
  application_id: number;
  type: EventType;
  starts_at: string; // ISO datetime; OA deadlines use date-only "YYYY-MM-DD"
  label: string | null;
}

export interface Application {
  id: number;
  company: string;
  title: string;
  url: string | null;
  date_applied: string | null; // "YYYY-MM-DD"
  status: Status;
  stage: Stage;
  resume: string | null;
  notes: string | null;
  created_at: string;
}

export interface ApplicationWithEvents extends Application {
  events: AppEvent[];
}

export function todayISO(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(
    d.getDate()
  ).padStart(2, "0")}`;
}

/** Whole days from today until an ISO date/datetime (negative = past). */
export function daysUntil(iso: string): number {
  const target = new Date(iso.slice(0, 10) + "T00:00:00");
  const now = new Date(todayISO() + "T00:00:00");
  return Math.round((target.getTime() - now.getTime()) / 86_400_000);
}

export function formatDateShort(iso: string): string {
  return new Date(iso.slice(0, 10) + "T00:00:00").toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
  });
}

/** Soonest event today-or-later, if any. */
export function nextUpcomingEvent(events: AppEvent[]): AppEvent | null {
  const today = todayISO();
  const upcoming = events
    .filter((e) => e.starts_at.slice(0, 10) >= today)
    .sort((a, b) => a.starts_at.localeCompare(b.starts_at));
  return upcoming[0] ?? null;
}
