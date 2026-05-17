import Link from "next/link";
import { format } from "date-fns";
import { fr } from "date-fns/locale";
import { UserRole } from "@/generated/prisma/enums";
import { ColorPicker } from "@/components/ColorPicker";
import { PLANNING_RH_PROFILES, planningRhProfileLabelsFr } from "@/lib/planning-rh";
import { roleLabelsFr } from "@/lib/role-labels-fr";
import { deleteUserWorkRateSegment, updateAgent, upsertUserWorkRateSegment } from "../actions";
import { AlternanceDetailsCollapsible } from "../AlternanceDetailsCollapsible";
import { FicheBlock } from "./FicheBlock";
import {
  inputClass,
  labelClass,
  TemplateNumberSelect,
  WorkPercentageSelect,
} from "./agent-form-shared";
import { SkillCheckboxGrid } from "./SkillCheckboxGrid";

type Skill = { id: string; name: string };
type Partner = { id: string; firstName: string; lastName: string };
type WorkRateSegment = { id: string; monthStartsOn: Date; workPercentage: number };

type Props = {
  teamSlug: string;
  teamLabel: string;
  agentsListPath: string;
  user: {
    id: string;
    firstName: string;
    lastName: string;
    email: string;
    authUserId: string | null;
    workPercentage: number;
    planningRhProfile: string;
    isAlternant: boolean;
    alternanceCycleWeeks: number;
    alternancePhase: number;
    alternancePartnerId: string | null;
  };
  effBloc: string | null;
  effBlocColor: string | null;
  effTrame: number | null;
  effTrameA: number | null;
  effTrameB: number | null;
  effLabelA: string | null;
  effLabelB: string | null;
  effRole: UserRole;
  showInTeamPlanning: boolean;
  showInAdminPlanning: boolean;
  showRolePicker: boolean;
  anchorDateInputValue: string;
  availableTemplateNumbers: number[];
  templateMetaByNumber: Map<number, { cycleWeeks: number }>;
  allSkills: Skill[];
  userSkillIds: Set<string>;
  potentialPartners: Partner[];
  workRateSegments: WorkRateSegment[];
};

const fieldGrid = "grid gap-2.5 sm:grid-cols-2 lg:grid-cols-4";

