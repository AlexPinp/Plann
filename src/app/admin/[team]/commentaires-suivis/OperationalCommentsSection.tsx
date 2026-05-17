"use client";

import { useMemo, useState } from "react";
import {
  createCommentaryEntry,
  deleteCommentaryEntry,
  updateCommentaryEntry,
} from "./actions";

const MONTH_OPTIONS = [
  "JANVIER",
  "FEVRIER",
  "MARS",
  "AVRIL",
  "MAI",
  "JUIN",
  "JUILLET",
  "AOUT",
  "SEPTEMBRE",
  "OCTOBRE",
  "NOVEMBRE",
  "DECEMBRE",
] as const;

const STATUS_OPTIONS = ["TODO", "IN_PROGRESS", "DONE"] as const;
type CommentaryStatus = (typeof STATUS_OPTIONS)[number];

const statusLabels: Record<CommentaryStatus, string> = {
  TODO: "À faire",
  IN_PROGRESS: "En cours",
  DONE: "Fait",
};

const statusClasses: Record<CommentaryStatus, string> = {
  TODO: "bg-rose-100 text-rose-700",
  IN_PROGRESS: "bg-amber-100 text-amber-800",
  DONE: "bg-emerald-100 text-emerald-700",
};

const inputClass =
  "min-w-0 w-full rounded border border-zinc-300 px-2 py-1 text-xs text-zinc-900 placeholder:text-zinc-400";

const thClass =
  "pb-1.5 pr-2 text-left align-bottom text-[10px] font-medium uppercase tracking-wide text-zinc-400";
const tdClass = "py-1.5 pr-2 align-top text-left text-xs leading-snug text-zinc-900";

type SortField = "date" | "status";
type SortDir = "asc" | "desc";

const MONTH_INDEX: Record<string, number> = Object.fromEntries(
  MONTH_OPTIONS.map((m, i) => [m, i]),
) as Record<string, number>;

const STATUS_ORDER: Record<CommentaryStatus, number> = {
  TODO: 0,
  IN_PROGRESS: 1,
  DONE: 2,
};

function monthIndex(monthLabel: string | null): number {
  if (!monthLabel) return -1;
  return MONTH_INDEX[monthLabel.toUpperCase()] ?? -1;
}

function dayFromDatesLabel(datesLabel: string | null): number {
  if (!datesLabel) return -1;
  const match = datesLabel.match(/\d+/);
  return match ? Number.parseInt(match[0], 10) : -1;
}

function compareDate(a: CommentaryEntryRow, b: CommentaryEntryRow): number {
  const ma = monthIndex(a.monthLabel);
  const mb = monthIndex(b.monthLabel);
  if (ma !== mb) return ma - mb;

  const da = dayFromDatesLabel(a.datesLabel);
  const db = dayFromDatesLabel(b.datesLabel);
  if (da !== db) return da - db;

  return (a.datesLabel ?? "").localeCompare(b.datesLabel ?? "", "fr");
}

function compareStatus(a: CommentaryEntryRow, b: CommentaryEntryRow): number {
  const sa = STATUS_ORDER[a.status as CommentaryStatus] ?? 99;
  const sb = STATUS_ORDER[b.status as CommentaryStatus] ?? 99;
  return sa - sb;
}

function sortEntries(
  entries: CommentaryEntryRow[],
  field: SortField,
  dir: SortDir,
): CommentaryEntryRow[] {
  const sign = dir === "asc" ? 1 : -1;
  return [...entries].sort((a, b) => sign * (field === "date" ? compareDate(a, b) : compareStatus(a, b)));
}

function defaultDirForField(field: SortField): SortDir {
  return field === "date" ? "desc" : "asc";
}

export type CommentaryEntryRow = {
  id: string;
  monthLabel: string | null;
  datesLabel: string | null;
  subject: string;
  personnel: string | null;
  trainer: string | null;
  comment: string | null;
  status: string;
};

type Props = {
  teamSlug: string;
  entries: CommentaryEntryRow[];
};

