import Link from "next/link";
import { notFound } from "next/navigation";
import { adminTeamPath } from "@/lib/routes";
import { getTeamBySlug } from "@/lib/team";

type Props = {
  params: Promise<{ team: string }>;
};

const SETTINGS_LINKS = [
  {
    title: "Agents",
    description: "Gestion des fiches agents, roles, trames, profils RH et competences.",
    segment: "agents",
  },
  {
    title: "Codes horaires",
    description: "Codes de poste propres a cette equipe (horaires, categories, couleurs).",
    segment: "codes-horaires",
  },
  {
    title: "Trames",
    description: "Trames pour cette equipe.",
    segment: "trames",
  },
] as const;

export default async function ParametresAdminPage({ params }: Props) {
  const { team: teamSlug } = await params;
  const team = await getTeamBySlug(teamSlug);
  if (!team) notFound();

  return (
    <main>
      <div className="mb-6">
        <h1 className="text-xl font-semibold text-zinc-900 sm:text-2xl">Paramètres admin</h1>
        <p className="mt-1 text-sm text-zinc-600">
          Espace de configuration pour l&apos;equipe {team.label}.
        </p>
      </div>

      <section className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {SETTINGS_LINKS.map((item) => {
          const href = adminTeamPath(team.slug, item.segment);
          return (
            <Link
              key={item.title}
              href={href}
              className="rounded-xl border border-zinc-200 bg-white p-4 shadow-sm transition hover:border-zinc-300 hover:bg-zinc-50"
            >
              <h2 className="text-sm font-semibold text-zinc-900">{item.title}</h2>
              <p className="mt-1 text-xs text-zinc-600">{item.description}</p>
            </Link>
          );
        })}
      </section>
    </main>
  );
}
