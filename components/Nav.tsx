"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const LINKS = [
  { href: "/", label: "Tracker" },
  { href: "/funnel", label: "Funnel" },
  { href: "/calendar", label: "Calendar" },
];

export default function Nav() {
  const pathname = usePathname();
  return (
    <header className="sticky top-0 z-20 border-b border-hairline bg-surface/95 backdrop-blur">
      <nav className="mx-auto flex h-12 max-w-6xl items-center gap-1 px-4">
        <span className="mr-4 text-sm font-semibold tracking-tight">
          intern-track
        </span>
        {LINKS.map(({ href, label }) => {
          const active = pathname === href;
          return (
            <Link
              key={href}
              href={href}
              className={`rounded-md px-3 py-1.5 text-sm transition-colors ${
                active
                  ? "bg-accent/10 font-medium text-accent"
                  : "text-ink-2 hover:bg-hairline hover:text-ink"
              }`}
            >
              {label}
            </Link>
          );
        })}
        <Link
          href="/profile"
          title="Profile & resumes"
          className={`ml-auto inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-sm transition-colors ${
            pathname === "/profile"
              ? "bg-accent/10 font-medium text-accent"
              : "text-ink-2 hover:bg-hairline hover:text-ink"
          }`}
        >
          <svg
            aria-hidden
            viewBox="0 0 16 16"
            className="size-4"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.5"
          >
            <circle cx="8" cy="5" r="2.75" />
            <path d="M2.75 14a5.25 5.25 0 0 1 10.5 0" />
          </svg>
          Profile
        </Link>
      </nav>
    </header>
  );
}
