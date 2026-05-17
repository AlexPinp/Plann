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
      label: "Planning équipe",
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
      className="mx-auto flex w-full max-w-7xl flex-col gap-2 border-t border-[var(--border)] bg-[var(--surface)] px-3 py-2 sm:flex-row sm:items-center sm:justify-between sm:gap-3 sm:px-4 md:px-6"
      aria-label="Navigation principale"
    >
      <div className="-mx-1 flex min-w-0 flex-1 gap-0.5 overflow-x-auto px-1 pb-0.5 sm:justify-center">
        {agentTabs.map((tab) => (
          <TabLink key={tab.segment} href={workspacePath(teamSlug, tab.segment)} tab={tab} pathname={pathname} />
        ))}
      </div>
      {showSwitcher ? (
        <div className="w-full sm:w-auto sm:shrink-0">
          <TeamSwitcher teams={switcherTeams!} currentSlug={teamSlug} />
        </div>
      ) : null}
    </nav>
  );
}

function TabLink({ href, tab, pathname }: { href: string; tab: Tab; pathname: string }) {
  const active = tab.match(pathname);
  return (
    <Link
      href={href}
      className={["ui-tab", active ? "ui-tab-active" : "ui-tab-inactive"].join(" ")}
      aria-current={active ? "page" : undefined}
    >
      {tab.label}
    </Link>
  );
}
