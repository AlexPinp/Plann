"use client";

import { useRouter } from "next/navigation";
import { useMemo, useState, useTransition } from "react";
import {
  createTrainingType,
  deleteTrainingType,
  updateTrainingType,
  upsertTrainingCompletion,
} from "./actions";
import { getTrainingExpiryUrgency, urgencyCellClass } from "@/lib/training-expiry";

const inputClassBase =
  "min-w-0 w-full rounded border border-zinc-300 px-2 py-1 text-xs text-zinc-900 placeholder:text-zinc-400 focus:border-[var(--accent)] focus:outline-none focus:ring-1 focus:ring-[var(--accent)]";
const inputClass = `${inputClassBase} bg-white`;

const nameColWidth = "w-[9rem] min-w-[9rem] max-w-[9rem]";
const trainingColWidth = "w-[8rem] min-w-[8rem] max-w-[8rem]";
const addColWidth = "w-12 min-w-[3rem] max-w-[3rem]";

const thClass =
  "border border-zinc-200 bg-zinc-50 px-2 py-1.5 text-left align-middle text-[10px] font-semibold uppercase tracking-wide text-zinc-500";
const tdClass = "border border-zinc-200 px-2 py-1 align-middle text-xs text-zinc-900";
const dateTdClass = "border border-zinc-200 p-0 align-middle";
const dateInputClass =
  "ui-date-input-no-icon block h-9 min-h-9 w-full border-0 px-1 text-xs text-zinc-900 focus:outline-none focus:ring-2 focus:ring-inset focus:ring-[var(--accent)]";

export type TrainingColumn = {
  id: string;
  name: string;
  recurrenceMonths: number | null;
};

export type AgentRow = {
  id: string;
  label: string;
};

export type CompletionCell = {
  userId: string;
  trainingTypeId: string;
  lastCompletedAt: string | null;
};

type Props = {
  teamSlug: string;
  trainings: TrainingColumn[];
  agents: AgentRow[];
  completions: CompletionCell[];
};

function toDateInputValue(iso: string | null): string {
  if (!iso) return "";
  const match = /^(\d{4})-(\d{2})-(\d{2})/.exec(iso);
  return match ? `${match[1]}-${match[2]}-${match[3]}` : "";
}

function parseIsoDate(iso: string | null): Date | null {
  if (!iso) return null;
  const fromInput = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso);
  if (fromInput) {
    const y = Number(fromInput[1]);
    const m = Number(fromInput[2]);
    const d = Number(fromInput[3]);
    return new Date(Date.UTC(y, m - 1, d, 12, 0, 0, 0));
  }
  const parsed = new Date(iso);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

function buildCompletionMap(completions: CompletionCell[]): Map<string, string | null> {
  const map = new Map<string, string | null>();
  for (const c of completions) {
    map.set(`${c.userId}:${c.trainingTypeId}`, c.lastCompletedAt);
  }
  return map;
}

function AddTrainingColumn({ teamSlug, disabled }: { teamSlug: string; disabled: boolean }) {
  const [open, setOpen] = useState(false);
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  if (!open) {
    return (
      <button
        type="button"
        disabled={disabled}
        onClick={() => setOpen(true)}
        className="flex h-8 w-full min-w-[2.5rem] items-center justify-center rounded border border-dashed border-zinc-300 bg-zinc-50 text-lg font-medium text-zinc-600 transition hover:border-[var(--accent)] hover:bg-[var(--accent-soft)] hover:text-[var(--accent)] disabled:opacity-50"
        title="Ajouter une formation"
        aria-label="Ajouter une formation"
      >
        +
      </button>
    );
  }

  return (
    <form
      className="flex min-w-[10rem] flex-col gap-1.5"
      action={(fd) => {
        startTransition(async () => {
          await createTrainingType(fd);
          setOpen(false);
          router.refresh();
        });
      }}
    >
      <input type="hidden" name="teamSlug" value={teamSlug} />
      <input name="name" required placeholder="Nom" className={inputClass} autoFocus disabled={pending} />
      <div className="flex items-center gap-1">
        <input
          name="recurrenceMonths"
          type="number"
          min={1}
          max={600}
          placeholder="36"
          className={`${inputClass} w-14`}
          disabled={pending}
        />
        <span className="text-[10px] text-zinc-500">mois</span>
      </div>
      <div className="flex gap-1">
        <button
          type="submit"
          disabled={pending}
          className="rounded bg-[var(--accent)] px-2 py-0.5 text-[11px] font-medium text-white hover:opacity-90 disabled:opacity-50"
        >
          OK
        </button>
        <button
          type="button"
          disabled={pending}
          onClick={() => setOpen(false)}
          className="rounded border border-zinc-300 px-2 py-0.5 text-[11px] text-zinc-600 hover:bg-zinc-50"
        >
          Annuler
        </button>
      </div>
    </form>
  );
}

