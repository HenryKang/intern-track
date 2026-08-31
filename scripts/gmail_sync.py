#!/usr/bin/env python3
"""Local Gmail -> intern-track candidate sync. Privacy-first: mail is read
on this machine with a read-only scope and only extracted fields (company,
title, kind, date, subject line) are posted to the local tracker's review
queue. Nothing leaves your laptop.

Setup (one time):
  1. Google Cloud Console -> new project -> enable "Gmail API".
  2. OAuth consent screen: External, Testing; add your gmail as test user.
  3. Credentials -> Create OAuth client ID -> Desktop app; download JSON to
     data/gmail/credentials.json (gitignored).
  4. pip install -r scripts/gmail_requirements.txt
  5. npm run mail-sync   (first run opens a browser to authorize; token is
     cached in data/gmail/token.json)

Usage:
  python3 scripts/gmail_sync.py              # sync (tracker must be running)
  python3 scripts/gmail_sync.py --dry-run    # parse + print, post nothing
  python3 scripts/gmail_sync.py --self-test  # run parser against fixtures
"""
from __future__ import annotations

import argparse
import base64
import json
import re
import sys
import urllib.request
from datetime import datetime, timezone
from email.utils import parseaddr, parsedate_to_datetime
from pathlib import Path

TRACKER = "http://localhost:3000"
ROOT = Path(__file__).resolve().parent.parent
GMAIL_DIR = ROOT / "data" / "gmail"
STATE_FILE = GMAIL_DIR / "state.json"
SCOPES = ["https://www.googleapis.com/auth/gmail.readonly"]

ATS_DOMAINS = (
    "greenhouse.io", "greenhouse-mail.io", "lever.co", "hire.lever.co",
    "ashbyhq.com", "myworkday.com", "myworkdayjobs.com", "smartrecruiters.com",
    "icims.com", "workablemail.com", "successfactors.com", "oraclecloud.com",
)
OA_SENDERS = ("hackerrank.com", "codesignal.com", "testdome.com", "hackerearth.com", "coderpad.io")

QUERY = (
    'newer_than:45d ('
    'subject:("thank you for applying" OR "application received" OR '
    '"we received your application" OR "your application" OR '
    '"online assessment" OR "coding challenge") '
    'OR from:(greenhouse.io OR lever.co OR ashbyhq.com OR myworkday.com '
    'OR hackerrank.com OR codesignal.com)'
    ')'
)

REJECT_RX = re.compile(
    r"unfortunately|not (?:to )?move forward|other candidates|"
    r"no longer under consideration|decided not to|not selected|regret to",
    re.I,
)
OA_RX = re.compile(
    r"online assessment|coding (?:challenge|assessment|test)|hackerrank|"
    r"codesignal|assessment invitation|complete your assessment",
    re.I,
)
INTERVIEW_RX = re.compile(r"interview (?:invitation|availability|schedul)|schedule.{0,20}interview", re.I)
CONFIRM_RX = re.compile(
    r"thank(?:s| you) for (?:applying|your application|your interest)|"
    r"application (?:received|submitted|confirmation)|"
    r"we(?:'ve| have) received your application|successfully (?:applied|submitted)",
    re.I,
)

# Company extraction from subjects like "Thank you for applying to Stripe!"
COMPANY_SUBJECT_RXS = [
    re.compile(r"(?:applying|application|interest in(?: joining)?) (?:to|at|with|for) (?:the )?([A-Z][\w.&' -]{1,40}?)(?:[!.,]|$|'s| team| careers)", re.I),
    re.compile(r"your ([A-Z][\w.&' -]{1,40}?) application", re.I),
]
TITLE_RXS = [
    re.compile(r"for (?:the|our) (.{4,70}?) (?:position|role|opening|internship\b)", re.I),
    re.compile(r"application (?:for|to)(?: the)? [\"“](.{4,70}?)[\"”]", re.I),
    re.compile(r"[-–] (.{4,70}? intern(?:ship)?[\w ,()-]{0,30}?)(?:$|[!.])", re.I),
]
NOISE_NAMES = re.compile(r"no.?reply|careers?|recruit(?:ing|ment)?|talent|jobs?|notifications?|team|hiring|do.?not.?reply", re.I)


