import { setAgentActive } from "../actions";

type Props = {
  teamSlug: string;
  userId: string;
  active: boolean;
};

export function EditAgentHeaderStatus({ teamSlug, userId, active }: Props) {
  return (
    <div className="mt-2 flex flex-wrap items-center gap-2">
      <span
        className={[
          "rounded-full px-2.5 py-0.5 text-[11px] font-semibold",
          active ? "bg-emerald-100 text-emerald-800" : "bg-zinc-200 text-zinc-600",
        ].join(" ")}
      >
        {active ? "Actif" : "Inactif"}
      </span>
      <form action={setAgentActive}>
        <input type="hidden" name="teamSlug" value={teamSlug} />
        <input type="hidden" name="id" value={userId} />
        <input type="hidden" name="active" value={active ? "false" : "true"} />
        <button
          type="submit"
          className={[
            "rounded-md px-2.5 py-0.5 text-[11px] font-medium",
            active
              ? "text-rose-700 hover:bg-rose-50"
              : "text-emerald-700 hover:bg-emerald-50",
          ].join(" ")}
        >
          {active ? "Désactiver" : "Réactiver"}
        </button>
      </form>
    </div>
  );
}