function DeleteTrainingDialog({
  training,
  pending,
  onCancel,
  onConfirm,
}: {
  training: TrainingColumn;
  pending: boolean;
  onCancel: () => void;
  onConfirm: () => void;
}) {
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="delete-training-title"
    >
      <button
        type="button"
        className="absolute inset-0 bg-zinc-900/40"
        aria-label="Fermer"
        onClick={onCancel}
        disabled={pending}
      />
      <div className="relative w-full max-w-sm rounded-xl border border-zinc-200 bg-white p-4 shadow-lg">
        <h2 id="delete-training-title" className="text-sm font-semibold text-zinc-900">
          Supprimer la formation ?
        </h2>
        <p className="mt-2 text-sm text-zinc-600">
          La colonne <span className="font-medium text-zinc-800">{training.name}</span> et toutes les dates
          saisies pour les agents seront définitivement supprimées.
        </p>
        <div className="mt-4 flex justify-end gap-2">
          <button
            type="button"
            onClick={onCancel}
            disabled={pending}
            className="ui-btn-ghost text-xs"
          >
            Annuler
          </button>
          <button
            type="button"
            onClick={onConfirm}
            disabled={pending}
            className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-1.5 text-xs font-medium text-rose-700 hover:bg-rose-100 disabled:opacity-50"
          >
            {pending ? "Suppression…" : "Supprimer"}
          </button>
        </div>
      </div>
    </div>
  );
}

