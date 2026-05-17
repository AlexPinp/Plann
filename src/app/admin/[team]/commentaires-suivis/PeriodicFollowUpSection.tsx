"use client";

import { useMemo, useState } from "react";
import {
  createFollowUpEntry,
  deleteFollowUpEntry,
  updateFollowUpEntry,
} from "./actions";

const inputClass =
  "min-w-0 w-full rounded border border-zinc-300 px-2 py-1 text-xs text-zinc-900 placeholder:text-zinc-400";

const thClass =
  "pb-1.5 pr-2 text-left align-bottom text-[10px] font-medium uppercase tracking-wide text-zinc-400";
const tdClass = "py-1.5 pr-2 align-top text-left text-xs leading-snug text-zinc-900";

type SortField = "lastDate" | "nextDate";
type SortDir = "asc" | "desc";

export type FollowUpEntryRow = {
  id: string;
  subject: string;
  recurrence?: string | null;
  referents?: string | null;
  personnel: string | null;
  lastDate: string | Date | null;
  lastBy: string | null;
  nextDate: string | Date | null;
  nextBy: string | null;
  note: string | null;
};

type Props = {
  teamSlug: string;
  entries: FollowUpEntryRow[];
};

function toDateInputValue(value: string | Date | null): string {
  if (!value) return "";
  const d = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(d.getTime())) return "";
  const y = d.getUTCFullYear();
  const m = String(d.getUTCMonth() + 1).padStart(2, "0");
  const day = String(d.getUTCDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function formatDisplayDate(value: string | Date | null): string {
  if (!value) return "—";
  const d = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(d.getTime())) return "—";
  return new Intl.DateTimeFormat("fr-FR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    timeZone: "UTC",
  }).format(d);
}

function dateSortValue(value: string | Date | null): number {
  if (!value) return -1;
  const d = value instanceof Date ? value : new Date(value);
  return Number.isNaN(d.getTime()) ? -1 : d.getTime();
}

function referentsDisplay(entry: FollowUpEntryRow): string | null {
  return entry.referents ?? entry.lastBy;
}

function compareByDate(
  a: FollowUpEntryRow,
  b: FollowUpEntryRow,
  field: SortField,
): number {
  return dateSortValue(a[field]) - dateSortValue(b[field]);
}

function sortEntries(
  entries: FollowUpEntryRow[],
  field: SortField,
  dir: SortDir,
): FollowUpEntryRow[] {
  const sign = dir === "asc" ? 1 : -1;
  return [...entries].sort((a, b) => sign * compareByDate(a, b, field));
}

