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
  season, and OA-deadline/interview events. Rows group into **season sections**
  (Fall 2026, Summer 2027, …) with a toggle to filter one season, remembered
  across pages. Paste any job URL into the quick-add box: **Greenhouse (US/EU),
  Lever, Ashby, and Workday** autofill from their public APIs; embedded
  Greenhouse pages (`?gh_jid=`) are resolved via the domain; any other careers
  page falls back to reading the page's JobPosting/OpenGraph metadata.
  Applications still sitting at "applied" 60 days after the apply date are
  automatically marked **ghosted** (a manual status change opts a row out).
- **`/funnel`** — Sankey of the aggregate pipeline: Applied → OA → First Round
  → Final Round → Offer, with Awaiting response / Rejected / Ghosted / Accepted
  terminals. Derived live from stage + status; the table below is the same data
  in text form.
- **`/calendar`** — month grid of OA deadlines (orange) and interviews (blue),
  plus a next-14-days list. Clicking an event jumps to that application's row
  on the tracker.
- **`/profile`** (top-right) — basic profile info (name, school, links, …) and
  resume management: upload each version (PDF/Word, ≤ 10 MB, stored locally in
  `data/resumes/`), view/delete them, and see how many applications used each
  version. Uploaded version names autocomplete in the tracker's Resume column.

## Data model

Two tables in `lib/db.ts`: `applications` (company, title, url, date_applied,
`status` = ongoing|rejected|accepted|ghosted, `stage` = applied|oa|
first_round|final_round|offer, season, resume, notes) and `events`
(oa_deadline|interview, datetime, label, link, done) — multiple events per
application.
`stage` is the furthest point reached; the Sankey infers the full path from it,
so there's no separate history table.

## Future ideas

- Gmail parsing for OA/interview emails (interactive Claude Code session)
- Google Calendar sync for events
- One-click import from intern-radar's `data/postings.json`
- Deploy (Vercel + Turso) for phone access