function formatMonthLabel(month: string | null): string | null {
  if (!month) return null;
  return month.charAt(0) + month.slice(1).toLowerCase();
}

function dateDisplay(monthLabel: string | null, datesLabel: string | null): string {
  const month = formatMonthLabel(monthLabel);
  if (month && datesLabel) return `${month} · ${datesLabel}`;
  return month ?? datesLabel ?? "—";
}

function StatusBadge({ status }: { status: string }) {
  const s = status as CommentaryStatus;
  return (
    <span
      className={`inline-block rounded px-1.5 py-0.5 text-[10px] font-medium leading-none ${statusClasses[s] ?? "bg-zinc-100 text-zinc-700"}`}
    >
      {statusLabels[s] ?? status}
    </span>
  );
}

function RowActions({
  teamSlug,
  entryId,
  onEdit,
}: {
  teamSlug: string;
  entryId: string;
  onEdit: () => void;
}) {
  return (
    <div className="flex flex-wrap items-start justify-start gap-1 whitespace-nowrap">
      <button
        type="button"
        onClick={onEdit}
        className="rounded border border-zinc-300 bg-white px-1.5 py-0.5 text-[11px] font-medium text-zinc-700 hover:bg-zinc-50"
      >
        Modifier
      </button>
      <form
        action={deleteCommentaryEntry}
        className="inline"
        onSubmit={(e) => {
          if (!confirm("Supprimer ce commentaire ?")) e.preventDefault();
        }}
      >
        <input type="hidden" name="teamSlug" value={teamSlug} />
        <input type="hidden" name="id" value={entryId} />
        <button
          type="submit"
          className="rounded border border-rose-200 bg-rose-50 px-1.5 py-0.5 text-[11px] font-medium text-rose-700 hover:bg-rose-100"
        >
          Suppr.
        </button>
      </form>
    </div>
  );
}

function CompactCommentaryForm({
  teamSlug,
  entry,
  onCancel,
  submitLabel,
  action,
}: {
  teamSlug: string;
  entry?: CommentaryEntryRow;
  onCancel?: () => void;
  submitLabel: string;
  action: typeof createCommentaryEntry | typeof updateCommentaryEntry;
}) {
  return (
    <form action={action} className="space-y-1.5 rounded-lg border border-zinc-200 bg-zinc-50 p-2">
      <input type="hidden" name="teamSlug" value={teamSlug} />
      {entry ? <input type="hidden" name="id" value={entry.id} /> : null}
      <table className="w-full table-fixed border-collapse text-xs">
        <tbody>
          <tr>
            <td className="w-[5.25rem] pr-2 align-top">
              <select name="status" defaultValue={entry?.status ?? "TODO"} className={inputClass} title="État">
                {STATUS_OPTIONS.map((status) => (
                  <option key={status} value={status}>
                    {statusLabels[status]}
                  </option>
                ))}
              </select>
            </td>
            <td className="w-[7rem] pr-2 align-top">
              <div className="flex flex-col gap-0.5">
                <select name="monthLabel" defaultValue={entry?.monthLabel ?? ""} className={inputClass} title="Mois">
                  <option value="">Mois</option>
                  {MONTH_OPTIONS.map((m) => (
                    <option key={m} value={m}>
                      {formatMonthLabel(m)}
                    </option>
                  ))}
                </select>
                <input
                  name="datesLabel"
                  defaultValue={entry?.datesLabel ?? ""}
                  placeholder="Date(s)"
                  className={inputClass}
                />
              </div>
            </td>
            <td className="pr-2 align-top">
              <input
                name="subject"
                required
                defaultValue={entry?.subject ?? ""}
                placeholder="Objet *"
                className={inputClass}
              />
            </td>
            <td className="w-[24%] pr-2 align-top">
              <input
                name="personnel"
                defaultValue={entry?.personnel ?? ""}
                placeholder="Personnel"
                className={inputClass}
              />
            </td>
            <td className="w-[16%] pr-2 align-top">
              <input
                name="trainer"
                defaultValue={entry?.trainer ?? ""}
                placeholder="Formateur"
                className={inputClass}
              />
            </td>
            <td className="w-[8.5rem] align-top">
              <div className="flex flex-wrap gap-1">
                <button
                  type="submit"
                  className="rounded bg-zinc-900 px-2 py-1 text-[11px] font-medium text-white hover:bg-zinc-800"
                >
                  {submitLabel}
                </button>
                {onCancel ? (
                  <button
                    type="button"
                    onClick={onCancel}
                    className="rounded border border-zinc-300 bg-white px-2 py-1 text-[11px] font-medium text-zinc-600 hover:bg-zinc-50"
                  >
                    Annuler
                  </button>
                ) : null}
              </div>
            </td>
          </tr>
        </tbody>
      </table>
      <input
        name="comment"
        defaultValue={entry?.comment ?? ""}
        placeholder="Commentaire"
        className={inputClass}
      />
    </form>
  );
}

