import type { ReactNode } from "react";
import Link from "next/link";
import { WorkspaceTabs } from "@/components/WorkspaceTabs";
import { canEditPlanningAndStaff } from "@/lib/user-roles";
import { getUserTeams, requireTeamMembership } from "@/lib/team";
import { adminTeamPath, workspacePath } from "@/lib/routes";
import { signOut } from "../../login/actions";

type Props = {
  children: ReactNode;
  params: Promise<{ team: string }>;
};

export default async function TeamWorkspaceLayout({ children, params }: Props) {
  const { team: teamSlug } = await params;
  const ctx = await requireTeamMembership(teamSlug);
  const canStaff = canEditPlanningAndStaff(ctx.user.role);
  const memberships = await getUserTeams(ctx.user.id);
  const switcherTeams = memberships.map((ut) => ({
    slug: ut.team.slug,
    label: ut.team.label,
    color: ut.team.color,
  }));

  return (
    <div className="flex min-h-full flex-col bg-[var(--surface-soft)]">
      <header className="sticky top-0 z-50 border-b border-[var(--border)] bg-white/95 backdrop-blur print:hidden">
        <div className="border-b border-[var(--border)]">
          <div className="mx-auto flex w-full max-w-7xl items-center justify-between gap-3 px-3 py-2 sm:px-4 md:px-6">
            <Link
              href={workspacePath(teamSlug, "planning-moi")}
              className="text-base font-semibold tracking-tight text-[var(--text)] hover:opacity-80"
            >
              Plann
            </Link>
            <div className="flex w-full items-center justify-end gap-2 sm:w-auto sm:gap-3">
            <span className="hidden text-xs text-[var(--text-muted)] sm:inline">
              {ctx.user.lastName.toUpperCase()} {ctx.user.firstName}
            </span>
            {canStaff && (
              <Link
                href={adminTeamPath(teamSlug, "planning")}
                className="rounded-md border border-[var(--text)] bg-[var(--text)] px-3 py-1.5 text-xs font-medium text-white transition-colors hover:opacity-90"
              >
                Administration
              </Link>
            )}
            <Link
              href={`/${teamSlug}/parametres`}
              className="inline-flex h-8 w-8 items-center justify-center rounded-md border border-[var(--border)] text-[var(--text-muted)] transition-colors hover:bg-[var(--surface-soft)]"
              aria-label="Ouvrir mes paramètres"
              title="Paramètres"
            >
              <svg
                xmlns="http://www.w3.org/2000/svg"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.8"
                className="h-4 w-4"
                aria-hidden="true"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M10.325 4.317a1.724 1.724 0 0 1 3.35 0 1.724 1.724 0 0 0 2.573 1.066 1.724 1.724 0 0 1 2.9 1.673 1.724 1.724 0 0 0 .829 2.54 1.724 1.724 0 0 1 0 2.808 1.724 1.724 0 0 0-.829 2.54 1.724 1.724 0 0 1-2.9 1.673 1.724 1.724 0 0 0-2.573 1.066 1.724 1.724 0 0 1-3.35 0 1.724 1.724 0 0 0-2.573-1.066 1.724 1.724 0 0 1-2.9-1.673 1.724 1.724 0 0 0-.829-2.54 1.724 1.724 0 0 1 0-2.808 1.724 1.724 0 0 0 .829-2.54 1.724 1.724 0 0 1 2.9-1.673 1.724 1.724 0 0 0 2.573-1.066Z"
                />
                <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 1 1-6 0 3 3 0 0 1 6 0Z" />
              </svg>
            </Link>
            <form action={signOut}>
              <button
                type="submit"
                className="rounded-md border border-[var(--border)] px-3 py-1.5 text-xs text-[var(--text-muted)] transition-colors hover:bg-[var(--surface-soft)]"
              >
                Deconnexion
              </button>
            </form>
            </div>
          </div>
        </div>
        <WorkspaceTabs teamSlug={teamSlug} switcherTeams={switcherTeams} />
      </header>
      {children}
    </div>
  );
}
