"use client";

import { useMemo, useState } from "react";
import { cancelLeaveRequest, createLeaveRequest, updateLeaveRequest } from "./actions";

const LEAVE_REQUEST_TYPES = ["CA", "CF", "CH", "RTT", "REC", "AUTRE"] as const;
type LeaveRequestType = (typeof LEAVE_REQUEST_TYPES)[number];
type LeaveRequestStatus = "PENDING" | "APPROVED" | "REFUSED" | "CANCELLED";

const leaveTypeLabels: Record<LeaveRequestType, string> = {
  CA: "CA",
  CF: "CF",
  CH: "CH",
  RTT: "RTT",
  REC: "REC",
  AUTRE: "Autre",
};

const leaveStatusLabels: Record<LeaveRequestStatus, string> = {
  PENDING: "En attente",
  APPROVED: "Validée",
  REFUSED: "Refusée",
  CANCELLED: "Annulée",
};

const statusClasses: Record<LeaveRequestStatus, string> = {
  PENDING: "bg-[var(--warning-soft)] text-[var(--warning)]",
  APPROVED: "bg-[var(--success-soft)] text-[var(--success)]",
  REFUSED: "bg-[var(--danger-soft)] text-[var(--danger)]",
  CANCELLED: "bg-[#f1f1f1] text-[var(--text-muted)]",
};

const inputClass =
  "min-w-0 w-full rounded-lg border border-[var(--border)] px-2 py-1.5 text-sm text-[var(--text)] placeholder:text-[var(--text-muted)]";

const thClass =
  "pb-1.5 pr-2 text-left align-bottom text-[10px] font-medium uppercase tracking-wide text-[var(--text-muted)]";
const tdClass = "py-1.5 pr-2 align-top text-left text-sm leading-snug text-[var(--text)]";

type SortField = "createdAt" | "startsAt";
type SortDir = "asc" | "desc";

export type AgentLeaveRequestRow = {
  id: string;
  type: LeaveRequestType;
  status: LeaveRequestStatus;
  startsAt: string | Date;
  endsAt: string | Date;
  createdAt: string | Date;
  note: string | null;
  decidedAt: string | Date | null;
  decidedByName: string | null;
  decisionNote: string | null;
  decidedBy: { firstName: string; lastName: string } | null;
};

type Props = {
  teamSlug: string;
  requests: AgentLeaveRequestRow[];
};

function timeValue(value: string | Date | null): number {
  if (!value) return -1;
  const d = value instanceof Date ? value : new Date(value);
  return Number.isNaN(d.getTime()) ? -1 : d.getTime();
}

function formatDate(value: string | Date): string {
  const d = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(d.getTime())) return "—";
  return new Intl.DateTimeFormat("fr-FR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    timeZone: "UTC",
  }).format(d);
}

function formatDateTime(value: string | Date): string {
  const d = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(d.getTime())) return "—";
  return new Intl.DateTimeFormat("fr-FR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(d);
}

function toDateInputValue(value: string | Date): string {
  const d = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(d.getTime())) return "";
  const y = d.getUTCFullYear();
  const m = String(d.getUTCMonth() + 1).padStart(2, "0");
  const day = String(d.getUTCDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function sortRequests(requests: AgentLeaveRequestRow[], field: SortField, dir: SortDir) {
  const sign = dir === "asc" ? 1 : -1;
  return [...requests].sort((a, b) => sign * (timeValue(a[field]) - timeValue(b[field])));
}

function StatusBadge({ status }: { status: LeaveRequestStatus }) {
  return (
    <span className={`inline-block rounded-full px-2 py-0.5 text-[10px] font-medium leading-none ${statusClasses[status]}`}>
      {leaveStatusLabels[status]}
    </span>
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
          active ? "text-[var(--text)]" : "text-[var(--text-muted)] hover:text-[var(--text)]",
        ].join(" ")}
      >
        <span>{label}</span>
        <span className="text-[9px] leading-none" aria-hidden>
          {active ? (sortDir === "asc" ? "▲" : "▼") : "⇅"}
        </span>
      </button>
    </th>
  );
}

