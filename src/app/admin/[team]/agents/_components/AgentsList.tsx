"use client";

import Link from "next/link";
import { teamAxisShortLabel } from "@/lib/team-axis-label";
import { UserRole } from "@/generated/prisma/enums";
import { roleLabelsFr } from "@/lib/role-labels-fr";

const MAX_SKILL_TAGS = 4;

export type AgentListItem = {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  active: boolean;
  roleInTeam: UserRole;
  planningGroupLabel: string | null;
  planningGroupColor: string | null;
  teams: { id: string; job: Parameters<typeof teamAxisShortLabel>[0]["job"]; rhythm: Parameters<typeof teamAxisShortLabel>[0]["rhythm"]; displayOrder: number }[];
  skills: string[];
};

type SortKey = "agent" | "role" | "equipe" | "bloc" | "competences" | "actif";
type SortDir = "asc" | "desc";

type Props = {
  agents: AgentListItem[];
  agentsBase: string;
  sortKey: SortKey;
  sortDir: SortDir;
};

function sortHref(agentsBase: string, currentKey: SortKey, currentDir: SortDir, key: SortKey) {
  const nextDir: SortDir = currentKey === key && currentDir === "asc" ? "desc" : "asc";
  return `${agentsBase}?sort=${key}&dir=${nextDir}`;
}

function sortArrow(currentKey: SortKey, currentDir: SortDir, key: SortKey) {
  if (currentKey !== key) return null;
  return currentDir === "asc" ? "↑" : "↓";
}

function initials(firstName: string, lastName: string) {
  return `${lastName.charAt(0)}${firstName.charAt(0)}`.toUpperCase();
}

export function AgentsList({ agents, agentsBase, sortKey, sortDir }: Props) {
  const sortOptions: { key: SortKey; label: string }[] = [
    { key: "agent", label: "Nom" },
    { key: "role", label: "Rôle" },
    { key: "equipe", label: "Équipe" },
    { key: "bloc", label: "Bloc" },
    { key: "competences", label: "Compétences" },
    { key: "actif", label: "Actif" },
  ];

  if (agents.length === 0) {
    return (
      <p className="rounded-xl border border-dashed border-zinc-300 bg-zinc-50 px-4 py-8 text-center text-sm text-zinc-600">
        Aucun agent sur cette équipe. Utilisez « Nouvel agent » pour en ajouter un.
      </p>
    );
  }

  return (
    <section className="rounded-xl border border-zinc-200 bg-white shadow-sm">
      <div className="flex flex-wrap items-center justify-center gap-2 border-b border-zinc-100 px-3 py-2">
        <span className="text-xs font-medium text-zinc-500">Trier par</span>
        {sortOptions.map(({ key, label }) => (
          <Link
            key={key}
            href={sortHref(agentsBase, sortKey, sortDir, key)}
            className={[
              "rounded-md px-2 py-1 text-xs font-medium transition",
              sortKey === key ? "bg-zinc-900 text-white" : "text-zinc-600 hover:bg-zinc-100",
            ].join(" ")}
          >
            {label}
            {sortArrow(sortKey, sortDir, key) ? ` ${sortArrow(sortKey, sortDir, key)}` : ""}
          </Link>
        ))}
      </div>

      <ul className="divide-y divide-zinc-100">
        {agents.map((agent) => {
          const sortedTeams = [...agent.teams].sort((a, b) => a.displayOrder - b.displayOrder);
          const visibleSkills = agent.skills.slice(0, MAX_SKILL_TAGS);
          const extraSkills = agent.skills.length - visibleSkills.length;

          return (
            <li key={agent.id}>
              <Link
                href={`${agentsBase}/${agent.id}`}
                className={[
                  "flex gap-3 px-4 py-3 transition hover:bg-zinc-50 sm:gap-4",
                  !agent.active ? "opacity-60" : "",
                ].join(" ")}
              >
                <span
                  className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-zinc-200 text-xs font-semibold text-zinc-700"
                  style={{
                    backgroundColor: agent.planningGroupColor ?? "#f4f4f5",
                  }}
                  aria-hidden
                >
                  {initials(agent.firstName, agent.lastName)}
                </span>

                <span className="min-w-0 flex-1">
                  <span className="flex flex-wrap items-baseline justify-between gap-x-2 gap-y-1">
                    <span className="font-semibold text-zinc-900">
                      {agent.lastName.toUpperCase()} {agent.firstName}
                    </span>
                    <span
                      className={[
                        "shrink-0 rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide",
                        agent.active ? "bg-emerald-100 text-emerald-800" : "bg-zinc-200 text-zinc-600",
                      ].join(" ")}
                    >
                      {agent.active ? "Actif" : "Inactif"}
                    </span>
                  </span>
                  <span className="mt-0.5 block truncate text-xs text-zinc-500">{agent.email}</span>

                  <span className="mt-2 flex flex-wrap items-center gap-1.5">
                    <span className="rounded-md bg-zinc-100 px-1.5 py-0.5 text-[11px] font-medium text-zinc-700">
                      {roleLabelsFr[agent.roleInTeam]}
                    </span>
                    {agent.planningGroupLabel ? (
                      <span className="inline-flex items-center gap-1 rounded-md border border-zinc-200 bg-white px-1.5 py-0.5 text-[11px] text-zinc-700">
                        <span
                          className="inline-block h-2 w-2 rounded-full border border-zinc-300"
                          style={{ backgroundColor: agent.planningGroupColor ?? "#e5e7eb" }}
                        />
                        Bloc {agent.planningGroupLabel}
                      </span>
                    ) : null}
                    {sortedTeams.map((t) => (
                      <span
                        key={t.id}
                        className="rounded-md bg-zinc-100 px-1.5 py-0.5 text-[11px] font-medium text-zinc-700"
                      >
                        {teamAxisShortLabel(t)}
                      </span>
                    ))}
                    {visibleSkills.map((name) => (
                      <span
                        key={name}
                        className="rounded-md bg-blue-50 px-1.5 py-0.5 text-[11px] font-medium text-blue-700"
                      >
                        {name}
                      </span>
                    ))}
                    {extraSkills > 0 ? (
                      <span className="text-[11px] text-zinc-500">+{extraSkills}</span>
                    ) : null}
                  </span>
                </span>

                <span className="hidden shrink-0 self-center text-xs font-medium text-zinc-500 sm:inline">
                  Modifier →
                </span>
              </Link>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