def classify(subject: str, snippet: str, from_addr: str) -> str:
    text = f"{subject} {snippet}"
    if any(d in from_addr for d in OA_SENDERS) or OA_RX.search(text):
        return "oa"
    if REJECT_RX.search(text):
        return "rejection"
    if INTERVIEW_RX.search(subject):
        return "interview"
    return "application"


def extract_company(subject: str, from_header: str) -> str | None:
    for rx in COMPANY_SUBJECT_RXS:
        m = rx.search(subject)
        if m:
            name = m.group(1).strip(" -–.")
            if name and not NOISE_NAMES.fullmatch(name):
                return name
    display, addr = parseaddr(from_header)
    display = re.sub(r"(?i)\b(no.?reply|careers?|recruiting|recruitment|talent|team|jobs?|hiring|notifications?)\b", "", display)
    display = display.strip(" -|@,–")
    if display and not NOISE_NAMES.search(display) and "@" not in display:
        return display
    domain = addr.rsplit("@", 1)[-1].lower() if "@" in addr else ""
    if domain and not any(d in domain for d in ATS_DOMAINS + OA_SENDERS):
        base = domain.split(".")[0]
        if base and base not in ("mail", "email", "notify", "hello", "info"):
            return base.capitalize()
    return None


def extract_title(subject: str, snippet: str) -> str | None:
    for text in (subject, snippet):
        for rx in TITLE_RXS:
            m = rx.search(text)
            if m:
                title = re.sub(r"\s+", " ", m.group(1)).strip(" -–.,\"'")
                if 4 <= len(title) <= 80:
                    return title
    return None


def parse_message(subject: str, from_header: str, snippet: str, date_iso: str, message_id: str) -> dict | None:
    _, addr = parseaddr(from_header)
    kind = classify(subject, snippet, addr.lower())
    if kind == "application" and not CONFIRM_RX.search(f"{subject} {snippet}"):
        return None  # matched only on sender domain but isn't a confirmation
    company = extract_company(subject, from_header)
    if not company:
        return None
    return {
        "kind": kind,
        "company": company,
        "title": extract_title(subject, snippet),
        "applied_date": date_iso,
        "evidence": subject[:200],
        "message_id": message_id,
        "source": "gmail",
    }


def post_candidate(cand: dict) -> str:
    req = urllib.request.Request(
        f"{TRACKER}/api/candidates",
        data=json.dumps(cand).encode(),
        headers={"Content-Type": "application/json"},
        method="POST",
    )
    with urllib.request.urlopen(req, timeout=15) as r:
        body = json.load(r)
    if body.get("duplicate"):
        return "duplicate"
    if body.get("skipped"):
        return f"skipped ({body['skipped']})"
    return "queued"


def gmail_service():
    try:
        from google.auth.transport.requests import Request
        from google.oauth2.credentials import Credentials
        from google_auth_oauthlib.flow import InstalledAppFlow
        from googleapiclient.discovery import build
    except ImportError:
        sys.exit("Missing deps: pip install -r scripts/gmail_requirements.txt")
    GMAIL_DIR.mkdir(parents=True, exist_ok=True)
    creds_file = GMAIL_DIR / "credentials.json"
    token_file = GMAIL_DIR / "token.json"
    if not creds_file.exists():
        sys.exit(f"Put your OAuth desktop-app client JSON at {creds_file} (see header of this script)")
    creds = None
    if token_file.exists():
        creds = Credentials.from_authorized_user_file(str(token_file), SCOPES)
    if not creds or not creds.valid:
        if creds and creds.expired and creds.refresh_token:
            creds.refresh(Request())
        else:
            creds = InstalledAppFlow.from_client_secrets_file(str(creds_file), SCOPES).run_local_server(port=0)
        token_file.write_text(creds.to_json())
    return build("gmail", "v1", credentials=creds)


