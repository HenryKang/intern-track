"use client";

import { useEffect, useRef, useState } from "react";
import type { Application } from "@/lib/types";

interface ResumeFile {
  id: number;
  name: string;
  filename: string;
  mime: string | null;
  size: number | null;
  uploaded_at: string;
}

// Link fields are plain text on purpose: native type="url" validation rejects
// scheme-less URLs like "www.linkedin.com/in/…" (LinkedIn's own copy format);
// we normalize to https:// on save instead. Education dates use type="month"
// pickers so values are always structured YYYY-MM (no "May" vs "may" vs "5").
const URL_KEYS = new Set(["github", "linkedin", "website"]);
const DATE_KEYS = new Set(["start", "graduation"]);

const FIELDS: { key: string; label: string; placeholder: string; type?: string }[] = [
  { key: "name", label: "Name", placeholder: "Henry Kang" },
  { key: "email", label: "Email", placeholder: "you@example.com", type: "email" },
  { key: "phone", label: "Phone", placeholder: "(555) 555-5555", type: "tel" },
  { key: "school", label: "School", placeholder: "University of Michigan" },
  { key: "start", label: "Started", placeholder: "", type: "dateselect" },
  { key: "graduation", label: "Graduation", placeholder: "", type: "dateselect" },
  { key: "github", label: "GitHub", placeholder: "github.com/…" },
  { key: "linkedin", label: "LinkedIn", placeholder: "www.linkedin.com/in/…" },
  { key: "website", label: "Website", placeholder: "your-site.com" },
];

