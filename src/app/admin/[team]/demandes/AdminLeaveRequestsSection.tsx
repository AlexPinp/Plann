"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import type { LeaveRequestStatus, LeaveRequestType } from "@/generated/prisma/enums";
import { adminTeamPath } from "@/lib/routes";
import { decideLeaveRequest } from "./actions";

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
  PENDING: "bg-amber-100 text-amber-900",
  APPROVED: "bg-emerald-100 text-emerald-800",
  REFUSED: "bg-rose-100 text-rose-800",
  CANCELLED: "bg-zinc-100 text-zinc-700",
};

const inputClass =
  "min-w-0 w-full rounded border border-zinc-300 px-2 py-1 text-xs text-zinc-900 placeholder:text-zinc-400";

const thClass =
  "pb-1.5 pr-2 text-left align-bottom text-[10px] font-medium uppercase tracking-wide text-zinc-400";
const tdClass = "py-1.5 pr-2 align-top text-left text-xs leading-snug text-zinc-900";

type SortField = "createdAt" | "startsAt" | "status";
type SortDir = "asc" | "desc";

export type LeaveRequestRow = {
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
  user: { firstName: string; lastName: string; email: string };
  decidedBy: { firstName: string; lastName: string } | null;
};

type StatusFilter = LeaveRequestStatus | "ALL";

const STATUS_ORDER: Record<LeaveRequestStatus, number> = {
  PENDING: 0,
  APPROVED: 1,
  REFUSED: 2,
  CANCELLED: 3,
};

const FILTER_OPTIONS: { value: StatusFilter; label: string }[] = [
  { value: "ALL", label: "Toutes" },
  { value: "PENDING", label: "En attente" },
  { value: "APPROVED", label: "Validées" },
  { value: "REFUSED", label: "Refusées" },
  { value: "CANCELLED", label: "Annulées" },
];

