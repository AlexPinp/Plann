import type { ReactNode } from "react";
import Link from "next/link";
import { WorkspaceTabs } from "@/components/WorkspaceTabs";
import { getSessionPrismaUser } from "@/lib/current-user";
import { canEditPlanningAndStaff } from "@/lib/user-roles";
import { signOut } from "../login/actions";

export default async function WorkspaceLayout({ children }: { children: ReactNode }) {
  const agent = await getSessionPrismaUser();
  const canStaff = canEditPlanningAndStaff(agent?.role);

  return (
    <div className="flex min-h-full flex-col">
      <header className="sticky top-0 z-50 border-b border-zinc-200 bg-white/95 backdrop-blur">
        <div className="mx-auto flex w-full max-w-7xl items-center justify-between gap-3 px-4 py-2.5 md:px-6">
          <span className="text-sm font-bold text-zinc-900">Planner SAU</span>

          <div className="flex items-center gap-3">
            {agent && (
              <span className="hidden text-xs text-zinc-500 sm:inline">
                {agent.lastName.toUpperCase()} {agent.firstName}
              </span>
            )}
            {canStaff && (
              <Link
                href="/admin"
                className="rounded-md border border-zinc-900 bg-zinc-900 px-2.5 py-1 text-xs font-medium text-white hover:bg-zinc-800"
              >
                Administration
              </Link>
            )}
            <form action={signOut}>
              <button
                type="submit"
                className="rounded-md border border-zinc-200 px-2.5 py-1 text-xs text-zinc-600 hover:bg-zinc-50"
              >
                Deconnexion
              </button>
            </form>
          </div>
        </div>
        <WorkspaceTabs />
      </header>
      {children}
    </div>
  );
}