function normalizeUrl(value: string): string {
  const v = value.trim();
  if (!v || /^https?:\/\//i.test(v)) return v;
  return `https://${v}`;
}

const inputCls =
  "rounded-md border border-hairline bg-surface px-2.5 py-1.5 text-sm text-ink outline-none placeholder:text-muted focus:border-accent";

const MONTHS = [
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December",
];

/** Month / Day / Year dropdowns storing "YYYY-MM-DD" (parses partial "YYYY-MM"
    values from the old month picker; commits only when all three are chosen). */
function DateSelect({
  value,
  onChange,
}: {
  value: string;
  onChange: (v: string) => void;
}) {
  const [y = "", m = "", d = ""] = value.split("-");
  const nowYear = new Date().getFullYear();
  const years = Array.from({ length: 21 }, (_, i) => String(nowYear - 12 + i));
  const daysInMonth =
    y && m ? new Date(Number(y), Number(m), 0).getDate() : 31;
  const days = Array.from({ length: daysInMonth }, (_, i) => i + 1);

  function update(part: "y" | "m" | "d", v: string) {
    let [ny, nm, nd] = [y, m, d];
    if (part === "y") ny = v;
    if (part === "m") nm = v;
    if (part === "d") nd = v;
    // Clamp day if the new month/year has fewer days (e.g. Feb 30 → Feb 28).
    if (ny && nm && nd) {
      const max = new Date(Number(ny), Number(nm), 0).getDate();
      if (Number(nd) > max) nd = String(max).padStart(2, "0");
    }
    // Partial picks round-trip through split("-"); saveProfile strips them.
    onChange([ny, nm, nd].join("-"));
  }

  const selectCls =
    "rounded-md border border-hairline bg-surface px-2 py-1.5 text-sm text-ink outline-none focus:border-accent";

  return (
    <div className="flex gap-1.5">
      <select
        value={m}
        onChange={(e) => update("m", e.target.value)}
        className={`${selectCls} flex-[2]`}
      >
        <option value="">Month</option>
        {MONTHS.map((name, i) => (
          <option key={name} value={String(i + 1).padStart(2, "0")}>
            {name}
          </option>
        ))}
      </select>
      <select
        value={d ? String(Number(d)) : ""}
        onChange={(e) =>
          update("d", e.target.value ? e.target.value.padStart(2, "0") : "")
        }
        className={`${selectCls} flex-1`}
      >
        <option value="">Day</option>
        {days.map((day) => (
          <option key={day} value={String(day)}>
            {day}
          </option>
        ))}
      </select>
      <select
        value={y}
        onChange={(e) => update("y", e.target.value)}
        className={`${selectCls} flex-1`}
      >
        <option value="">Year</option>
        {years.map((yr) => (
          <option key={yr} value={yr}>
            {yr}
          </option>
        ))}
      </select>
    </div>
  );
}

function formatSize(bytes: number | null): string {
  if (!bytes) return "";
  return bytes < 1024 * 1024
    ? `${Math.round(bytes / 1024)} KB`
    : `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

export default function ProfilePage() {
  const [profile, setProfileState] = useState<Record<string, string> | null>(null);
  const [resumes, setResumes] = useState<ResumeFile[]>([]);
  const [apps, setApps] = useState<Application[]>([]);
  const [saved, setSaved] = useState(false);
  const [uploadName, setUploadName] = useState("");
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    fetch("/api/profile").then((r) => r.json()).then(setProfileState);
    fetch("/api/resumes").then((r) => r.json()).then(setResumes);
    fetch("/api/applications").then((r) => r.json()).then(setApps);
  }, []);

  async function saveProfile(e: React.FormEvent) {
    e.preventDefault();
    const normalized = Object.fromEntries(
      Object.entries(profile ?? {}).map(([k, v]) => {
        if (URL_KEYS.has(k)) return [k, normalizeUrl(v)];
        // Incomplete date picks (missing month/day/year) save as empty.
        if (DATE_KEYS.has(k) && !/^\d{4}-\d{2}-\d{2}$/.test(v)) return [k, ""];
        return [k, v];
      })
    );
    const res = await fetch("/api/profile", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(normalized),
    });
    setProfileState(await res.json());
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  }

  async function upload(e: React.FormEvent) {
    e.preventDefault();
    const file = fileRef.current?.files?.[0];
    setUploadError(null);
    if (!file || !uploadName.trim()) {
      setUploadError("Pick a file and give it a version name.");
      return;
    }
    setUploading(true);
    const form = new FormData();
    form.append("file", file);
    form.append("name", uploadName.trim());
    const res = await fetch("/api/resumes", { method: "POST", body: form });
    setUploading(false);
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      setUploadError(data.error ?? "Upload failed");
      return;
    }
    setUploadName("");
    if (fileRef.current) fileRef.current.value = "";
    setResumes(await (await fetch("/api/resumes")).json());
  }

  async function deleteResume(r: ResumeFile) {
    if (!confirm(`Delete resume "${r.name}" (${r.filename.replace(/^\d+-/, "")})?`))
      return;
    await fetch(`/api/resumes/${r.id}`, { method: "DELETE" });
    setResumes(await (await fetch("/api/resumes")).json());
  }

  const usedBy = (name: string) =>
    apps.filter((a) => a.resume === name).length;

  if (profile === null) {
    return <p className="py-12 text-center text-sm text-muted">Loading…</p>;
  }

  return (
    <div className="mx-auto flex max-w-3xl flex-col gap-6">
      <section className="rounded-xl border border-hairline bg-surface p-5">
        <h1 className="mb-4 text-sm font-semibold">Profile</h1>
        <form onSubmit={saveProfile}>
          <div className="grid gap-3 sm:grid-cols-2">
            {FIELDS.map((f) => (
              <label key={f.key} className="flex flex-col gap-1 text-xs text-muted">
                {f.label}
                {f.type === "dateselect" ? (
                  <DateSelect
                    value={profile[f.key] ?? ""}
                    onChange={(v) =>
                      setProfileState({ ...profile, [f.key]: v })
                    }
                  />
                ) : (
                  <input
                    type={f.type ?? "text"}
                    value={profile[f.key] ?? ""}
                    placeholder={f.placeholder}
                    onChange={(e) =>
                      setProfileState({ ...profile, [f.key]: e.target.value })
                    }
                    className={inputCls}
                  />
                )}
              </label>
            ))}
          </div>
          <div className="mt-4 flex items-center gap-3">
            <button
              type="submit"
              className="rounded-md bg-accent px-4 py-1.5 text-sm font-medium text-white hover:opacity-90"
            >
              Save
            </button>
            {saved && <span className="text-xs text-good-text">✓ Saved</span>}
          </div>
        </form>
      </section>

      <section className="rounded-xl border border-hairline bg-surface p-5">
        <h2 className="mb-1 text-sm font-semibold">Resumes</h2>
        <p className="mb-4 text-xs text-muted">
          Upload each version you use (PDF or Word, ≤ 10 MB). Use the version
          name in the tracker&apos;s “Resume” column to record which one went to
          which company.
        </p>

        <form onSubmit={upload} className="mb-4 flex flex-wrap items-end gap-2">
          <label className="flex basis-36 flex-col gap-1 text-xs text-muted">
            Version name
            <input
              value={uploadName}
              onChange={(e) => setUploadName(e.target.value)}
              placeholder="e.g. swe-v3"
              className={inputCls}
            />
          </label>
          <label className="flex flex-1 basis-52 flex-col gap-1 text-xs text-muted">
            File
            <input
              ref={fileRef}
              type="file"
              accept=".pdf,.doc,.docx"
              className={`${inputCls} file:mr-3 file:rounded file:border-0 file:bg-hairline file:px-2 file:py-0.5 file:text-xs file:text-ink-2`}
            />
          </label>
          <button
            type="submit"
            disabled={uploading}
            className="rounded-md border border-hairline px-3 py-1.5 text-sm text-ink-2 hover:border-baseline disabled:opacity-50"
          >
            {uploading ? "Uploading…" : "Upload"}
          </button>
        </form>
        {uploadError && (
          <p className="mb-3 text-xs text-critical">{uploadError}</p>
        )}

        {resumes.length === 0 ? (
          <p className="text-xs text-muted">No resumes uploaded yet.</p>
        ) : (
          <ul className="flex flex-col divide-y divide-[var(--hairline)]">
            {resumes.map((r) => {
              const count = usedBy(r.name);
              return (
                <li key={r.id} className="flex items-center gap-3 py-2.5">
                  <div className="min-w-0 flex-1">
                    <span className="block text-sm font-medium text-ink">
                      {r.name}
                    </span>
                    <span className="block truncate text-xs text-muted">
                      {r.filename.replace(/^\d+-/, "")} ·{" "}
                      {formatSize(r.size)} · uploaded{" "}
                      {new Date(r.uploaded_at + "Z").toLocaleDateString("en-US", {
                        month: "short",
                        day: "numeric",
                      })}
                      {count > 0 &&
                        ` · used by ${count} application${count === 1 ? "" : "s"}`}
                    </span>
                  </div>
                  <a
                    href={`/api/resumes/${r.id}/file`}
                    target="_blank"
                    rel="noreferrer"
                    className="rounded-md border border-hairline px-2.5 py-1 text-xs text-ink-2 hover:border-baseline"
                  >
                    View
                  </a>
                  <button
                    onClick={() => deleteResume(r)}
                    className="rounded-md border border-hairline px-2.5 py-1 text-xs text-muted hover:border-critical hover:text-critical"
                  >
                    Delete
                  </button>
                </li>
              );
            })}
          </ul>
        )}
      </section>
    </div>
  );
}
