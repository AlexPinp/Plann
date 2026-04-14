"use client";

import { Fragment, useEffect, useMemo, useRef, useState } from "react";
import { format } from "date-fns";
import { fr } from "date-fns/locale";
import { addPlanningComment, deletePlanningComment, setPlanningCell } from "./actions";
import {
  PLANNING_COMMENT_STATUSES,
  PLANNING_COMMENT_TYPES,
  PLANNING_COMMENT_VISIBILITIES,
  planningCommentStatusLabel,
  planningCommentTypeBadge,
  planningCommentTypeLabel,
  planningCommentVisibilityLabel,
  type PlanningCommentStatus,
  type PlanningCommentType,
  type PlanningCommentVisibility,
} from "@/lib/planning-comments";

export type DayCol = { key: string; dayNum: number; dow: string };

export type UserRow = { id: string; displayName: string };

export type GroupBlock = { label: string; color: string; users: UserRow[] };

export type ShiftOption = { id: string; code: string; color: string; label: string };
type PlanningCommentItem = {
  id: string;
  type: string;
  status: string;
  visibility: string;
  text: string;
  createdAtIso: string;
  createdByName: string;
};

type Props = {
  monthLabel: string;
  days: DayCol[];
  groups: GroupBlock[];
  shifts: ShiftOption[];
  /** `${userId}|${yyyy-MM-dd}` -> shiftTypeId */
  cellShiftByKey: Record<string, string>;
  /** `${userId}|${yyyy-MM-dd}` -> shiftTypeId (issu de la trame) */
  templateShiftByUserAndDate: Record<string, string>;
  /** `${userId}|${yyyy-MM-dd}` -> commentaires */
  commentsByKey: Record<string, PlanningCommentItem[]>;
};

const SYNTH_ORDER = [
  "JD1",
  "JD2",
  "JCD",
  "JM1",
  "JM2",
  "JM3",
  "JM4",
  "JH1",
  "JH2",
  "CA",
  "CP",
  "RTT",
  "NA",
  "N",
  "CSSU",
  "H",
  "RII",
  "RCJ",
  "JG1",
  "JG2",
  "RPJ",
  "JT",
  "mc",
  "M",
  "A",
];

type SectorRule = {
  code: string;
  requiredOnDay: (isWeekendOrHoliday: boolean) => number | null;
};

const SECTOR_RULES: SectorRule[] = [
  { code: "JM1", requiredOnDay: () => 1 },
  { code: "JM2", requiredOnDay: () => 1 },
  { code: "JM3", requiredOnDay: () => 1 },
  { code: "JM4", requiredOnDay: () => 1 },
  { code: "JO1", requiredOnDay: () => 1 },
  { code: "JO2", requiredOnDay: () => 1 },
  { code: "JCD", requiredOnDay: (isWeekendOrHoliday) => (isWeekendOrHoliday ? 0 : 1) },
  { code: "JS", requiredOnDay: () => 1 },
  { code: "JG1", requiredOnDay: () => 1 },
  { code: "JG2", requiredOnDay: () => 1 },
  { code: "JH1", requiredOnDay: () => 1 },
  { code: "JH2", requiredOnDay: () => 1 },
  { code: "RPJ", requiredOnDay: (isWeekendOrHoliday) => (isWeekendOrHoliday ? 0 : null) },
];

function easterSundayUtc(year: number): Date {
  const a = year % 19;
  const b = Math.floor(year / 100);
  const c = year % 100;
  const d = Math.floor(b / 4);
  const e = b % 4;
  const f = Math.floor((b + 8) / 25);
  const g = Math.floor((b - f + 1) / 3);
  const h = (19 * a + b - d - g + 15) % 30;
  const i = Math.floor(c / 4);
  const k = c % 4;
  const l = (32 + 2 * e + 2 * i - h - k) % 7;
  const m = Math.floor((a + 11 * h + 22 * l) / 451);
  const month = Math.floor((h + l - 7 * m + 114) / 31);
  const day = ((h + l - 7 * m + 114) % 31) + 1;
  return new Date(Date.UTC(year, month - 1, day, 12, 0, 0));
}

