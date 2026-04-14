import Link from "next/link";
import { prisma } from "@/lib/prisma";

export default async function AgentsPage() {
  const users = await prisma.user.findMany({
    include: {
      skills: { include: { skill: true } },
      availabilities: true,
    },
    orderBy: [{ lastName: "asc" }],
  });

  return (
    <main className="mx-auto w-full max-w-5xl flex-1 p-6 md:p-10">
      <div className="mb-6">
        <h1 className="text-2xl font-semibold text-zinc-900">Vue équipe</h1>
        <p className="text-sm text-zinc-600">
          Liste des agents et compétences. Pour créer ou modifier les fiches (email, accès), ouvrez le{" "}
          <Link href="/admin/agents" className="font-medium text-zinc-800 underline hover:text-zinc-950">
            panneau admin — Agents
          </Link>{" "}
          (cadres et administrateurs).
        </p>
      </div>

      <div className="rounded-xl border border-zinc-200 bg-white shadow-sm">
        <table className="w-full border-collapse text-sm">
          <thead className="bg-zinc-50">
            <tr>
              <th className="border-b border-zinc-200 p-3 text-left font-semibold text-zinc-700">Nom</th>
              <th className="border-b border-zinc-200 p-3 text-left font-semibold text-zinc-700">Compétences</th>
              <th className="border-b border-zinc-200 p-3 text-left font-semibold text-zinc-700">État</th>
            </tr>
          </thead>
          <tbody>
            {users.map((nurse) => (
              <tr key={nurse.id}>
                <td className="border-b border-zinc-100 p-3 font-medium text-zinc-800">
                  {nurse.firstName} {nurse.lastName}
                </td>
                <td className="border-b border-zinc-100 p-3 text-zinc-700">
                  {nurse.skills.length ? nurse.skills.map((entry) => entry.skill.name).join(", ") : "Aucune"}
                </td>
                <td className="border-b border-zinc-100 p-3">
                  {nurse.availabilities.length ? (
                    <span className="rounded-md bg-rose-100 px-2 py-1 text-xs font-semibold text-rose-800">
                      Indisponible
                    </span>
                  ) : (
                    <span className="rounded-md bg-emerald-100 px-2 py-1 text-xs font-semibold text-emerald-800">
                      Disponible
                    </span>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </main>
  );
}
