import { updateAgentTeamMemberships } from "../actions";
import { FicheBlock } from "./FicheBlock";
import { TeamAxisCheckboxes } from "./TeamAxisCheckboxes";

type TeamOption = {
  id: string;
  label: string;
  job: Parameters<typeof import("@/lib/team-axis-label").teamAxisShortLabel>[0]["job"];
  rhythm: Parameters<typeof import("@/lib/team-axis-label").teamAxisShortLabel>[0]["rhythm"];
};

type Props = {
  teamSlug: string;
  userId: string;
  axisTeams: TeamOption[];
  editableTeamIds: string[];
  checkedTeamIds: Set<string>;
};

export function EditAgentTeamsPanel({ teamSlug, userId, axisTeams, editableTeamIds, checkedTeamIds }: Props) {
  return (
    <FicheBlock title="Rattachements IDE / AS · jour / nuit">
      <form action={updateAgentTeamMemberships} className="space-y-2.5">
        <input type="hidden" name="teamSlug" value={teamSlug} />
        <input type="hidden" name="userId" value={userId} />
        <input type="hidden" name="afterMembership" value="detail" />
        <TeamAxisCheckboxes
          teams={axisTeams}
          editableTeamIds={editableTeamIds}
          name="membershipTeamId"
          checkedTeamIds={checkedTeamIds}
        />
        <button
          type="submit"
          className="rounded-md border border-zinc-300 bg-white px-3 py-1.5 text-xs font-medium text-zinc-800 hover:bg-zinc-50"
        >
          Enregistrer les équipes
        </button>
      </form>
    </FicheBlock>
  );
}