function CreateRequestForm({
  teamSlug,
  onCancel,
}: {
  teamSlug: string;
  onCancel: () => void;
}) {
  return (
    <form action={createLeaveRequest} className="space-y-3 rounded-lg border border-dashed border-[var(--border)] bg-[var(--surface-soft)] p-3">
      <input type="hidden" name="teamSlug" value={teamSlug} />
      <table className="w-full table-fixed border-collapse text-sm">
        <tbody>
          <tr>
            <td className="w-[5rem] pr-2 align-top">
              <label className="mb-1 block text-xs font-medium text-[var(--text-muted)]">Type</label>
              <select name="type" defaultValue="CA" className={inputClass}>
                {LEAVE_REQUEST_TYPES.map((type) => (
                  <option key={type} value={type}>
                    {leaveTypeLabels[type]}
                  </option>
                ))}
              </select>
            </td>
            <td className="w-[7rem] pr-2 align-top">
              <label className="mb-1 block text-xs font-medium text-[var(--text-muted)]">Début</label>
              <input type="date" name="startsAt" required className={inputClass} />
            </td>
            <td className="w-[7rem] pr-2 align-top">
              <label className="mb-1 block text-xs font-medium text-[var(--text-muted)]">Fin</label>
              <input type="date" name="endsAt" required className={inputClass} />
            </td>
            <td className="pr-2 align-top">
              <label className="mb-1 block text-xs font-medium text-[var(--text-muted)]">Motif / note</label>
              <input
                type="text"
                name="note"
                placeholder="Optionnel"
                className={inputClass}
              />
            </td>
            <td className="w-[8.5rem] align-top">
              <div className="flex flex-wrap gap-1 pt-5">
                <button
                  type="submit"
                  className="rounded-lg border border-[var(--primary)] bg-[var(--primary)] px-3 py-1.5 text-xs font-medium text-white hover:bg-[var(--primary-hover)]"
                >
                  Envoyer
                </button>
                <button
                  type="button"
                  onClick={onCancel}
                  className="rounded-lg border border-[var(--border)] bg-white px-3 py-1.5 text-xs font-medium text-[var(--text-muted)] hover:bg-[var(--surface-soft)]"
                >
                  Annuler
                </button>
              </div>
            </td>
          </tr>
        </tbody>
      </table>
    </form>
  );
}

