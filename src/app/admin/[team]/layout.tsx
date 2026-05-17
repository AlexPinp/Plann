import type { ReactNode } from "react";
import Link from "next/link";
import { AdminNavBar } from "@/components/AdminNavBar";
import { AppLogo } from "@/components/AppLogo";
import { getTeamSwitcherOptions, requireTeamAdmin } from "@/lib/team";
import { workspacePath } from "@/lib/routes";
import { signOut } from "../../login/actions";

type Props = {
  children: ReactNode;
  params: Promise<{ team: string }>;
};

export default async function AdminTeamLayout({ children, params }: Props) {
  const { team: teamSlug } = await params;
  const ctx = await requireTeamAdmin(teamSlug);

  const switcherTeams = await getTeamSwitcherOptions(ctx.user.id, ctx.user.role);

  return (
    <div className="flex min-h-full flex-col bg-[var(--background)]">
      <header className="app-shell-header print:hidden">
        <div className="app-header-bar" aria-hidden />
        <div className="border-b border-[var(--border)]">
          <div className="mx-auto flex w-full max-w-7xl flex-wrap items-center justify-between gap-x-3 gap-y-2 px-3 py-2.5 sm:px-4 md:px-6">
            <AppLogo href={workspacePath(teamSlug, "planning-moi")} />
            <div className="flex flex-wrap items-center justify-end gap-2">
              <span className="hidden rounded-full bg-[var(--accent-soft)] px-2.5 py-1 text-xs font-medium text-[var(--accent)] sm:inline">
                Admin · {ctx.user.lastName.toUpperCase()} {ctx.user.firstName}
              </span>
              <Link
                href={`/${teamSlug}/parametres`}
                className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-[var(--border)] text-[var(--text-muted)] transition-colors hover:border-[var(--accent)] hover:bg-[var(--accent-soft)] hover:text-[var(--accent)]"
                aria-label="Ouvrir mes paramètres"
                title="Paramètres"
              >
                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className="h-4 w-4" aria-hidden="true">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M10.325 4.317a1.724 1.724 0 0 1 3.35 0 1.724 1.724 0 0 0 2.573 1.066 1.724 1.724 0 0 1 2.9 1.673 1.724 1.724 0 0 0 .829 2.54 1.724 1.724 0 0 1 0 2.808 1.724 1.724 0 0 0-.829 2.54 1.724 1.724 0 0 1-2.9 1.673 1.724 1.724 0 0 0-2.573 1.066 1.724 1.724 0 0 1-3.35 0 1.724 1.724 0 0 0-2.573-1.066 1.724 1.724 0 0 1-2.9-1.673 1.724 1.724 0 0 0-.829-2.54 1.724 1.724 0 0 1 0-2.808 1.724 1.724 0 0 0 .829-2.54 1.724 1.724 0 0 1 2.9-1.673 1.724 1.724 0 0 0 2.573-1.066Z" />
                  <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 1 1-6 0 3 3 0 0 1 6 0Z" />
                </svg>
              </Link>
              <form action={signOut}>
                <button type="submit" className="ui-btn-ghost">Deconnexion</button>
              </form>
            </div>
          </div>
        </div>
        <AdminNavBar teamSlug={teamSlug} switcherTeams={switcherTeams} />
      </header>
      <div className="mx-auto w-full max-w-6xl flex-1 px-4 py-4 sm:py-6 md:px-6">{children}</div>
    </div>
  );
}
