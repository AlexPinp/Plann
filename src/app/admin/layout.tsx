import Link from "next/link";
import { requireStaffAdmin } from "@/lib/require-staff-admin";

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  await requireStaffAdmin();

  return (
    <div className="flex min-h-full flex-col bg-zinc-50">
      <header className="sticky top-0 z-50 border-b border-zinc-200 bg-white/95 backdrop-blur">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-3 px-4 py-2.5 md:px-6">
          <div className="flex items-center gap-4">
            <span className="text-sm font-bold text-zinc-900">Administration</span>
            <nav className="flex gap-1 text-sm">
              <Link href="/admin/planning" className="rounded-md px-2.5 py-1 text-zinc-600 hover:bg-zinc-100 hover:text-zinc-900">
                Planning modifiable
              </Link>
              <Link href="/admin/demandes" className="rounded-md px-2.5 py-1 text-zinc-600 hover:bg-zinc-100 hover:text-zinc-900">
                Demandes
              </Link>
              <Link href="/admin/commentaires-suivis" className="rounded-md px-2.5 py-1 text-zinc-600 hover:bg-zinc-100 hover:text-zinc-900">
                Commentaires et suivis
              </Link>
              <Link href="/admin/agents" className="rounded-md px-2.5 py-1 text-zinc-600 hover:bg-zinc-100 hover:text-zinc-900">
                Agents & competences
              </Link>
              <Link href="/admin/codes-horaires" className="rounded-md px-2.5 py-1 text-zinc-600 hover:bg-zinc-100 hover:text-zinc-900">
                Codes horaires
              </Link>
              <Link href="/admin/trames" className="rounded-md px-2.5 py-1 text-zinc-600 hover:bg-zinc-100 hover:text-zinc-900">
                Trames
              </Link>
            </nav>
          </div>
          <Link href="/planning-moi" className="text-sm text-zinc-500 hover:text-zinc-800">
            &larr; Retour application
          </Link>
        </div>
      </header>
      <div className="mx-auto w-full max-w-6xl px-4 py-6 md:px-6">{children}</div>
    </div>
  );
}
