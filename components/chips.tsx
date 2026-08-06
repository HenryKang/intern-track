"use client";

import {
  Stage,
  Status,
  STAGES,
  STATUSES,
  STAGE_LABELS,
  STATUS_LABELS,
  STAGE_COLOR_VARS,
} from "@/lib/types";

// Identity is never color-alone: every chip pairs its color swatch with a text
// label, and status additionally gets an icon glyph.

export function StageDot({ stage }: { stage: Stage }) {
  return (
    <span
      aria-hidden
      className="inline-block size-2.5 shrink-0 rounded-full"
      style={{ background: STAGE_COLOR_VARS[stage] }}
    />
  );
}

const STATUS_GLYPHS: Record<Status, { glyph: string; cls: string }> = {
  ongoing: { glyph: "●", cls: "text-accent" },
  rejected: { glyph: "✕", cls: "text-critical" },
  accepted: { glyph: "✓", cls: "text-good-text" },
  ghosted: { glyph: "○", cls: "text-muted" },
};

export function StatusGlyph({ status }: { status: Status }) {
  const { glyph, cls } = STATUS_GLYPHS[status];
  return (
    <span aria-hidden className={`text-[11px] leading-none ${cls}`}>
      {glyph}
    </span>
  );
}

function ChipSelect({
  value,
  options,
  labels,
  onChange,
  prefix,
}: {
  value: string;
  options: readonly string[];
  labels: Record<string, string>;
  onChange: (v: string) => void;
  prefix: React.ReactNode;
}) {
  return (
    <label className="inline-flex cursor-pointer items-center gap-1.5 rounded-full border border-hairline bg-surface py-1 pl-2.5 pr-1 hover:border-baseline">
      {prefix}
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="cursor-pointer appearance-none bg-transparent pr-4 text-xs text-ink-2 outline-none [background-image:none]"
        style={{
          backgroundImage:
            "url(\"data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='8' height='6'><path d='M1 1l3 3 3-3' fill='none' stroke='%23898781' stroke-width='1.5'/></svg>\")",
          backgroundRepeat: "no-repeat",
          backgroundPosition: "right 4px center",
        }}
      >
        {options.map((o) => (
          <option key={o} value={o}>
            {labels[o]}
          </option>
        ))}
      </select>
    </label>
  );
}

export function StageSelect({
  value,
  onChange,
}: {
  value: Stage;
  onChange: (s: Stage) => void;
}) {
  return (
    <ChipSelect
      value={value}
      options={STAGES}
      labels={STAGE_LABELS}
      onChange={(v) => onChange(v as Stage)}
      prefix={<StageDot stage={value} />}
    />
  );
}

export function StatusSelect({
  value,
  onChange,
}: {
  value: Status;
  onChange: (s: Status) => void;
}) {
  return (
    <ChipSelect
      value={value}
      options={STATUSES}
      labels={STATUS_LABELS}
      onChange={(v) => onChange(v as Status)}
      prefix={<StatusGlyph status={value} />}
    />
  );
}