function dateKeyFromDateUtc(date: Date): string {
  return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, "0")}-${String(
    date.getUTCDate(),
  ).padStart(2, "0")}`;
}

function frenchHolidaysForYear(year: number): Set<string> {
  const fixed = [
    `${year}-01-01`,
    `${year}-05-01`,
    `${year}-05-08`,
    `${year}-07-14`,
    `${year}-08-15`,
    `${year}-11-01`,
    `${year}-11-11`,
    `${year}-12-25`,
  ];

  const easter = easterSundayUtc(year);
  const easterMonday = new Date(easter);
  easterMonday.setUTCDate(easterMonday.getUTCDate() + 1);
  const ascension = new Date(easter);
  ascension.setUTCDate(ascension.getUTCDate() + 39);
  const pentecostMonday = new Date(easter);
  pentecostMonday.setUTCDate(pentecostMonday.getUTCDate() + 50);

  return new Set<string>([
    ...fixed,
    dateKeyFromDateUtc(easterMonday),
    dateKeyFromDateUtc(ascension),
    dateKeyFromDateUtc(pentecostMonday),
  ]);
}

function orderedLegendShifts(shifts: ShiftOption[]): ShiftOption[] {
  const byCode = new Map(shifts.map((s) => [s.code, s]));
  const ordered: ShiftOption[] = [];
  for (const code of SYNTH_ORDER) {
    const s = byCode.get(code);
    if (s) ordered.push(s);
  }
  const rest = shifts.filter((s) => !SYNTH_ORDER.includes(s.code)).sort((a, b) => a.code.localeCompare(b.code));
  return [...ordered, ...rest];
}

function stableSerializeCells(cells: Record<string, string>): string {
  const keys = Object.keys(cells).sort();
  return keys.map((k) => `${k}:${cells[k]}`).join("|");
}

export function PlanningMonthGrid({
  monthLabel,
  days,
  groups,
  shifts,
  cellShiftByKey,
  templateShiftByUserAndDate,
  commentsByKey,
}: Props) {
  const [localCells, setLocalCells] = useState<Record<string, string>>({});
  const prevDataSignature = useRef("");
  const [selectedCommentCell, setSelectedCommentCell] = useState<{
    key: string;
    userId: string;
    userName: string;
    date: string;
  } | null>(null);

  const serverDataSignature = useMemo(
    () => `${monthLabel}|${stableSerializeCells(cellShiftByKey)}`,
    [monthLabel, cellShiftByKey],
  );

  useEffect(() => {
    if (serverDataSignature === prevDataSignature.current) return;
    prevDataSignature.current = serverDataSignature;
    queueMicrotask(() => {
      setLocalCells({});
    });
  }, [serverDataSignature]);

  const legend = useMemo(() => orderedLegendShifts(shifts), [shifts]);

  const allUsers = useMemo(() => groups.flatMap((g) => g.users), [groups]);

  const shiftValueForCell = (k: string): string => {
    const local = localCells[k];
    if (local !== undefined) return local;
    return cellShiftByKey[k] ?? templateShiftByUserAndDate[k] ?? "";
  };
  const commentsForCell = (k: string): PlanningCommentItem[] => commentsByKey[k] ?? [];

  const totalsByUserAndCode = useMemo(() => {
    const map: Record<string, Record<string, number>> = {};
    const idByCode = new Map(shifts.map((s) => [s.id, s.code]));
    for (const u of allUsers) {
      map[u.id] = {};
      for (const s of legend) {
        map[u.id][s.code] = 0;
      }
    }
    for (const u of allUsers) {
      for (const d of days) {
        const key = `${u.id}|${d.key}`;
        const shiftId = cellShiftByKey[key] ?? templateShiftByUserAndDate[key];
        if (!shiftId) continue;
        const code = idByCode.get(shiftId);
        if (!code || !map[u.id]) continue;
        if (!map[u.id][code]) map[u.id][code] = 0;
        map[u.id][code] += 1;
      }
    }
    return map;
  }, [allUsers, cellShiftByKey, days, legend, shifts, templateShiftByUserAndDate]);

  const sectorCoverageRows = useMemo(() => {
    const idByCode = new Map(shifts.map((s) => [s.id, s.code]));
    const yearFromMonth = Number(days[0]?.key.slice(0, 4) ?? "0");
    const holidays = yearFromMonth > 0 ? frenchHolidaysForYear(yearFromMonth) : new Set<string>();

    const activeRules = SECTOR_RULES.filter((rule) => shifts.some((s) => s.code === rule.code));
    return activeRules.map((rule) => {
      const counts = days.map(() => 0);
      days.forEach((d, dayIdx) => {
        for (const u of allUsers) {
          const sid = cellShiftByKey[`${u.id}|${d.key}`] ?? templateShiftByUserAndDate[`${u.id}|${d.key}`];
          if (!sid) continue;
          const code = idByCode.get(sid);
          if (code === rule.code) counts[dayIdx] += 1;
        }
      });

      const checks = days.map((d, dayIdx) => {
        const date = new Date(`${d.key}T12:00:00.000Z`);
        const isWeekend = date.getUTCDay() === 0 || date.getUTCDay() === 6;
        const isHoliday = holidays.has(d.key);
        const isWeekendOrHoliday = isWeekend || isHoliday;
        const required = rule.requiredOnDay(isWeekendOrHoliday);
        const count = counts[dayIdx];
        return {
          count,
          required,
          isWeekendOrHoliday,
          isWarning:
            required === null
              ? false
              : required === 0
                ? count > 0
                : count < required,
        };
      });
      return { code: rule.code, checks };
    });
  }, [allUsers, cellShiftByKey, days, shifts, templateShiftByUserAndDate]);

  const weekendOrHolidayByDayKey = useMemo(() => {
    const yearFromMonth = Number(days[0]?.key.slice(0, 4) ?? "0");
    const holidays = yearFromMonth > 0 ? frenchHolidaysForYear(yearFromMonth) : new Set<string>();
    const map: Record<string, boolean> = {};
    for (const d of days) {
      const date = new Date(`${d.key}T12:00:00.000Z`);
      const isWeekend = date.getUTCDay() === 0 || date.getUTCDay() === 6;
      map[d.key] = isWeekend || holidays.has(d.key);
    }
    return map;
  }, [days]);

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-end gap-3 rounded-lg border border-zinc-200 bg-zinc-50 p-3">
        <div>
          <p className="text-xs font-medium text-zinc-500">Légende codes</p>
          <p className="text-sm font-semibold text-zinc-800">{monthLabel}</p>
        </div>
        <div className="flex flex-wrap gap-1.5">
          {legend.map((s) => (
            <span
              key={s.id}
              className="inline-flex items-center gap-1 rounded border border-zinc-300 px-1.5 py-0.5 text-[11px] font-semibold text-zinc-900 shadow-sm"
              style={{ backgroundColor: s.color }}
              title={s.label}
            >
              {s.code}
            </span>
          ))}
        </div>
      </div>

      <div className="max-h-[85vh] overflow-auto rounded-lg border border-zinc-300 bg-white shadow-sm">
        <table className="min-w-max border-collapse text-[11px]">
          <thead>
            <tr className="bg-zinc-100">
              <th
                rowSpan={2}
                className="sticky left-0 top-0 z-40 min-w-[140px] border border-zinc-300 bg-zinc-100 px-2 py-1 text-left font-semibold text-zinc-800"
              >
                Agent
              </th>
              {days.map((d) => (
                <th
                  key={`dow-${d.key}`}
                  className={[
                    "sticky top-0 z-30 min-w-[36px] border border-zinc-300 px-0.5 py-1 text-center font-semibold",
                    weekendOrHolidayByDayKey[d.key] ? "bg-zinc-300 text-zinc-700" : "bg-zinc-100 text-zinc-700",
                  ].join(" ")}
                >
                  {d.dow}
                </th>
              ))}
              <th
                colSpan={legend.length}
                className="sticky top-0 z-30 border border-zinc-300 bg-zinc-200 px-2 py-1 text-center text-xs font-semibold text-zinc-800"
              >
                Synthèse (compte par code)
              </th>
            </tr>
            <tr className="bg-zinc-50">
              {days.map((d) => (
                <th
                  key={`num-${d.key}`}
                  className={[
                    "sticky top-[28px] z-30 border border-zinc-300 px-0.5 py-1 text-center font-medium text-zinc-800",
                    weekendOrHolidayByDayKey[d.key] ? "bg-zinc-300" : "bg-zinc-50",
                  ].join(" ")}
                >
                  {d.dayNum}
                </th>
              ))}
              {legend.map((s) => (
                <th
                  key={`leg-${s.code}`}
                  className="sticky top-[28px] z-30 min-w-[28px] border border-zinc-300 px-0.5 py-1 text-center font-semibold text-zinc-700"
                  style={{ backgroundColor: s.color }}
                >
                  {s.code}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {groups.map((group) => (
              <Fragment key={group.label}>
                <tr className="bg-zinc-200">
                  <td
                    colSpan={days.length + legend.length + 1}
                    className="sticky left-0 z-20 border border-zinc-300 px-2 py-1 font-semibold text-zinc-800"
                    style={{ backgroundColor: group.color }}
                  >
                    {group.label}
                  </td>
                </tr>
                {group.users.map((u) => (
                  <tr key={u.id} className="hover:bg-zinc-50/80">
                    <td
                      className="sticky left-0 z-20 whitespace-nowrap border border-zinc-200 px-2 py-0 font-medium text-zinc-900"
                      style={{ backgroundColor: group.color }}
                    >
                      {u.displayName}
                    </td>
                    {days.map((d) => {
                      const k = `${u.id}|${d.key}`;
                      const displayId = shiftValueForCell(k);
                      const cellComments = commentsForCell(k);
                      const firstType = cellComments[0]?.type as PlanningCommentType | undefined;
                      return (
                        <td key={k} className="border border-zinc-200 p-0 align-middle">
                          <div className="flex min-w-[36px] flex-col">
                            <form action={setPlanningCell} className="m-0">
                              <input type="hidden" name="userId" value={u.id} />
                              <input type="hidden" name="date" value={d.key} />
                              <select
                                name="shiftTypeId"
                                value={displayId}
                                className="h-7 w-full cursor-pointer appearance-none border-0 bg-transparent px-0 py-0 text-center text-[10px] font-bold text-zinc-900 outline-none focus:ring-1 focus:ring-zinc-400"
                                style={{
                                  backgroundColor: displayId
                                    ? (shifts.find((s) => s.id === displayId)?.color ?? "#fff")
                                    : "#fafafa",
                                }}
                                onChange={(e) => {
                                  const v = e.target.value;
                                  setLocalCells((prev) => ({ ...prev, [k]: v }));
                                  e.currentTarget.form?.requestSubmit();
                                }}
                              >
                                <option value=""> </option>
                                {shifts.map((s) => (
                                  <option key={s.id} value={s.id}>
                                    {s.code}
                                  </option>
                                ))}
                              </select>
                            </form>
                            <button
                              type="button"
                              className={[
                                "inline-flex h-4 w-full items-center justify-center border-t border-zinc-300 text-[9px] font-semibold leading-none",
                                cellComments.length > 0
                                  ? "bg-sky-100 text-sky-700 hover:bg-sky-200"
                                  : "bg-white text-zinc-500 hover:bg-zinc-100",
                              ].join(" ")}
                              title={
                                cellComments.length > 0
                                  ? `${cellComments.length} commentaire(s)`
                                  : "Ajouter un commentaire"
                              }
                              onClick={() =>
                                setSelectedCommentCell({
                                  key: k,
                                  userId: u.id,
                                  userName: u.displayName,
                                  date: d.key,
                                })
                              }
                            >
                              {cellComments.length > 0
                                ? `${firstType ? planningCommentTypeBadge(firstType) : "CM"}${cellComments.length > 1 ? `+${cellComments.length - 1}` : ""}`
                                : "+"}
                            </button>
                          </div>
                        </td>
                      );
                    })}
                    {legend.map((s) => (
                      <td
                        key={`${u.id}-${s.code}`}
                        className="border border-zinc-200 bg-white px-0.5 py-0.5 text-center tabular-nums text-zinc-800"
                      >
                        {totalsByUserAndCode[u.id]?.[s.code] ?? 0}
                      </td>
                    ))}
                  </tr>
                ))}
              </Fragment>
            ))}
            {sectorCoverageRows.length > 0 ? (
              <tr className="bg-indigo-50/80">
                <td
                  colSpan={days.length + legend.length + 1}
                  className="sticky left-0 z-20 border border-zinc-300 bg-indigo-100 px-2 py-0.5 text-[10px] font-semibold text-indigo-900"
                >
                  Couverture secteurs
                </td>
              </tr>
            ) : null}
            {sectorCoverageRows.map((row) => (
              <tr key={`sector-${row.code}`} className="bg-white">
                <td className="sticky left-0 z-20 border border-zinc-300 bg-indigo-50 px-2 py-0.5 text-[10px] font-semibold text-indigo-900">
                  {row.code}
                </td>
                {row.checks.map((check, idx) => (
                  <td
                    key={`sector-${row.code}-${days[idx].key}`}
                    className={[
                      "border border-zinc-300 px-0.5 py-0.5 text-center tabular-nums text-[10px]",
                      check.isWarning ? "bg-rose-100 font-semibold text-rose-800" : "text-zinc-800",
                    ].join(" ")}
                    title={
                      check.required === null
                        ? `${row.code}: ${check.count} affectation(s) — pas de minimum imposé`
                        : `${row.code}: ${check.count}/${check.required}`
                    }
                  >
                    {check.count}
                    {check.isWarning ? " !" : ""}
                  </td>
                ))}
                <td colSpan={legend.length} className="border border-zinc-300 bg-indigo-50/50" />
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {selectedCommentCell ? (
        <aside className="rounded-lg border border-zinc-300 bg-white p-3 shadow-sm">
          <div className="mb-3 flex items-start justify-between gap-2">
            <div>
              <h2 className="text-sm font-semibold text-zinc-900">Commentaires du jour</h2>
              <p className="text-xs text-zinc-600">
                {selectedCommentCell.userName} - {format(new Date(`${selectedCommentCell.date}T12:00:00.000Z`), "dd MMMM yyyy", { locale: fr })}
              </p>
            </div>
            <button
              type="button"
              className="rounded border border-zinc-300 px-2 py-0.5 text-xs text-zinc-600 hover:bg-zinc-50"
              onClick={() => setSelectedCommentCell(null)}
            >
              Fermer
            </button>
          </div>

          <div className="space-y-2">
            {commentsForCell(selectedCommentCell.key).length === 0 ? (
              <p className="rounded border border-dashed border-zinc-300 bg-zinc-50 px-2 py-1 text-xs text-zinc-500">
                Aucun commentaire pour ce jour.
              </p>
            ) : (
              commentsForCell(selectedCommentCell.key).map((comment) => (
                <div key={comment.id} className="rounded border border-zinc-200 bg-zinc-50 p-2 text-xs text-zinc-700">
                  <div className="flex items-start justify-between gap-2">
                    <div className="font-semibold text-zinc-900">
                      {planningCommentTypeLabel(comment.type as PlanningCommentType)} -{" "}
                      {planningCommentStatusLabel(comment.status as PlanningCommentStatus)}
                    </div>
                    <form action={deletePlanningComment}>
                      <input type="hidden" name="commentId" value={comment.id} />
                      <button
                        type="submit"
                        className="rounded border border-rose-300 bg-rose-50 px-1.5 py-0.5 text-[10px] font-medium text-rose-700 hover:bg-rose-100"
                      >
                        Suppr.
                      </button>
                    </form>
                  </div>
                  <p className="mt-1 whitespace-pre-wrap text-zinc-800">{comment.text}</p>
                  <p className="mt-1 text-[10px] text-zinc-500">
                    {planningCommentVisibilityLabel(comment.visibility as PlanningCommentVisibility)} -{" "}
                    {format(new Date(comment.createdAtIso), "dd/MM/yyyy HH:mm")} - {comment.createdByName}
                  </p>
                </div>
              ))
            )}
          </div>

          <form action={addPlanningComment} className="mt-3 grid gap-2 rounded border border-zinc-200 bg-white p-2">
            <input type="hidden" name="userId" value={selectedCommentCell.userId} />
            <input type="hidden" name="date" value={selectedCommentCell.date} />
            <div className="grid grid-cols-3 gap-2">
              <select name="type" defaultValue="INFO" className="rounded border border-zinc-300 px-2 py-1 text-xs text-zinc-700">
                {PLANNING_COMMENT_TYPES.map((type) => (
                  <option key={type} value={type}>
                    {planningCommentTypeLabel(type)}
                  </option>
                ))}
              </select>
              <select name="status" defaultValue="NONE" className="rounded border border-zinc-300 px-2 py-1 text-xs text-zinc-700">
                {PLANNING_COMMENT_STATUSES.map((status) => (
                  <option key={status} value={status}>
                    {planningCommentStatusLabel(status)}
                  </option>
                ))}
              </select>
              <select
                name="visibility"
                defaultValue="TEAM"
                className="rounded border border-zinc-300 px-2 py-1 text-xs text-zinc-700"
              >
                {PLANNING_COMMENT_VISIBILITIES.map((visibility) => (
                  <option key={visibility} value={visibility}>
                    {planningCommentVisibilityLabel(visibility)}
                  </option>
                ))}
              </select>
            </div>
            <textarea
              name="text"
              required
              rows={3}
              className="w-full rounded border border-zinc-300 px-2 py-1 text-xs text-zinc-700"
              placeholder="Ex: CA validé le 12/04, formation incendie à 14h..."
            />
            <button
              type="submit"
              className="justify-self-start rounded border border-sky-300 bg-sky-600 px-3 py-1 text-xs font-semibold text-white hover:bg-sky-700"
            >
              Ajouter le commentaire
            </button>
          </form>
        </aside>
      ) : null}
    </div>
  );
}
