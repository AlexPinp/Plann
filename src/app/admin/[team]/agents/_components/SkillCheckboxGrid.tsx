type Skill = { id: string; name: string };

export function SkillCheckboxGrid({
  skills,
  checkedIds,
  name = "skillIds",
}: {
  skills: Skill[];
  checkedIds: Set<string>;
  name?: string;
}) {
  return (
    <div className="grid grid-cols-2 gap-1.5 sm:grid-cols-3">
      {skills.map((s) => (
        <label
          key={s.id}
          className="flex cursor-pointer items-center gap-1.5 rounded-md border border-zinc-200 bg-white px-2 py-1.5 text-xs text-zinc-800 hover:border-zinc-300"
        >
          <input
            type="checkbox"
            name={name}
            value={s.id}
            defaultChecked={checkedIds.has(s.id)}
            className="rounded border-zinc-300"
          />
          {s.name}
        </label>
      ))}
    </div>
  );
}