function CommentaryRows({
  entry,
  teamSlug,
  editing,
  onEdit,
  onCancelEdit,
}: {
  entry: CommentaryEntryRow;
  teamSlug: string;
  editing: boolean;
  onEdit: () => void;
  onCancelEdit: () => void;
}) {
  if (editing) {
    return (
      <tr className="border-b border-zinc-100">
        <td colSpan={6} className="py-1.5">
          <CompactCommentaryForm
            teamSlug={teamSlug}
            entry={entry}
            onCancel={onCancelEdit}
            submitLabel="OK"
            action={updateCommentaryEntry}
          />
        </td>
      </tr>
    );
  }

  const date = dateDisplay(entry.monthLabel, entry.datesLabel);

  return (
    <>
      <tr className="border-b border-zinc-100">
        <td className={tdClass}>
          <StatusBadge status={entry.status} />
        </td>
        <td className={`${tdClass} font-medium text-zinc-800`} title={date}>
          <span className="block truncate">{date}</span>
        </td>
        <td className={`${tdClass} font-medium`} title={entry.subject}>
          <span className="block truncate">{entry.subject}</span>
        </td>
        <td className={`${tdClass} font-medium text-zinc-800`} title={entry.personnel ?? undefined}>
          <span className="block truncate">{entry.personnel ?? <span className="font-normal text-zinc-300">—</span>}</span>
        </td>
        <td className={`${tdClass} text-zinc-600`} title={entry.trainer ?? undefined}>
          <span className="block truncate">{entry.trainer ?? <span className="text-zinc-300">—</span>}</span>
        </td>
        <td className={tdClass}>
          <RowActions teamSlug={teamSlug} entryId={entry.id} onEdit={onEdit} />
        </td>
      </tr>
      {entry.comment ? (
        <tr className="border-b border-zinc-100">
          <td className="py-0 pr-2" />
          <td colSpan={4} className="truncate pb-1.5 pr-2 text-left text-[11px] text-zinc-600" title={entry.comment}>
            {entry.comment}
          </td>
          <td className="py-0 pr-2" />
        </tr>
      ) : null}
    </>
  );
}

function SortableTh({
  label,
  field,
  sortField,
  sortDir,
  onSort,
}: {
  label: string;
  field: SortField;
  sortField: SortField;
  sortDir: SortDir;
  onSort: (field: SortField) => void;
}) {
  const active = sortField === field;
  return (
    <th className={thClass} aria-sort={active ? (sortDir === "asc" ? "ascending" : "descending") : "none"}>
      <button
        type="button"
        onClick={() => onSort(field)}
        className={[
          "inline-flex items-center gap-0.5 rounded-sm text-left transition",
          active ? "text-zinc-700" : "text-zinc-400 hover:text-zinc-600",
        ].join(" ")}
        title={active ? `Tri ${sortDir === "asc" ? "croissant" : "décroissant"}` : `Trier par ${label.toLowerCase()}`}
      >
        <span>{label}</span>
        <span className="text-[9px] leading-none" aria-hidden>
          {active ? (sortDir === "asc" ? "▲" : "▼") : "⇅"}
        </span>
      </button>
    </th>
  );
}