function EditRequestForm({
  teamSlug,
  request,
  onCancel,
}: {
  teamSlug: string;
  request: AgentLeaveRequestRow;
  onCancel: () => void;
}) {
  return (
    <form action={updateLeaveRequest} className="space-y-2 rounded-lg border border-[var(--border)] bg-[var(--surface-soft)] p-2">
      <input type="hidden" name="teamSlug" value={teamSlug} />
      <input type="hidden" name="id" value={request.id} />
      <div className="grid gap-2 sm:grid-cols-[5rem_7rem_7rem_1fr_auto] sm:items-end">
        <div>
          <label className="mb-1 block text-xs font-medium text-[var(--text-muted)]">Type</label>
          <select name="type" defaultValue={request.type} className={inputClass}>
            {LEAVE_REQUEST_TYPES.map((type) => (
              <option key={type} value={type}>
                {leaveTypeLabels[type]}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="mb-1 block text-xs font-medium text-[var(--text-muted)]">Début</label>
          <input
            type="date"
            name="startsAt"
            defaultValue={toDateInputValue(request.startsAt)}
            required
            className={inputClass}
          />
        </div>
        <div>
          <label className="mb-1 block text-xs font-medium text-[var(--text-muted)]">Fin</label>
          <input
            type="date"
            name="endsAt"
            defaultValue={toDateInputValue(request.endsAt)}
            required
            className={inputClass}
          />
        </div>
        <div>
          <label className="mb-1 block text-xs font-medium text-[var(--text-muted)]">Note</label>
          <input
            type="text"
            name="note"
            defaultValue={request.note ?? ""}
            placeholder="Optionnel"
            className={inputClass}
          />
        </div>
        <div className="flex flex-wrap gap-1">
          <button
            type="submit"
            className="rounded-lg border border-[var(--primary)] bg-[var(--primary)] px-3 py-1.5 text-xs font-medium text-white hover:bg-[var(--primary-hover)]"
          >
            Enregistrer
          </button>
          <button
            type="button"
            onClick={onCancel}
            className="rounded-lg border border-[var(--border)] bg-white px-3 py-1.5 text-xs font-medium text-[var(--text-muted)]"
          >
            Fermer
          </button>
        </div>
      </div>
    </form>
  );
}

function RequestRows({
  request,
  teamSlug,
  editing,
  onEdit,
  onCancelEdit,
}: {
  request: AgentLeaveRequestRow;
  teamSlug: string;
  editing: boolean;
  onEdit: () => void;
  onCancelEdit: () => void;
}) {
  const isPending = request.status === "PENDING";
  const period = `${formatDate(request.startsAt)} → ${formatDate(request.endsAt)}`;
  const decider =
    request.decidedByName ??
    (request.decidedBy
      ? `${request.decidedBy.lastName.toUpperCase()} ${request.decidedBy.firstName}`
      : null);

  if (editing && isPending) {
    return (
      <tr className="border-b border-[var(--border)]">
        <td colSpan={5} className="py-2">
          <EditRequestForm teamSlug={teamSlug} request={request} onCancel={onCancelEdit} />
        </td>
      </tr>
    );
  }

  return (
    <>
      <tr className="border-b border-[var(--border)]">
        <td className={`${tdClass} font-semibold`}>{leaveTypeLabels[request.type]}</td>
        <td className={tdClass} title={period}>
          <span className="block truncate font-medium">{period}</span>
        </td>
        <td className={`${tdClass} text-[var(--text-muted)]`}>{formatDateTime(request.createdAt)}</td>
        <td className={tdClass}>
          <StatusBadge status={request.status} />
        </td>
        <td className={tdClass}>
          {isPending ? (
            <div className="flex flex-wrap gap-1">
              <button
                type="button"
                onClick={onEdit}
                className="rounded border border-[var(--border)] bg-white px-2 py-0.5 text-[11px] font-medium text-[var(--text)] hover:bg-[var(--surface-soft)]"
              >
                Modifier
              </button>
              <form
                action={cancelLeaveRequest}
                className="inline"
                onSubmit={(e) => {
                  if (!confirm("Annuler cette demande ?")) e.preventDefault();
                }}
              >
                <input type="hidden" name="teamSlug" value={teamSlug} />
                <input type="hidden" name="id" value={request.id} />
                <button
                  type="submit"
                  className="rounded border border-[var(--danger)]/30 bg-[var(--danger-soft)] px-2 py-0.5 text-[11px] font-medium text-[var(--danger)]"
                >
                  Annuler
                </button>
              </form>
            </div>
          ) : (
            <span className="text-[var(--text-muted)]">—</span>
          )}
        </td>
      </tr>
      {(request.note || request.decidedAt) && (
        <tr className="border-b border-[var(--border)]">
          <td className="py-0 pr-2" />
          <td colSpan={3} className="pb-1.5 pr-2 text-left text-xs text-[var(--text-muted)]">
            {request.note ? (
              <p className="truncate" title={request.note}>
                <span className="font-medium">Note :</span> {request.note}
              </p>
            ) : null}
            {request.decidedAt ? (
              <p className={request.note ? "mt-0.5 truncate" : "truncate"}>
                <span className="font-medium">Décision :</span> {formatDateTime(request.decidedAt)}
                {decider ? ` · ${decider}` : ""}
                {request.decisionNote ? ` — ${request.decisionNote}` : ""}
              </p>
            ) : null}
          </td>
          <td className="py-0 pr-2" />
        </tr>
      )}
    </>
  );
}

export function AgentLeaveRequestsSection({ teamSlug, requests }: Props) {
  const [showCreate, setShowCreate] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [sortField, setSortField] = useState<SortField>("createdAt");
  const [sortDir, setSortDir] = useState<SortDir>("desc");

  const sortedRequests = useMemo(
    () => sortRequests(requests, sortField, sortDir),
    [requests, sortField, sortDir],
  );

  function handleSort(field: SortField) {
    if (field === sortField) {
      setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    } else {
      setSortField(field);
      setSortDir("desc");
    }
  }

  return (
    <>
      <section className="mb-6 rounded-xl border border-[var(--border)] bg-white p-3 shadow-sm">
        <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
          <h2 className="text-sm font-semibold text-[var(--text)]">Nouvelle demande</h2>
          {!showCreate ? (
            <button
              type="button"
              onClick={() => {
                setEditingId(null);
                setShowCreate(true);
              }}
              className="rounded-lg border border-[var(--primary)] bg-[var(--primary)] px-3 py-1 text-xs font-medium text-white hover:bg-[var(--primary-hover)]"
            >
              + Nouvelle demande
            </button>
          ) : null}
        </div>
        {showCreate ? (
          <CreateRequestForm teamSlug={teamSlug} onCancel={() => setShowCreate(false)} />
        ) : (
          <p className="text-xs text-[var(--text-muted)]">
            Congés, RTT et autres absences — envoyez une demande à votre cadre.
          </p>
        )}
      </section>

      <section className="rounded-xl border border-[var(--border)] bg-white p-3 shadow-sm">
        <h2 className="mb-2 text-sm font-semibold text-[var(--text)]">
          Mes demandes
          {requests.length > 0 ? (
            <span className="ml-1.5 font-normal text-[var(--text-muted)]">({requests.length})</span>
          ) : null}
        </h2>

        {requests.length === 0 && !showCreate ? (
          <p className="py-4 text-center text-xs text-[var(--text-muted)]">Aucune demande pour le moment.</p>
        ) : requests.length === 0 ? null : (
          <div className="overflow-x-auto rounded-lg border border-[var(--border)] px-2 pt-1">
            <table className="w-full min-w-[36rem] table-fixed border-collapse">
              <colgroup>
                <col className="w-[4.5rem]" />
                <col className="w-[11rem]" />
                <col className="w-[9.5rem]" />
                <col className="w-[5.5rem]" />
                <col className="w-[9rem]" />
              </colgroup>
              <thead>
                <tr className="border-b border-[var(--border)]">
                  <th className={thClass}>Type</th>
                  <SortableTh
                    label="Période"
                    field="startsAt"
                    sortField={sortField}
                    sortDir={sortDir}
                    onSort={handleSort}
                  />
                  <SortableTh
                    label="Déposée"
                    field="createdAt"
                    sortField={sortField}
                    sortDir={sortDir}
                    onSort={handleSort}
                  />
                  <th className={thClass}>Statut</th>
                  <th className={thClass}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {sortedRequests.map((request) => (
                  <RequestRows
                    key={request.id}
                    request={request}
                    teamSlug={teamSlug}
                    editing={editingId === request.id}
                    onEdit={() => {
                      setShowCreate(false);
                      setEditingId(request.id);
                    }}
                    onCancelEdit={() => setEditingId(null)}
                  />
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </>
  );
}