export function EditAgentMainForm(props: Props) {
  const {
    teamSlug,
    teamLabel,
    agentsListPath,
    user,
    effBloc,
    effBlocColor,
    effTrame,
    effTrameA,
    effTrameB,
    effLabelA,
    effLabelB,
    effRole,
    showInTeamPlanning,
    showInAdminPlanning,
    showRolePicker,
    anchorDateInputValue,
    availableTemplateNumbers,
    templateMetaByNumber,
    allSkills,
    userSkillIds,
    potentialPartners,
    workRateSegments,
  } = props;

  return (
    <form action={updateAgent}>
      <input type="hidden" name="teamSlug" value={teamSlug} />
      <input type="hidden" name="id" value={user.id} />
      {!showRolePicker ? <input type="hidden" name="role" value={effRole} /> : null}

      <FicheBlock title="Coordonnées">
        <div className={fieldGrid}>
          <div>
            <label className={labelClass} htmlFor="firstName">Prénom</label>
            <input id="firstName" name="firstName" required defaultValue={user.firstName} className={inputClass} />
          </div>
          <div>
            <label className={labelClass} htmlFor="lastName">Nom</label>
            <input id="lastName" name="lastName" required defaultValue={user.lastName} className={inputClass} />
          </div>
          <div className={showRolePicker ? "" : "sm:col-span-2"}>
            <label className={labelClass} htmlFor="email">Email</label>
            <input
              id="email"
              name="email"
              type="email"
              required
              readOnly={!!user.authUserId}
              defaultValue={user.email}
              className={`${inputClass} read-only:bg-zinc-100 read-only:text-zinc-500`}
            />
          </div>
          {showRolePicker ? (
            <div>
              <label className={labelClass} htmlFor="role">Rôle</label>
              <select id="role" name="role" defaultValue={effRole} className={inputClass}>
                <option value={UserRole.AGENT}>{roleLabelsFr[UserRole.AGENT]}</option>
                <option value={UserRole.CADRE}>{roleLabelsFr[UserRole.CADRE]}</option>
                <option value={UserRole.REFERENT}>{roleLabelsFr[UserRole.REFERENT]}</option>
                <option value={UserRole.ADMIN}>{roleLabelsFr[UserRole.ADMIN]}</option>
              </select>
            </div>
          ) : null}
        </div>
      </FicheBlock>

      <FicheBlock title={`Planning · ${teamLabel}`}>
        <div className={fieldGrid}>
          <div>
            <label className={labelClass} htmlFor="planningGroupLabel">Bloc</label>
            <input
              id="planningGroupLabel"
              name="planningGroupLabel"
              defaultValue={effBloc ?? ""}
              placeholder="A, B…"
              className={inputClass}
            />
          </div>
          <div>
            <label className={labelClass} htmlFor="planningTemplateNumber">Trame</label>
            <TemplateNumberSelect
              id="planningTemplateNumber"
              name="planningTemplateNumber"
              defaultValue={effTrame}
              availableTemplateNumbers={availableTemplateNumbers}
              templateMetaByNumber={templateMetaByNumber}
            />
          </div>
          <div>
            <label className={labelClass} htmlFor="planningRhProfile">Profil RH</label>
            <select
              id="planningRhProfile"
              name="planningRhProfile"
              defaultValue={user.planningRhProfile}
              className={inputClass}
            >
              {PLANNING_RH_PROFILES.map((profile) => (
                <option key={profile} value={profile}>
                  {planningRhProfileLabelsFr[profile]}
                </option>
              ))}
            </select>
          </div>
          <ColorPicker name="planningGroupColor" defaultValue={effBlocColor} compact />
        </div>

        <div className="mt-2.5 flex flex-wrap gap-x-4 gap-y-1 text-xs text-zinc-800">
          <label className="flex items-center gap-1.5">
            <input
              type="checkbox"
              name="showInTeamPlanning"
              defaultChecked={showInTeamPlanning}
              className="rounded border-zinc-300"
            />
            Grille équipe
          </label>
          <label className="flex items-center gap-1.5">
            <input
              type="checkbox"
              name="showInAdminPlanning"
              defaultChecked={showInAdminPlanning}
              className="rounded border-zinc-300"
            />
            Grille admin
          </label>
          <label className="flex items-center gap-1.5 font-medium">
            <input
              type="checkbox"
              name="isAlternant"
              defaultChecked={user.isAlternant}
              className="rounded border-zinc-300"
            />
            Alternance A/B
          </label>
        </div>

        <AlternanceDetailsCollapsible defaultOpen={user.isAlternant}>
          <div className={`mt-2.5 ${fieldGrid}`}>
            <div>
              <label className={labelClass} htmlFor="alternanceCycleWeeks">Cycle (sem.)</label>
              <input
                id="alternanceCycleWeeks"
                name="alternanceCycleWeeks"
                type="number"
                min={1}
                max={52}
                defaultValue={user.alternanceCycleWeeks}
                className={inputClass}
              />
            </div>
            <div>
              <label className={labelClass} htmlFor="alternanceAnchorDate">Ancrage</label>
              <input
                id="alternanceAnchorDate"
                name="alternanceAnchorDate"
                type="date"
                defaultValue={anchorDateInputValue}
                className={inputClass}
              />
            </div>
            <div>
              <label className={labelClass} htmlFor="alternancePhase">Phase</label>
              <select
                id="alternancePhase"
                name="alternancePhase"
                defaultValue={String(user.alternancePhase)}
                className={inputClass}
              >
                <option value="0">A</option>
                <option value="1">B</option>
              </select>
            </div>
            <div>
              <label className={labelClass} htmlFor="alternancePartnerId">Binôme</label>
              <select
                id="alternancePartnerId"
                name="alternancePartnerId"
                defaultValue={user.alternancePartnerId ?? ""}
                className={inputClass}
              >
                <option value="">—</option>
                {potentialPartners.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.lastName.toUpperCase()} {c.firstName}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className={labelClass} htmlFor="planningTemplateNumberA">Trame A</label>
              <TemplateNumberSelect
                id="planningTemplateNumberA"
                name="planningTemplateNumberA"
                defaultValue={effTrameA}
                availableTemplateNumbers={availableTemplateNumbers}
                templateMetaByNumber={templateMetaByNumber}
              />
            </div>
            <div>
              <label className={labelClass} htmlFor="planningTemplateNumberB">Trame B</label>
              <TemplateNumberSelect
                id="planningTemplateNumberB"
                name="planningTemplateNumberB"
                defaultValue={effTrameB}
                availableTemplateNumbers={availableTemplateNumbers}
                templateMetaByNumber={templateMetaByNumber}
              />
            </div>
            <div>
              <label className={labelClass} htmlFor="planningGroupLabelA">Bloc A</label>
              <input
                id="planningGroupLabelA"
                name="planningGroupLabelA"
                defaultValue={effLabelA ?? ""}
                className={inputClass}
              />
            </div>
            <div>
              <label className={labelClass} htmlFor="planningGroupLabelB">Bloc B</label>
              <input
                id="planningGroupLabelB"
                name="planningGroupLabelB"
                defaultValue={effLabelB ?? ""}
                className={inputClass}
              />
            </div>
          </div>
        </AlternanceDetailsCollapsible>
      </FicheBlock>

      <FicheBlock title="Temps de travail">
        <div className="flex flex-wrap items-end gap-3">
          <div className="w-24">
            <label className={labelClass} htmlFor="workPercentage">Défaut</label>
            <WorkPercentageSelect
              id="workPercentage"
              name="workPercentage"
              defaultValue={user.workPercentage}
            />
          </div>
          <p className="flex-1 text-[11px] leading-snug text-zinc-500">
            Utilisé sans segment. Les lignes ci-dessous priment mois par mois.
          </p>
        </div>

        {workRateSegments.length > 0 ? (
          <ul className="mt-2 divide-y divide-zinc-100 rounded-md border border-zinc-200 text-sm">
            {workRateSegments.map((seg) => (
              <li key={seg.id} className="flex items-center justify-between gap-2 px-2.5 py-1.5">
                <span className="capitalize text-zinc-900">
                  {format(seg.monthStartsOn, "MMM yyyy", { locale: fr })}
                </span>
                <span className="tabular-nums text-zinc-600">{seg.workPercentage} %</span>
                <form action={deleteUserWorkRateSegment}>
                  <input type="hidden" name="teamSlug" value={teamSlug} />
                  <input type="hidden" name="userId" value={user.id} />
                  <input type="hidden" name="segmentId" value={seg.id} />
                  <button type="submit" className="text-[11px] text-zinc-500 hover:text-rose-600">
                    Suppr.
                  </button>
                </form>
              </li>
            ))}
          </ul>
        ) : null}

        <form action={upsertUserWorkRateSegment} className="mt-2 flex flex-wrap items-end gap-2">
          <input type="hidden" name="teamSlug" value={teamSlug} />
          <input type="hidden" name="userId" value={user.id} />
          <div>
            <label htmlFor="segmentMonth" className={labelClass}>Mois</label>
            <input
              id="segmentMonth"
              name="segmentMonth"
              type="month"
              required
              className="mt-0.5 block rounded-md border border-zinc-300 px-2 py-1.5 text-sm"
            />
          </div>
          <div className="w-24">
            <label htmlFor="segmentWorkPercentage" className={labelClass}>%</label>
            <WorkPercentageSelect
              id="segmentWorkPercentage"
              name="segmentWorkPercentage"
              defaultValue={80}
              required
            />
          </div>
          <button
            type="submit"
            className="rounded-md border border-zinc-300 px-3 py-1.5 text-xs font-medium text-zinc-800 hover:bg-zinc-50"
          >
            Ajouter
          </button>
        </form>
      </FicheBlock>

      {allSkills.length > 0 ? (
        <FicheBlock title="Compétences">
          <SkillCheckboxGrid skills={allSkills} checkedIds={userSkillIds} />
        </FicheBlock>
      ) : null}

      <div className="flex flex-wrap items-center justify-end gap-2 border-t border-zinc-100 bg-zinc-50/50 px-4 py-2.5">
        <Link href={agentsListPath} className="px-2 py-1.5 text-xs text-zinc-500 hover:text-zinc-800">
          Annuler
        </Link>
        <button
          type="submit"
          className="rounded-md bg-zinc-900 px-4 py-1.5 text-xs font-medium text-white hover:bg-zinc-800"
        >
          Enregistrer
        </button>
      </div>
    </form>
  );
}
