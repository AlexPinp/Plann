import { teamAxisShortLabel } from "@/lib/team-axis-label";

type TeamOption = {
  id: string;
  label: string;
  job: Parameters<typeof teamAxisShortLabel>[0]["job"];
  rhythm: Parameters<typeof teamAxisShortLabel>[0]["rhythm"];
};

type Props = {
  teams: TeamOption[];
  editableTeamIds: string[];
  /** Checkbox name attribute */
  name: string;
  checkedTeamIds: Set<string>;
  /** Teams checked by default when creating (e.g. current page team) */
  defaultCheckedIds?: string[];
};

export function TeamAxisCheckboxes({ teams, editableTeamIds, name, checkedTeamIds, defaultCheckedIds }: Props) {
  return (
    <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
      {teams.map((t) => {
        const canEdit = editableTeamIds.includes(t.id);
        const checked = checkedTeamIds.has(t.id) || defaultCheckedIds?.includes(t.id);
        return (
          <label
            key={t.id}
            className={[
              "flex cursor-pointer items-center gap-2 rounded-md border border-zinc-200 bg-white px-2.5 py-2 text-xs font-medium text-zinc-800",
              !canEdit ? "cursor-not-allowed opacity-50" : "hover:border-zinc-300",
            ].join(" ")}
            title={t.label}
          >
            <input
              type="checkbox"
              name={name}
              value={t.id}
              defaultChecked={checked}
              disabled={!canEdit}
              className="rounded border-zinc-300"
            />
            <span>{teamAxisShortLabel(t)}</span>
          </label>
        );
      })}
    </div>
  );
}
