# intern-track

Personal internship application tracker — the pipeline half of the system
([intern-radar](../intern-radar) handles discovery). Tracks which applications
you've submitted, OA deadlines, interview dates, resume versions, and shows an
aggregate Sankey funnel of where everything stands.

## Run

```bash
npm install
npm run dev        # http://localhost:3000
```

Data lives in a single SQLite file at `data/tracker.db` (gitignored — back it
up by copying the file).

```bash
npm run seed             # wipe + load ~11 fake applications for development
npm run seed -- --wipe   # wipe everything (start fresh for real use)
```

## Pages

- **`/` Tracker** — spreadsheet-style table: company, position (links to the
  posting), date applied, stage, status, next deadline, resume used. Inline
  editing on stage/status/resume; the ▸ chevron expands notes, the posting URL,
  and OA-deadline/interview events. Paste a **Greenhouse / Lever / Ashby** job
  URL into the quick-add box and Autofill fills company + title from the ATS's
  public API (US + EU Greenhouse both supported). Unknown ATSs (e.g. Workday)
  fall back to manual entry.
- **`/funnel`** — Sankey of the aggregate pipeline: Applied → OA → First Round
  → Tech Call → Final Round → Offer, with Rejected / In progress / Accepted
  terminals. Derived live from stage + status; the table below is the same data
  in text form.
- **`/calendar`** — month grid of OA deadlines (orange) and interviews (blue),
  plus a next-14-days list. Clicking an event jumps to that application's row
  on the tracker.

## Data model

Two tables in `lib/db.ts`: `applications` (company, title, url, date_applied,
`status` = ongoing|rejected|accepted, `stage` = applied|oa|first_round|
tech_call|final_round|offer, resume, notes) and `events`
(oa_deadline|interview, datetime, label) — multiple events per application.
`stage` is the furthest point reached; the Sankey infers the full path from it,
so there's no separate history table.

## Future ideas

- Gmail parsing for OA/interview emails (interactive Claude Code session)
- Google Calendar sync for events
- One-click import from intern-radar's `data/postings.json`
- Deploy (Vercel + Turso) for phone access
