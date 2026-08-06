/**
 * Seed the tracker with fake development data.
 *   npm run seed          # wipe + insert sample applications/events
 *   npm run seed -- --wipe  # wipe only
 */
import { db, createApplication, createEvent } from "../lib/db";
import type { Stage, Status, EventType } from "../lib/types";

function iso(daysFromNow: number, time?: string): string {
  const d = new Date();
  d.setDate(d.getDate() + daysFromNow);
  const date = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(
    d.getDate()
  ).padStart(2, "0")}`;
  return time ? `${date}T${time}` : date;
}

db().exec("DELETE FROM events; DELETE FROM applications;");
console.log("Cleared existing data.");

if (process.argv.includes("--wipe")) process.exit(0);

interface SeedApp {
  company: string;
  title: string;
  url?: string;
  applied: number; // days ago
  stage: Stage;
  status: Status;
  resume?: string;
  notes?: string;
  events?: { type: EventType; at: string; label?: string }[];
}

const SEED: SeedApp[] = [
  {
    company: "Jane Street",
    title: "Software Engineer Intern (Summer 2027)",
    url: "https://www.janestreet.com/join-jane-street/position/software-engineer-internship",
    applied: 20,
    stage: "oa",
    status: "ongoing",
    resume: "quant-v2",
    notes: "Referral from Priya. OCaml prep!",
    events: [{ type: "oa_deadline", at: iso(2), label: "CodeSignal OA" }],
  },
  {
    company: "Citadel",
    title: "SWE Intern — Summer 2027",
    applied: 18,
    stage: "first_round",
    status: "ongoing",
    resume: "quant-v2",
    events: [
      { type: "interview", at: iso(5, "14:00"), label: "Phone screen" },
    ],
  },
  {
    company: "Stripe",
    title: "Software Engineering Intern",
    url: "https://stripe.com/jobs/listing/software-engineering-intern",
    applied: 30,
    stage: "tech_call",
    status: "ongoing",
    resume: "swe-v3",
    events: [
      { type: "interview", at: iso(9, "11:00"), label: "Virtual onsite" },
    ],
  },
  {
    company: "Google",
    title: "STEP Intern 2027",
    applied: 40,
    stage: "applied",
    status: "ongoing",
    resume: "swe-v3",
  },
  {
    company: "Hudson River Trading",
    title: "Software Engineering Intern",
    applied: 25,
    stage: "oa",
    status: "rejected",
    resume: "quant-v2",
    notes: "OA went poorly — more graph problems next time.",
  },
  {
    company: "Meta",
    title: "SWE Intern (University Grad)",
    applied: 35,
    stage: "applied",
    status: "rejected",
    resume: "swe-v2",
  },
  {
    company: "Two Sigma",
    title: "Quantitative Software Engineering Intern",
    applied: 15,
    stage: "oa",
    status: "ongoing",
    resume: "quant-v2",
    events: [{ type: "oa_deadline", at: iso(6), label: "HackerRank" }],
  },
  {
    company: "Databricks",
    title: "Software Engineering Intern — Summer 2027",
    applied: 22,
    stage: "final_round",
    status: "ongoing",
    resume: "swe-v3",
    events: [
      { type: "interview", at: iso(12, "10:00"), label: "Final round (2x tech + HM)" },
    ],
  },
  {
    company: "IMC Trading",
    title: "Software Engineer Intern",
    applied: 28,
    stage: "first_round",
    status: "rejected",
    resume: "quant-v1",
  },
  {
    company: "Roblox",
    title: "Software Engineer Intern (Summer 2027)",
    applied: 45,
    stage: "offer",
    status: "accepted",
    resume: "swe-v2",
    notes: "Offer accepted as backup — deadline was tight.",
  },
  {
    company: "Amazon",
    title: "SDE Intern 2027",
    applied: 10,
    stage: "applied",
    status: "ongoing",
    resume: "swe-v3",
  },
];

for (const s of SEED) {
  const app = createApplication({
    company: s.company,
    title: s.title,
    url: s.url ?? null,
    date_applied: iso(-s.applied),
    stage: s.stage,
    status: s.status,
    resume: s.resume ?? null,
    notes: s.notes ?? null,
  });
  for (const e of s.events ?? []) {
    createEvent({
      application_id: app.id,
      type: e.type,
      starts_at: e.at,
      label: e.label ?? null,
    });
  }
}
console.log(`Seeded ${SEED.length} applications.`);
