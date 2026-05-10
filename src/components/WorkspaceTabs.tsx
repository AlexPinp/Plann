"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { workspacePath } from "@/lib/routes";
import { TeamSwitcher, type TeamSwitcherOption } from "@/components/TeamSwitcher";

type Tab = { segment: string; label: string; match: (p: string) => boolean };

function tabsForTeam(teamSlug: string): Tab[] {
  const p = (segment: string) => workspacePath(teamSlug, segment);
  return [
    {
      segment: "planning-moi",
      label: "Mon planning",
      match: (path) => path === `/${teamSlug}` || path.startsWith(p("planning-moi")),
    },
    {
      segment: "planning-equipe",
      label: "Planning equipe",
      match: (path) => path.startsWith(p("planning-equipe")) || path.startsWith(p("planning/")),
    },
    {
      segment: "planification",
      label: "Planification",
      match: (path) => path.startsWith(p("planification")),
    },
    {
      segment: "demandes",
      label: "Demandes",
      match: (path) => path.startsWith(p("demandes")),
    },
    {
      segment: "droits",
      label: "Droits & recap",
      match: (path) => path.startsWith(p("droits")),
    },
  ];
}

export function WorkspaceTabs({
  teamSlug,
  switcherTeams,
}: {
  teamSlug: string;
  switcherTeams?: TeamSwitcherOption[];
}) {
  const pathname = usePathname();
  const agentTabs = tabsForTeam(teamSlug);
  const showSwitcher = (switcherTeams?.length ?? 0) > 1;

  return (
    <nav
      className="mx-auto grid w-full max-w-7xl grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] items-center gap-x-2 gap-y-2 border-t border-[var(--border)] bg-white px-3 py-2 sm:px-4 md:px-6"
      aria-label="Navigation principale"
    >
      <div className="min-w-0" aria-hidden="true" />
      <div className="flex min-w-0 justify-center gap-1 overflow-x-auto pb-0.5">
        {agentTabs.map((tab) => (
          <TabLink key={tab.segment} href={workspacePath(teamSlug, tab.segment)} tab={tab} pathname={pathname} />
        ))}
      </div>
      <div className="flex min-w-0 shrink-0 justify-end">
        {showSwitcher ? <TeamSwitcher teams={switcherTeams!} currentSlug={teamSlug} /> : null}
      </div>
    </nav>
  );
}

function TabLink({
  href,
  tab,
  pathname,
  accent,
}: {
  href: string;
  tab: Tab;
  pathname: string;
  accent?: boolean;
}) {
  const active = tab.match(pathname);
  return (
    <Link
      href={href}
      className={[
        "shrink-0 whitespace-nowrap rounded-md px-2.5 py-1.5 text-xs font-medium transition-colors sm:text-sm",
        active
          ? accent
            ? "bg-emerald-50 text-emerald-700"
            : "bg-[var(--surface-soft)] text-[var(--text)]"
          : accent
            ? "text-emerald-700 hover:bg-emerald-50"
            : "text-[var(--text-muted)] hover:bg-[var(--surface-soft)] hover:text-[var(--text)]",
      ].join(" ")}
    >
      {tab.label}
    </Link>
  );
}
