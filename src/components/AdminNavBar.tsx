"use client";

import Link from "next/link";
import { AdminNav } from "@/components/AdminNav";
import { TeamSwitcher, type TeamSwitcherOption } from "@/components/TeamSwitcher";
import { workspacePath } from "@/lib/routes";

export function AdminNavBar({
  teamSlug,
  switcherTeams,
}: {
  teamSlug: string;
  switcherTeams?: TeamSwitcherOption[];
}) {
  const showSwitcher = (switcherTeams?.length ?? 0) > 1;

  return (
    <nav
      className="mx-auto flex w-full max-w-7xl flex-col gap-2 border-t border-[var(--border)] bg-[var(--surface)] px-3 py-2 sm:flex-row sm:items-center sm:justify-between sm:gap-3 sm:px-4 md:px-6"
      aria-label="Navigation administration"
    >
      <div className="flex min-w-0 flex-wrap items-center gap-x-3 gap-y-1">
        <span className="text-sm font-bold text-[var(--accent)]">Administration</span>
        {showSwitcher ? (
          <TeamSwitcher teams={switcherTeams!} currentSlug={teamSlug} mode="admin" />
        ) : (
          <span className="rounded-full bg-[var(--surface-soft)] px-2 py-0.5 text-xs font-medium text-[var(--text-muted)]">
            {switcherTeams?.[0]?.label}
          </span>
        )}
      </div>
      <div className="-mx-1 min-w-0 flex-1 overflow-x-auto px-1 pb-0.5 sm:flex sm:justify-center">
        <AdminNav teamSlug={teamSlug} />
      </div>
      <div className="flex shrink-0 justify-start sm:justify-end">
        <Link href={workspacePath(teamSlug, "planning-moi")} className="ui-btn-secondary text-xs">
          Retour application
        </Link>
      </div>
    </nav>
  );
}
