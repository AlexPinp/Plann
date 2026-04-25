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
      match: (path) => path.startsWith(p("planning-equipe")),
    },
    {
      segment: "organisation",
      label: "Organisation",
      match: (path) => path.startsWith(p("organisation")),
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
      className="flex flex-wrap items-center gap-x-1 gap-y-2 border-b border-zinc-200 bg-zinc-50/80 px-3 py-1.5 sm:px-4 md:px-6"
      aria-label="Navigation principale"
    >
      {showSwitcher ? (
        <div className="flex w-full shrink-0 items-center border-b border-zinc-200/80 pb-2 sm:mr-2 sm:w-auto sm:border-b-0 sm:border-r sm:pb-0 sm:pr-3">
          <TeamSwitcher teams={switcherTeams!} currentSlug={teamSlug} />
        </div>
      ) : null}
      <div className="flex min-w-0 flex-1 items-center gap-1 overflow-x-auto pb-0.5">
        {agentTabs.map((tab) => (
          <TabLink key={tab.segment} href={workspacePath(teamSlug, tab.segment)} tab={tab} pathname={pathname} />
        ))}
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
        "-mb-px shrink-0 whitespace-nowrap border-b-2 px-2.5 py-2.5 text-xs font-medium transition-colors sm:px-3 sm:text-sm md:px-4",
        active
          ? accent
            ? "border-emerald-600 text-emerald-700"
            : "border-zinc-900 text-zinc-900"
          : accent
            ? "border-transparent text-emerald-600 hover:border-emerald-300 hover:text-emerald-700"
            : "border-transparent text-zinc-500 hover:border-zinc-300 hover:text-zinc-800",
      ].join(" ")}
    >
      {tab.label}
    </Link>
  );
}
