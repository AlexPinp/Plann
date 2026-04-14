import Link from "next/link";
import { notFound } from "next/navigation";
import { UserRole } from "@/generated/prisma/enums";
import { ColorPicker } from "@/components/ColorPicker";
import { PLANNING_RH_PROFILES, planningRhProfileLabelsFr } from "@/lib/planning-rh";
import { prisma } from "@/lib/prisma";
import { requireStaffAdmin } from "@/lib/require-staff-admin";
import { updateAgent } from "../actions";

type Props = {
  params: Promise<{ id: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

export default async function EditAgentPage({ params, searchParams }: Props) {
  const actor = await requireStaffAdmin();
  const { id } = await params;
  const sp = await searchParams;
  const error = typeof sp.error === "string" ? sp.error : undefined;

  const [user, allSkills, templateNumbersRows, allUsers] = await Promise.all([
    prisma.user.findUnique({
      where: { id },
      include: { skills: { select: { skillId: true } } },
    }),
    prisma.skill.findMany({ orderBy: { name: "asc" } }),
    prisma.planningTemplate.findMany({
      select: { number: true },
      orderBy: { number: "asc" },
    }),
    prisma.user.findMany({
      where: { active: true },
      select: { id: true, firstName: true, lastName: true, alternancePartnerId: true },
      orderBy: [{ lastName: "asc" }, { firstName: "asc" }],
    }),
  ]);

  if (!user) notFound();

  const userSkillIds = new Set(user.skills.map((us) => us.skillId));
  const showRolePicker = actor.role === UserRole.ADMIN;
  const availableTemplateNumbers = Array.from(
    new Set([
      ...templateNumbersRows.map((row) => row.number),
      ...(user.planningTemplateNumber ? [user.planningTemplateNumber] : []),
      ...(user.planningTemplateNumberA ? [user.planningTemplateNumberA] : []),
      ...(user.planningTemplateNumberB ? [user.planningTemplateNumberB] : []),
    ]),
  ).sort((a, b) => a - b);
  const potentialPartners = allUsers.filter((candidate) => candidate.id !== user.id);
  const anchorDateInputValue = user.alternanceAnchorDate
    ? `${user.alternanceAnchorDate.getUTCFullYear()}-${String(user.alternanceAnchorDate.getUTCMonth() + 1).padStart(2, "0")}-${String(user.alternanceAnchorDate.getUTCDate()).padStart(2, "0")}`
    : "";

  return (
    <main>
      <Link href="/admin/agents" className="text-sm text-zinc-500 hover:text-zinc-800">
        &larr; Liste des agents
      </Link>
      <h1 className="mt-4 text-2xl font-semibold text-zinc-900">
        Modifier {user.lastName.toUpperCase()} {user.firstName}
      </h1>

      {error && <p className="mt-4 rounded-lg bg-rose-50 px-3 py-2 text-sm text-rose-800">{error}</p>}

      {user.authUserId && (
        <p className="mt-3 text-sm text-amber-800">
          Compte deja lie a Supabase : l&apos;email ne peut pas etre modifie ici.
        </p>
      )}

      <form action={updateAgent} className="mt-6 max-w-2xl space-y-5 rounded-xl border border-zinc-200 bg-white p-5 shadow-sm">
        <input type="hidden" name="id" value={user.id} />

        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label className="text-xs font-medium text-zinc-600" htmlFor="firstName">Prenom</label>
            <input id="firstName" name="firstName" required defaultValue={user.firstName} className="mt-1 w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm" />
          </div>
          <div>
            <label className="text-xs font-medium text-zinc-600" htmlFor="lastName">Nom</label>
            <input id="lastName" name="lastName" required defaultValue={user.lastName} className="mt-1 w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm" />
          </div>
        </div>

        <div>
          <label className="text-xs font-medium text-zinc-600" htmlFor="email">Email professionnel</label>
          <input
            id="email"
            name="email"
            type="email"
            required
            readOnly={!!user.authUserId}
            aria-readonly={!!user.authUserId}
            defaultValue={user.email}
            className="mt-1 w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm read-only:bg-zinc-100 read-only:text-zinc-500"
          />
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label className="text-xs font-medium text-zinc-600" htmlFor="workPercentage">Temps de travail (%)</label>
            <select id="workPercentage" name="workPercentage" defaultValue={user.workPercentage} className="mt-1 w-full appearance-none rounded-lg border border-zinc-300 bg-none px-3 py-2 text-sm">
              <option value={100}>100 %</option>
              <option value={90}>90 %</option>
              <option value={80}>80 %</option>
              <option value={75}>75 %</option>
              <option value={70}>70 %</option>
              <option value={60}>60 %</option>
              <option value={50}>50 %</option>
            </select>
          </div>
          <div>
            <label className="text-xs font-medium text-zinc-600" htmlFor="planningGroupLabel">Bloc / equipe</label>
            <input id="planningGroupLabel" name="planningGroupLabel" defaultValue={user.planningGroupLabel ?? ""} className="mt-1 w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm" />
          </div>
          <div>
            <label className="text-xs font-medium text-zinc-600" htmlFor="planningTemplateNumber">Numero de trame</label>
            <select
              id="planningTemplateNumber"
              name="planningTemplateNumber"
              defaultValue={user.planningTemplateNumber ?? ""}
              className="mt-1 w-full appearance-none rounded-lg border border-zinc-300 bg-none px-3 py-2 text-sm"
            >
              <option value="">Aucune</option>
              {availableTemplateNumbers.map((n) => (
                <option key={n} value={n}>
                  Trame {n}
                </option>
              ))}
            </select>
          </div>
          <div className="sm:col-span-2">
            <label className="text-xs font-medium text-zinc-600" htmlFor="planningRhProfile">Profil RH (CHD)</label>
            <select
              id="planningRhProfile"
              name="planningRhProfile"
              defaultValue={user.planningRhProfile}
              className="mt-1 w-full appearance-none rounded-lg border border-zinc-300 bg-none px-3 py-2 text-sm"
            >
              {PLANNING_RH_PROFILES.map((profile) => (
                <option key={profile} value={profile}>
                  {planningRhProfileLabelsFr[profile]}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div className="rounded-lg border border-zinc-200 bg-zinc-50 p-3">
          <label className="inline-flex items-center gap-2 text-sm font-medium text-zinc-800">
            <input
              type="checkbox"
              name="isAlternant"
              defaultChecked={user.isAlternant}
              className="rounded border-zinc-300"
            />
            Agent alternant (A/B)
          </label>
          <p className="mt-1 text-[11px] text-zinc-600">
            Configurez les 2 etats (A et B), la duree du cycle et le binome.
          </p>
          <div className="mt-3 grid gap-3 sm:grid-cols-2">
            <div>
              <label className="text-xs font-medium text-zinc-600" htmlFor="alternanceCycleWeeks">Duree d&apos;un bloc (semaines)</label>
              <input
                id="alternanceCycleWeeks"
                name="alternanceCycleWeeks"
                type="number"
                min={1}
                max={52}
                defaultValue={user.alternanceCycleWeeks}
                className="mt-1 w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm"
              />
            </div>
            <div>
              <label className="text-xs font-medium text-zinc-600" htmlFor="alternanceAnchorDate">Date d&apos;ancrage (debut cycle)</label>
              <input
                id="alternanceAnchorDate"
                name="alternanceAnchorDate"
                type="date"
                defaultValue={anchorDateInputValue}
                className="mt-1 w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm"
              />
            </div>
            <div>
              <label className="text-xs font-medium text-zinc-600" htmlFor="alternancePhase">Phase binome</label>
              <select
                id="alternancePhase"
                name="alternancePhase"
                defaultValue={String(user.alternancePhase)}
                className="mt-1 w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm"
              >
                <option value="0">Phase 0 (A au demarrage)</option>
                <option value="1">Phase 1 (B au demarrage)</option>
              </select>
            </div>
            <div>
              <label className="text-xs font-medium text-zinc-600" htmlFor="alternancePartnerId">Binome alternant</label>
              <select
                id="alternancePartnerId"
                name="alternancePartnerId"
                defaultValue={user.alternancePartnerId ?? ""}
                className="mt-1 w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm"
              >
                <option value="">Aucun</option>
                {potentialPartners.map((candidate) => (
                  <option key={candidate.id} value={candidate.id}>
                    {candidate.lastName.toUpperCase()} {candidate.firstName}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="text-xs font-medium text-zinc-600" htmlFor="planningTemplateNumberA">Trame A</label>
              <select
                id="planningTemplateNumberA"
                name="planningTemplateNumberA"
                defaultValue={user.planningTemplateNumberA ?? ""}
                className="mt-1 w-full appearance-none rounded-lg border border-zinc-300 bg-none px-3 py-2 text-sm"
              >
                <option value="">Aucune</option>
                {availableTemplateNumbers.map((n) => (
                  <option key={`a-${n}`} value={n}>
                    Trame {n}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="text-xs font-medium text-zinc-600" htmlFor="planningTemplateNumberB">Trame B</label>
              <select
                id="planningTemplateNumberB"
                name="planningTemplateNumberB"
                defaultValue={user.planningTemplateNumberB ?? ""}
                className="mt-1 w-full appearance-none rounded-lg border border-zinc-300 bg-none px-3 py-2 text-sm"
              >
                <option value="">Aucune</option>
                {availableTemplateNumbers.map((n) => (
                  <option key={`b-${n}`} value={n}>
                    Trame {n}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="text-xs font-medium text-zinc-600" htmlFor="planningGroupLabelA">Equipe / bloc A</label>
              <input
                id="planningGroupLabelA"
                name="planningGroupLabelA"
                defaultValue={user.planningGroupLabelA ?? ""}
                className="mt-1 w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm"
              />
            </div>
            <div>
              <label className="text-xs font-medium text-zinc-600" htmlFor="planningGroupLabelB">Equipe / bloc B</label>
              <input
                id="planningGroupLabelB"
                name="planningGroupLabelB"
                defaultValue={user.planningGroupLabelB ?? ""}
                className="mt-1 w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm"
              />
            </div>
          </div>
        </div>

        <ColorPicker name="planningGroupColor" defaultValue={user.planningGroupColor} />

        <div>
          <label className="text-xs font-medium text-zinc-600" htmlFor="displayOrder">Ordre d&apos;affichage</label>
          <input id="displayOrder" name="displayOrder" type="number" min={0} defaultValue={user.displayOrder} className="mt-1 w-32 rounded-lg border border-zinc-300 px-3 py-2 text-sm" />
          <p className="mt-1 text-[11px] text-zinc-500">Plus petit = plus haut dans la grille planning.</p>
        </div>

        {showRolePicker ? (
          <div>
            <label className="text-xs font-medium text-zinc-600" htmlFor="role">Role</label>
            <select id="role" name="role" defaultValue={user.role} className="mt-1 w-full appearance-none rounded-lg border border-zinc-300 bg-none px-3 py-2 text-sm">
              <option value={UserRole.AGENT}>Agent (lecture seule)</option>
              <option value={UserRole.CADRE}>Cadre</option>
              <option value={UserRole.REFERENT}>Referent</option>
              <option value={UserRole.ADMIN}>Administrateur</option>
            </select>
          </div>
        ) : (
          <input type="hidden" name="role" value={user.role} />
        )}

        {allSkills.length > 0 && (
          <div>
            <p className="text-xs font-medium text-zinc-600">Competences / secteurs</p>
            <p className="mt-0.5 text-[11px] text-zinc-500">Cochez les secteurs ou l&apos;agent peut etre affecte.</p>
            <div className="mt-2 flex flex-wrap gap-x-5 gap-y-2">
              {allSkills.map((s) => (
                <label key={s.id} className="flex items-center gap-1.5 text-sm text-zinc-700">
                  <input
                    type="checkbox"
                    name="skillIds"
                    value={s.id}
                    defaultChecked={userSkillIds.has(s.id)}
                    className="rounded border-zinc-300"
                  />
                  {s.name}
                </label>
              ))}
            </div>
          </div>
        )}

        <div className="flex items-center gap-3 pt-2">
          <button type="submit" className="rounded-lg bg-zinc-900 px-5 py-2 text-sm font-medium text-white hover:bg-zinc-800">
            Enregistrer
          </button>
          <Link href="/admin/agents" className="text-sm text-zinc-500 hover:text-zinc-800">Annuler</Link>
        </div>
      </form>
    </main>
  );
}
