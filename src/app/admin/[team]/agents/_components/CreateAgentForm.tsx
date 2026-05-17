import { UserRole } from "@/generated/prisma/enums";
import { ColorPicker } from "@/components/ColorPicker";
import { DEFAULT_PLANNING_RH_PROFILE, PLANNING_RH_PROFILES, planningRhProfileLabelsFr } from "@/lib/planning-rh";
import { roleLabelsFr } from "@/lib/role-labels-fr";
import { createAgent } from "../actions";
import { AgentFormSection } from "./AgentFormSection";
import { inputClass, labelClass, TemplateNumberSelect, WorkPercentageSelect } from "./agent-form-shared";
import { SkillCheckboxGrid } from "./SkillCheckboxGrid";
import { TeamAxisCheckboxes } from "./TeamAxisCheckboxes";

type Skill = { id: string; name: string };
type TeamOption = {
  id: string;
  label: string;
  job: Parameters<typeof import("@/lib/team-axis-label").teamAxisShortLabel>[0]["job"];
  rhythm: Parameters<typeof import("@/lib/team-axis-label").teamAxisShortLabel>[0]["rhythm"];
};

type Props = {
  teamSlug: string;
  teamLabel: string;
  pageTeamId: string;
  axisTeams: TeamOption[];
  editableTeamIds: string[];
  allSkills: Skill[];
  availableTemplateNumbers: number[];
  templateMetaByNumber: Map<number, { cycleWeeks: number }>;
  showRolePicker: boolean;
};

export function CreateAgentForm({
  teamSlug,
  teamLabel,
  pageTeamId,
  axisTeams,
  editableTeamIds,
  allSkills,
  availableTemplateNumbers,
  templateMetaByNumber,
  showRolePicker,
}: Props) {
  return (
    <form action={createAgent} className="space-y-5">
      <input type="hidden" name="teamSlug" value={teamSlug} />

      <AgentFormSection title="Identité" description="Coordonnées de base du nouvel agent.">
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label className={labelClass} htmlFor="firstName">
              Prénom
            </label>
            <input id="firstName" name="firstName" required className={inputClass} />
          </div>
          <div>
            <label className={labelClass} htmlFor="lastName">
              Nom
            </label>
            <input id="lastName" name="lastName" required className={inputClass} />
          </div>
          <div className="sm:col-span-2">
            <label className={labelClass} htmlFor="email">
              Email professionnel
            </label>
            <input
              id="email"
              name="email"
              type="email"
              required
              autoComplete="off"
              placeholder="prenom.nom@ght85.fr"
              className={inputClass}
            />
          </div>
        </div>
      </AgentFormSection>

      <AgentFormSection
        title="Rattachement IDE/AS · jour/nuit"
        description={`Cochez les équipes auxquelles la personne appartient. Le planning ci-dessous s'applique à ${teamLabel}.`}
      >
        <TeamAxisCheckboxes
          teams={axisTeams}
          editableTeamIds={editableTeamIds}
          name="initialTeamId"
          checkedTeamIds={new Set()}
          defaultCheckedIds={[pageTeamId]}
        />
      </AgentFormSection>

      <AgentFormSection title="Planning et rôle" description="Paramètres pour la grille de cette équipe.">
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label className={labelClass} htmlFor="workPercentage">
              Temps de travail (%)
            </label>
            <WorkPercentageSelect id="workPercentage" name="workPercentage" defaultValue={100} />
          </div>
          {showRolePicker ? (
            <div>
              <label className={labelClass} htmlFor="role">
                Rôle
              </label>
              <select id="role" name="role" defaultValue={UserRole.AGENT} className={inputClass}>
                <option value={UserRole.AGENT}>{roleLabelsFr[UserRole.AGENT]}</option>
                <option value={UserRole.CADRE}>Cadre</option>
                <option value={UserRole.REFERENT}>Référent</option>
                <option value={UserRole.ADMIN}>Administrateur</option>
              </select>
            </div>
          ) : (
            <input type="hidden" name="role" value={UserRole.AGENT} />
          )}
          <div>
            <label className={labelClass} htmlFor="planningGroupLabel">
              Bloc / équipe
            </label>
            <input
              id="planningGroupLabel"
              name="planningGroupLabel"
              placeholder="A, B, C, CDS…"
              className={inputClass}
            />
          </div>
          <div>
            <label className={labelClass} htmlFor="planningTemplateNumber">
              Numéro de trame
            </label>
            <TemplateNumberSelect
              id="planningTemplateNumber"
              name="planningTemplateNumber"
              defaultValue={null}
              availableTemplateNumbers={availableTemplateNumbers}
              templateMetaByNumber={templateMetaByNumber}
            />
          </div>
          <div className="sm:col-span-2">
            <label className={labelClass} htmlFor="planningRhProfile">
              Profil RH (CHD)
            </label>
            <select id="planningRhProfile" name="planningRhProfile" defaultValue={DEFAULT_PLANNING_RH_PROFILE} className={inputClass}>
              {PLANNING_RH_PROFILES.map((profile) => (
                <option key={profile} value={profile}>
                  {planningRhProfileLabelsFr[profile]}
                </option>
              ))}
            </select>
          </div>
          <ColorPicker name="planningGroupColor" />
        </div>
      </AgentFormSection>

      {allSkills.length > 0 ? (
        <AgentFormSection title="Compétences" description="Secteurs où l'agent peut être affecté (optionnel).">
          <SkillCheckboxGrid skills={allSkills} checkedIds={new Set()} />
        </AgentFormSection>
      ) : null}

      <div className="flex flex-wrap items-center gap-3 pt-1">
        <button type="submit" className="rounded-lg bg-zinc-900 px-5 py-2 text-sm font-medium text-white hover:bg-zinc-800">
          Créer l&apos;agent
        </button>
      </div>
    </form>
  );
}