function CommentsTable({
  teamSlug,
  entries,
  editingId,
  sortField,
  sortDir,
  onSort,
  onEdit,
  onCancelEdit,
}: {
  teamSlug: string;
  entries: CommentaryEntryRow[];
  editingId: string | null;
  sortField: SortField;
  sortDir: SortDir;
  onSort: (field: SortField) => void;
  onEdit: (id: string) => void;
  onCancelEdit: () => void;
}) {
  return (
    <table className="w-full min-w-[40rem] table-fixed border-collapse">
      <colgroup>
        <col className="w-[5.25rem]" />
        <col className="w-[7rem]" />
        <col />
        <col className="w-[24%]" />
        <col className="w-[16%]" />
        <col className="w-[8.5rem]" />
      </colgroup>
      <thead>
        <tr className="border-b border-zinc-200">
          <SortableTh label="État" field="status" sortField={sortField} sortDir={sortDir} onSort={onSort} />
          <SortableTh label="Date" field="date" sortField={sortField} sortDir={sortDir} onSort={onSort} />
          <th className={thClass}>Objet</th>
          <th className={thClass}>Personnel</th>
          <th className={thClass}>Formateur</th>
          <th className={thClass}>Actions</th>
        </tr>
      </thead>
      <tbody>
        {entries.map((entry) => (
          <CommentaryRows
            key={entry.id}
            entry={entry}
            teamSlug={teamSlug}
            editing={editingId === entry.id}
            onEdit={() => onEdit(entry.id)}
            onCancelEdit={onCancelEdit}
          />
        ))}
      </tbody>
    </table>
  );
}

export function OperationalCommentsSection({ teamSlug, entries }: Props) {
  const [showCreate, setShowCreate] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [sortField, setSortField] = useState<SortField>("date");
  const [sortDir, setSortDir] = useState<SortDir>("desc");

  const sortedEntries = useMemo(
    () => sortEntries(entries, sortField, sortDir),
    [entries, sortField, sortDir],
  );

  function handleSort(field: SortField) {
    if (field === sortField) {
      setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    } else {
      setSortField(field);
      setSortDir(defaultDirForField(field));
    }
  }

  return (
    <section className="mb-8 rounded-xl border border-zinc-200 bg-white p-3 shadow-sm">
      <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-zinc-600">
          Commentaires opérationnels
          {entries.length > 0 ? (
            <span className="ml-1.5 font-normal normal-case text-zinc-400">({entries.length})</span>
          ) : null}
        </h2>
        {!showCreate ? (
          <button
            type="button"
            onClick={() => {
              setEditingId(null);
              setShowCreate(true);
            }}
            className="rounded border border-zinc-300 bg-white px-2 py-0.5 text-[11px] font-medium text-zinc-800 hover:bg-zinc-50"
          >
            + Ajouter
          </button>
        ) : null}
      </div>

      {showCreate ? (
        <div className="mb-2 overflow-x-auto">
          <CompactCommentaryForm
            teamSlug={teamSlug}
            submitLabel="Ajouter"
            action={createCommentaryEntry}
            onCancel={() => setShowCreate(false)}
          />
        </div>
      ) : null}

      {entries.length === 0 && !showCreate ? (
        <p className="py-2 text-center text-xs text-zinc-500">Aucun commentaire.</p>
      ) : (
        <div className="overflow-x-auto rounded-lg border border-zinc-200 px-2 pt-1">
          <CommentsTable
            teamSlug={teamSlug}
            entries={sortedEntries}
            editingId={editingId}
            sortField={sortField}
            sortDir={sortDir}
            onSort={handleSort}
            onEdit={(id) => {
              setShowCreate(false);
              setEditingId(id);
            }}
            onCancelEdit={() => setEditingId(null)}
          />
        </div>
      )}
    </section>
  );
}