type Props = {
  teamSlug: string;
  requests: LeaveRequestRow[];
  statusFilter: StatusFilter;
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

function sortRequests(requests: LeaveRequestRow[], field: SortField, dir: SortDir): LeaveRequestRow[] {
  const sign = dir === "asc" ? 1 : -1;
  return [...requests].sort((a, b) => {
    if (field === "status") {
      return sign * (STATUS_ORDER[a.status] - STATUS_ORDER[b.status]);
    }
    return sign * (timeValue(a[field]) - timeValue(b[field]));
  });
}

function StatusBadge({ status }: { status: LeaveRequestStatus }) {
  return (
    <span className={`inline-block rounded px-1.5 py-0.5 text-[10px] font-medium leading-none ${statusClasses[status]}`}>
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
          active ? "text-zinc-700" : "text-zinc-400 hover:text-zinc-600",
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

function DecideForm({ teamSlug, requestId }: { teamSlug: string; requestId: string }) {
  return (
    <form action={decideLeaveRequest} className="flex min-w-[11rem] flex-col gap-1">
      <input type="hidden" name="teamSlug" value={teamSlug} />
      <input type="hidden" name="id" value={requestId} />
      <input
        type="text"
        name="decisionNote"
        placeholder="Commentaire (optionnel)"
        className={inputClass}
      />
      <div className="flex flex-wrap gap-1">
        <button
          type="submit"
          name="decision"
          value="APPROVED"
          className="rounded border border-emerald-300 bg-emerald-50 px-2 py-0.5 text-[11px] font-medium text-emerald-700 hover:bg-emerald-100"
        >
          Valider
        </button>
        <button
          type="submit"
          name="decision"
          value="REFUSED"
          className="rounded border border-rose-300 bg-rose-50 px-2 py-0.5 text-[11px] font-medium text-rose-700 hover:bg-rose-100"
          onClick={(e) => {
            if (!confirm("Refuser cette demande ?")) e.preventDefault();
          }}
        >
          Refuser
        </button>
      </div>
    </form>
  );
}

function RequestRows({ request, teamSlug }: { request: LeaveRequestRow; teamSlug: string }) {
  const decider =
    request.decidedByName ??
    (request.decidedBy
      ? `${request.decidedBy.lastName.toUpperCase()} ${request.decidedBy.firstName}`
      : null);
  const period = `${formatDate(request.startsAt)} → ${formatDate(request.endsAt)}`;
  const hasDetails = Boolean(request.note?.trim() || request.decidedAt);

  return (
    <>
      <tr className="border-b border-zinc-100">
        <td className={tdClass}>
          <span className="block truncate font-medium text-zinc-900" title={`${request.user.lastName} ${request.user.firstName}`}>
            {request.user.lastName.toUpperCase()} {request.user.firstName}
          </span>
          <span className="block truncate text-[11px] text-zinc-500" title={request.user.email}>
            {request.user.email}
          </span>
        </td>
        <td className={`${tdClass} font-medium text-zinc-800`}>{leaveTypeLabels[request.type]}</td>
        <td className={`${tdClass} font-medium text-zinc-800`} title={period}>
          <span className="block truncate">{period}</span>
        </td>
        <td className={`${tdClass} text-zinc-700`} title={formatDateTime(request.createdAt)}>
          {formatDateTime(request.createdAt)}
        </td>
        <td className={tdClass}>
          <StatusBadge status={request.status} />
        </td>
        <td className={tdClass}>
          {request.status === "PENDING" ? (
            <DecideForm teamSlug={teamSlug} requestId={request.id} />
          ) : (
            <span className="text-zinc-300">—</span>
          )}
        </td>
      </tr>
      {hasDetails ? (
        <tr className="border-b border-zinc-100">
          <td className="py-0 pr-2" />
          <td colSpan={4} className="pb-1.5 pr-2 text-left text-[11px] text-zinc-600">
            {request.note ? (
              <p className="truncate" title={request.note}>
                <span className="font-medium text-zinc-500">Note agent :</span> {request.note}
              </p>
            ) : null}
            {request.decidedAt ? (
              <p className={request.note ? "mt-0.5 truncate" : "truncate"}>
                <span className="font-medium text-zinc-500">Décision :</span> {formatDateTime(request.decidedAt)}
                {decider ? ` · ${decider}` : ""}
                {request.decisionNote ? ` — ${request.decisionNote}` : ""}
              </p>
            ) : request.status !== "PENDING" ? (
              <p className="text-zinc-400">Pas encore traitée</p>
            ) : null}
          </td>
          <td className="py-0 pr-2" />
        </tr>
      ) : null}
    </>
  );
}

function RequestsTable({
  teamSlug,
  requests,
  sortField,
  sortDir,
  onSort,
}: {
  teamSlug: string;
  requests: LeaveRequestRow[];
  sortField: SortField;
  sortDir: SortDir;
  onSort: (field: SortField) => void;
}) {
  return (
    <table className="w-full min-w-[48rem] table-fixed border-collapse">
      <colgroup>
        <col className="w-[18%]" />
        <col className="w-[4.5rem]" />
        <col className="w-[11rem]" />
        <col className="w-[9.5rem]" />
        <col className="w-[5.5rem]" />
        <col className="w-[12rem]" />
      </colgroup>
      <thead>
        <tr className="border-b border-zinc-200">
          <th className={thClass}>Agent</th>
          <th className={thClass}>Type</th>
          <SortableTh label="Période" field="startsAt" sortField={sortField} sortDir={sortDir} onSort={onSort} />
          <SortableTh label="Déposée" field="createdAt" sortField={sortField} sortDir={sortDir} onSort={onSort} />
          <SortableTh label="Statut" field="status" sortField={sortField} sortDir={sortDir} onSort={onSort} />
          <th className={thClass}>Actions</th>
        </tr>
      </thead>
      <tbody>
        {requests.map((request) => (
          <RequestRows key={request.id} request={request} teamSlug={teamSlug} />
        ))}
      </tbody>
    </table>
  );
}

export function AdminLeaveRequestsSection({ teamSlug, requests, statusFilter }: Props) {
  const base = adminTeamPath(teamSlug, "demandes");
  const [sortField, setSortField] = useState<SortField>("createdAt");
  const [sortDir, setSortDir] = useState<SortDir>("desc");

  const sortedRequests = useMemo(
    () => sortRequests(requests, sortField, sortDir),
    [requests, sortField, sortDir],
  );

  const pendingCount = useMemo(() => requests.filter((r) => r.status === "PENDING").length, [requests]);

  function handleSort(field: SortField) {
    if (field === sortField) {
      setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    } else {
      setSortField(field);
      setSortDir(field === "createdAt" || field === "startsAt" ? "desc" : "asc");
    }
  }

  return (
    <section className="rounded-xl border border-zinc-200 bg-white p-3 shadow-sm">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-zinc-600">
          Demandes
          {requests.length > 0 ? (
            <span className="ml-1.5 font-normal normal-case text-zinc-400">
              ({requests.length}
              {pendingCount > 0 ? ` · ${pendingCount} en attente` : ""})
            </span>
          ) : null}
        </h2>
        <nav className="flex flex-wrap gap-1" aria-label="Filtrer par statut">
          {FILTER_OPTIONS.map((opt) => {
            const href = opt.value === "ALL" ? base : `${base}?status=${opt.value}`;
            const active = statusFilter === opt.value;
            return (
              <Link
                key={opt.value}
                href={href}
                className={[
                  "rounded border px-2 py-0.5 text-[11px] font-medium transition",
                  active
                    ? "border-zinc-900 bg-zinc-900 text-white"
                    : "border-zinc-300 bg-white text-zinc-700 hover:bg-zinc-50",
                ].join(" ")}
              >
                {opt.label}
              </Link>
            );
          })}
        </nav>
      </div>

      {requests.length === 0 ? (
        <p className="py-4 text-center text-xs text-zinc-500">Aucune demande pour ce filtre.</p>
      ) : (
        <div className="overflow-x-auto rounded-lg border border-zinc-200 px-2 pt-1">
          <RequestsTable
            teamSlug={teamSlug}
            requests={sortedRequests}
            sortField={sortField}
            sortDir={sortDir}
            onSort={handleSort}
          />
        </div>
      )}
    </section>
  );
}
