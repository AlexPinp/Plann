import type { ReactNode } from "react";
import Link from "next/link";
import { requireTeamAdmin } from "@/lib/team";
import { adminTeamPath, workspacePath } from "@/lib/routes";

type Props = {
  children: ReactNode;
  params: Promise<{ team: string }>;
};

export default async function AdminTeamLayout({ children, params }: Props) {
  const { team: teamSlug } = await params;
  const ctx = await requireTeamAdmin(teamSlug);

  return (
    <div className="flex min-h-full flex-col bg-zinc-50">
      <header className="sticky top-0 z-50 border-b border-zinc-200 bg-white/95 backdrop-blur">
        <div className="mx-auto flex max-w-6xl flex-col gap-2 px-3 py-2.5 sm:px-4 md:flex-row md:items-center md:justify-between md:px-6">
          <div className="flex flex-wrap items-center gap-x-4 gap-y-1">
            <span className="text-sm font-bold text-zinc-900">Administration</span>
            <span className="text-xs font-medium text-zinc-500">{ctx.team.label}</span>
            <nav className="flex w-full gap-1 overflow-x-auto text-sm md:w-auto md:flex-wrap">
              <Link
                href={adminTeamPath(teamSlug, "planning")}
                className="shrink-0 whitespace-nowrap rounded-md px-2.5 py-1 text-zinc-600 hover:bg-zinc-100 hover:text-zinc-900"
              >
                Planning modifiable
              </Link>
              <Link
                href={adminTeamPath(teamSlug, "demandes")}
                className="shrink-0 whitespace-nowrap rounded-md px-2.5 py-1 text-zinc-600 hover:bg-zinc-100 hover:text-zinc-900"
              >
                Demandes
              </Link>
              <Link
                href={adminTeamPath(teamSlug, "commentaires-suivis")}
                className="shrink-0 whitespace-nowrap rounded-md px-2.5 py-1 text-zinc-600 hover:bg-zinc-100 hover:text-zinc-900"
              >
                Commentaires et suivis
              </Link>
              <Link
                href={adminTeamPath(teamSlug, "parametres-admin")}
                className="shrink-0 whitespace-nowrap rounded-md px-2.5 py-1 text-zinc-600 hover:bg-zinc-100 hover:text-zinc-900"
              >
                Paramètres admin
              </Link>
            </nav>
          </div>
          <Link href={workspacePath(teamSlug, "planning-moi")} className="text-sm text-zinc-500 hover:text-zinc-800">
            &larr; Retour application
          </Link>
        </div>
      </header>
      <div className="mx-auto w-full max-w-6xl px-4 py-6 md:px-6">{children}</div>
    </div>
  );
}