def sync(dry_run: bool) -> None:
    svc = gmail_service()
    state = json.loads(STATE_FILE.read_text()) if STATE_FILE.exists() else {"seen": []}
    seen = set(state["seen"])
    results, page_token = [], None
    while True:
        resp = svc.users().messages().list(userId="me", q=QUERY, maxResults=100, pageToken=page_token).execute()
        results += resp.get("messages", [])
        page_token = resp.get("nextPageToken")
        if not page_token:
            break
    new = [m for m in results if m["id"] not in seen]
    print(f"{len(results)} matching messages, {len(new)} new")
    counts: dict[str, int] = {}
    for m in new:
        msg = svc.users().messages().get(
            userId="me", id=m["id"], format="metadata",
            metadataHeaders=["Subject", "From", "Date"],
        ).execute()
        headers = {h["name"]: h["value"] for h in msg["payload"].get("headers", [])}
        try:
            date_iso = parsedate_to_datetime(headers.get("Date", "")).date().isoformat()
        except Exception:
            date_iso = datetime.now(timezone.utc).date().isoformat()
        cand = parse_message(
            headers.get("Subject", ""), headers.get("From", ""),
            msg.get("snippet", ""), date_iso, m["id"],
        )
        if cand is None:
            outcome = "unparsed"
        elif dry_run:
            outcome = f"DRY {cand['kind']}: {cand['company']} / {cand['title'] or '(no title)'}"
            print(" ", outcome)
            outcome = "dry"
        else:
            outcome = post_candidate(cand)
        counts[outcome.split(" ")[0]] = counts.get(outcome.split(" ")[0], 0) + 1
        seen.add(m["id"])
    if not dry_run:
        state["seen"] = sorted(seen)[-2000:]
        GMAIL_DIR.mkdir(parents=True, exist_ok=True)
        STATE_FILE.write_text(json.dumps(state))
    print("done:", counts or "nothing new")


FIXTURES = [
    ("Thank you for applying to Stripe!", "Stripe <no-reply@us.greenhouse-mail.io>",
     "Thank you for applying for the Software Engineer Intern position at Stripe.",
     ("application", "Stripe", "Software Engineer Intern")),
    ("Your application to Ramp", "Ramp <no-reply@ashbyhq.com>",
     "Hi Henry, thanks for your interest! We received your application.",
     ("application", "Ramp", None)),
    ("Application Received", "Citadel Campus <campus@citadel.com>",
     "Thank you for applying. We have received your application and will review it shortly.",
     ("application", "Citadel Campus", None)),
    ("Jane Street Online Assessment Invitation", "Jane Street <assessments@hackerrank.com>",
     "You have been invited to complete an online assessment. Deadline: 7 days.",
     ("oa", "Jane Street", None)),
    ("Update on your application to Meta", "Meta Recruiting <recruiting@meta.com>",
     "Unfortunately, we have decided not to move forward with your application.",
     ("rejection", "Meta", None)),
    ("Interview scheduling - D. E. Shaw", "D. E. Shaw Recruiting <recruit@deshaw.com>",
     "We would like to schedule your interview. Please share availability.",
     ("interview", "D. E. Shaw", None)),
]


def self_test() -> None:
    failures = 0
    for subject, frm, snippet, (want_kind, want_company, want_title) in FIXTURES:
        got = parse_message(subject, frm, snippet, "2026-08-30", "test")
        ok = got and got["kind"] == want_kind and got["company"] == want_company and got["title"] == want_title
        status = "ok " if ok else "FAIL"
        if not ok:
            failures += 1
        print(f"[{status}] {subject!r} -> {got and (got['kind'], got['company'], got['title'])}")
    sys.exit(1 if failures else 0)


if __name__ == "__main__":
    ap = argparse.ArgumentParser()
    ap.add_argument("--dry-run", action="store_true")
    ap.add_argument("--self-test", action="store_true")
    args = ap.parse_args()
    if args.self_test:
        self_test()
    else:
        sync(args.dry_run)