function CellText({
  value,
  className = "",
}: {
  value: string | null | undefined;
  className?: string;
}) {
  const text = value?.trim();
  if (!text) {
    return <span className="text-zinc-300">—</span>;
  }
  return (
    <span className={`block truncate ${className}`} title={text}>
      {text}
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
        action={deleteFollowUpEntry}
        className="inline"
        onSubmit={(e) => {
          if (!confirm("Supprimer ce suivi ?")) e.preventDefault();
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

function CompactFollowUpForm({
  teamSlug,
  entry,
  onCancel,
  submitLabel,
  action,
}: {
  teamSlug: string;
  entry?: FollowUpEntryRow;
  onCancel?: () => void;
  submitLabel: string;
  action: typeof createFollowUpEntry | typeof updateFollowUpEntry;
}) {
  return (
    <form action={action} className="space-y-1.5 rounded-lg border border-zinc-200 bg-zinc-50 p-2">
      <input type="hidden" name="teamSlug" value={teamSlug} />
      {entry ? <input type="hidden" name="id" value={entry.id} /> : null}
      <table className="w-full table-fixed border-collapse text-xs">
        <tbody>
          <tr>
            <td className="pr-2 align-top">
              <input
                name="subject"
                required
                defaultValue={entry?.subject ?? ""}
                placeholder="Objet *"
                className={inputClass}
              />
            </td>
            <td className="w-[5.5rem] pr-2 align-top">
              <input
                name="recurrence"
                defaultValue={entry?.recurrence ?? ""}
                placeholder="Récurrence"
                className={inputClass}
              />
            </td>
            <td className="w-[14%] pr-2 align-top">
              <input
                name="referents"
                defaultValue={referentsDisplay(entry ?? ({} as FollowUpEntryRow)) ?? ""}
                placeholder="Référents"
                className={inputClass}
              />
            </td>
            <td className="w-[6.5rem] pr-2 align-top">
              <input
                type="date"
                name="lastDate"
                defaultValue={toDateInputValue(entry?.lastDate ?? null)}
                className={inputClass}
              />
            </td>
            <td className="w-[16%] pr-2 align-top">
              <input
                name="personnel"
                defaultValue={entry?.personnel ?? ""}
                placeholder="Personnel"
                className={inputClass}
              />
            </td>
            <td className="w-[6.5rem] pr-2 align-top">
              <input
                type="date"
                name="nextDate"
                defaultValue={toDateInputValue(entry?.nextDate ?? null)}
                className={inputClass}
              />
            </td>
            <td className="w-[14%] pr-2 align-top">
              <input
                name="nextBy"
                defaultValue={entry?.nextBy ?? ""}
                placeholder="Personnel"
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
        name="note"
        defaultValue={entry?.note ?? ""}
        placeholder="Commentaire (optionnel)"
        className={inputClass}
      />
    </form>
  );
}

function FollowUpRows({
  entry,
  teamSlug,
  editing,
  onEdit,
  onCancelEdit,
}: {
  entry: FollowUpEntryRow;
  teamSlug: string;
  editing: boolean;
  onEdit: () => void;
  onCancelEdit: () => void;
}) {
  if (editing) {
    return (
      <tr className="border-b border-zinc-100">
        <td colSpan={8} className="py-1.5">
          <CompactFollowUpForm
            teamSlug={teamSlug}
            entry={entry}
            onCancel={onCancelEdit}
            submitLabel="OK"
            action={updateFollowUpEntry}
          />
        </td>
      </tr>
    );
  }

  return (
    <>
      <tr className="border-b border-zinc-100">
        <td className={`${tdClass} font-medium`}>
          <CellText value={entry.subject} />
        </td>
        <td className={tdClass}>
          <CellText value={entry.recurrence} className="text-zinc-700" />
        </td>
        <td className={tdClass}>
          <CellText value={referentsDisplay(entry)} className="text-zinc-700" />
        </td>
        <td className={`${tdClass} font-medium text-zinc-800`}>
          {formatDisplayDate(entry.lastDate)}
        </td>
        <td className={`${tdClass} font-medium text-zinc-800`}>
          <CellText value={entry.personnel} />
        </td>
        <td className={`${tdClass} font-medium text-zinc-800`}>
          {formatDisplayDate(entry.nextDate)}
        </td>
        <td className={tdClass}>
          <CellText value={entry.nextBy} className="text-zinc-700" />
        </td>
        <td className={tdClass}>
          <RowActions teamSlug={teamSlug} entryId={entry.id} onEdit={onEdit} />
        </td>
      </tr>
      {entry.note ? (
        <tr className="border-b border-zinc-100">
          <td className="py-0 pr-2" />
          <td colSpan={6} className="truncate pb-1.5 pr-2 text-left text-[11px] text-zinc-600" title={entry.note}>
            {entry.note}
          </td>
          <td className="py-0 pr-2" />
        </tr>
      ) : null}
    </>
  );
}

function FollowUpTable({
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
  entries: FollowUpEntryRow[];
  editingId: string | null;
  sortField: SortField;
  sortDir: SortDir;
  onSort: (field: SortField) => void;
  onEdit: (id: string) => void;
  onCancelEdit: () => void;
}) {
  return (
    <table className="w-full min-w-[52rem] table-fixed border-collapse">
      <colgroup>
        <col />
        <col className="w-[5.5rem]" />
        <col className="w-[13%]" />
        <col className="w-[6.5rem]" />
        <col className="w-[16%]" />
        <col className="w-[6.5rem]" />
        <col className="w-[14%]" />
        <col className="w-[8.5rem]" />
      </colgroup>
      <thead>
        <tr className="border-b border-zinc-200">
          <th className={thClass}>Objet</th>
          <th className={thClass}>Récurrence</th>
          <th className={thClass}>Référents</th>
          <SortableTh
            label="Dernière date"
            field="lastDate"
            sortField={sortField}
            sortDir={sortDir}
            onSort={onSort}
          />
          <th className={thClass}>Personnel</th>
          <SortableTh
            label="Prochaine date"
            field="nextDate"
            sortField={sortField}
            sortDir={sortDir}
            onSort={onSort}
          />
          <th className={thClass}>Personnel</th>
          <th className={thClass}>Actions</th>
        </tr>
      </thead>
      <tbody>
        {entries.map((entry) => (
          <FollowUpRows
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

export function PeriodicFollowUpSection({ teamSlug, entries }: Props) {
  const [showCreate, setShowCreate] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [sortField, setSortField] = useState<SortField>("nextDate");
  const [sortDir, setSortDir] = useState<SortDir>("asc");

  const sortedEntries = useMemo(
    () => sortEntries(entries, sortField, sortDir),
    [entries, sortField, sortDir],
  );

  function handleSort(field: SortField) {
    if (field === sortField) {
      setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    } else {
      setSortField(field);
      setSortDir(field === "nextDate" ? "asc" : "desc");
    }
  }

  return (
    <section className="rounded-xl border border-zinc-200 bg-white p-3 shadow-sm">
      <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-zinc-600">
          Suivi périodique
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
          <CompactFollowUpForm
            teamSlug={teamSlug}
            submitLabel="Ajouter"
            action={createFollowUpEntry}
            onCancel={() => setShowCreate(false)}
          />
        </div>
      ) : null}

      {entries.length === 0 && !showCreate ? (
        <p className="py-2 text-center text-xs text-zinc-500">Aucun suivi pour le moment.</p>
      ) : (
        <div className="overflow-x-auto rounded-lg border border-zinc-200 px-2 pt-1">
          <FollowUpTable
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