function TrainingNameCell({
  teamSlug,
  training,
  onDelete,
}: {
  teamSlug: string;
  training: TrainingColumn;
  onDelete: () => void;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [name, setName] = useState(training.name);

  const save = () => {
    const trimmed = name.trim();
    if (!trimmed || trimmed === training.name) return;
    const fd = new FormData();
    fd.set("teamSlug", teamSlug);
    fd.set("id", training.id);
    fd.set("name", trimmed);
    startTransition(async () => {
      await updateTrainingType(fd);
      router.refresh();
    });
  };

  return (
    <div className="flex flex-col gap-1">
      <input
        value={name}
        onChange={(e) => setName(e.target.value)}
        onBlur={save}
        disabled={pending}
        className={`${inputClass} font-semibold uppercase`}
        aria-label={`Nom formation ${training.name}`}
      />
      <button
        type="button"
        onClick={onDelete}
        disabled={pending}
        className="self-start text-[10px] text-rose-600 hover:underline"
      >
        Supprimer
      </button>
    </div>
  );
}

function RecurrenceCell({ teamSlug, training }: { teamSlug: string; training: TrainingColumn }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [months, setMonths] = useState(training.recurrenceMonths?.toString() ?? "");

  const save = () => {
    const parsed = months.trim() ? Number(months) : null;
    const current = training.recurrenceMonths;
    if (parsed === current || (parsed === null && current === null)) return;
    if (parsed !== null && (!Number.isInteger(parsed) || parsed <= 0)) return;

    const fd = new FormData();
    fd.set("teamSlug", teamSlug);
    fd.set("id", training.id);
    fd.set("recurrenceMonths", months.trim());
    startTransition(async () => {
      await updateTrainingType(fd);
      router.refresh();
    });
  };

  return (
    <div className="flex items-center justify-center gap-1">
      <input
        type="number"
        min={1}
        max={600}
        value={months}
        onChange={(e) => setMonths(e.target.value)}
        onBlur={save}
        disabled={pending}
        placeholder="—"
        className={`${inputClass} w-12 text-center`}
        aria-label={`Récurrence ${training.name}`}
      />
      {months.trim() ? <span className="text-[10px] text-zinc-500">mois</span> : null}
    </div>
  );
}

function DateCell({
  teamSlug,
  userId,
  training,
  isoDate,
}: {
  teamSlug: string;
  userId: string;
  training: TrainingColumn;
  isoDate: string | null;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [value, setValue] = useState(toDateInputValue(isoDate));

  const displayValue = value || toDateInputValue(isoDate);
  const lastDate = parseIsoDate(displayValue || null);
  const urgency = getTrainingExpiryUrgency(lastDate, training.recurrenceMonths);
  const bgClass = urgencyCellClass(urgency);

  const save = () => {
    const prev = toDateInputValue(isoDate);
    if (value === prev) return;
    const fd = new FormData();
    fd.set("teamSlug", teamSlug);
    fd.set("userId", userId);
    fd.set("trainingTypeId", training.id);
    fd.set("lastCompletedAt", value);
    startTransition(async () => {
      await upsertTrainingCompletion(fd);
      router.refresh();
    });
  };

  return (
    <input
      type="date"
      value={value}
      onChange={(e) => setValue(e.target.value)}
      onBlur={save}
      disabled={pending}
      className={`${dateInputClass} ${bgClass} text-center ${value ? "" : "is-empty"}`}
      aria-label={`Dernière formation ${training.name}`}
    />
  );
}

export function FormationsMatrix({ teamSlug, trainings, agents, completions }: Props) {
  const completionMap = useMemo(() => buildCompletionMap(completions), [completions]);
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [trainingToDelete, setTrainingToDelete] = useState<TrainingColumn | null>(null);

  const confirmDeleteTraining = () => {
    if (!trainingToDelete) return;
    const fd = new FormData();
    fd.set("teamSlug", teamSlug);
    fd.set("id", trainingToDelete.id);
    startTransition(async () => {
      await deleteTrainingType(fd);
      setTrainingToDelete(null);
      router.refresh();
    });
  };

  return (
    <section className="w-full rounded-xl border border-zinc-200 bg-white shadow-sm">
      {trainingToDelete ? (
        <DeleteTrainingDialog
          training={trainingToDelete}
          pending={pending}
          onCancel={() => !pending && setTrainingToDelete(null)}
          onConfirm={confirmDeleteTraining}
        />
      ) : null}
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-zinc-100 px-4 py-3">
        <p className="text-xs text-zinc-600">
          Saisissez la date de dernière formation. Les cellules passent en{" "}
          <span className="inline-block rounded bg-orange-100 px-1">orange</span> à moins de 6 mois de
          l&apos;échéance, en <span className="inline-block rounded bg-rose-100 px-1">rouge</span> à moins de 3 mois.
        </p>
      </div>

      <div className="flex w-full justify-center overflow-x-auto p-3 sm:p-4">
        <table className="w-auto table-fixed border-collapse text-left">
          <colgroup>
            <col style={{ width: "9rem" }} />
            {trainings.map((t) => (
              <col key={t.id} style={{ width: "8rem" }} />
            ))}
            <col style={{ width: "3rem" }} />
          </colgroup>
          <thead>
            <tr>
              <th className={`${thClass} ${nameColWidth} sticky left-0 z-10 bg-zinc-50`}>Formation</th>
              {trainings.map((t) => (
                <th key={t.id} className={`${thClass} ${trainingColWidth}`}>
                  <TrainingNameCell
                    teamSlug={teamSlug}
                    training={t}
                    onDelete={() => setTrainingToDelete(t)}
                  />
                </th>
              ))}
              <th className={`${thClass} ${addColWidth} bg-zinc-50`}>
                <AddTrainingColumn teamSlug={teamSlug} disabled={pending} />
              </th>
            </tr>
            <tr>
              <th className={`${thClass} ${nameColWidth} sticky left-0 z-10 bg-zinc-50`}>Récurrence</th>
              {trainings.map((t) => (
                <th key={`rec-${t.id}`} className={`${thClass} ${trainingColWidth}`}>
                  <RecurrenceCell teamSlug={teamSlug} training={t} />
                </th>
              ))}
              <th className={`${thClass} ${addColWidth}`} />
            </tr>
          </thead>
          <tbody>
            {agents.length === 0 ? (
              <tr>
                <td colSpan={trainings.length + 2} className="border border-zinc-200 px-3 py-6 text-center text-sm text-zinc-500">
                  Aucun agent dans cette équipe.
                </td>
              </tr>
            ) : (
              agents.map((agent) => (
                <tr key={agent.id}>
                  <td className={`${tdClass} ${nameColWidth} sticky left-0 z-10 bg-white font-medium`}>
                    {agent.label}
                  </td>
                  {trainings.map((t) => {
                    const iso = completionMap.get(`${agent.id}:${t.id}`) ?? null;
                    return (
                      <td key={`${agent.id}-${t.id}`} className={`${dateTdClass} ${trainingColWidth}`}>
                        <DateCell teamSlug={teamSlug} userId={agent.id} training={t} isoDate={iso} />
                      </td>
                    );
                  })}
                  <td className={`${tdClass} ${addColWidth}`} />
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </section>
  );
}
