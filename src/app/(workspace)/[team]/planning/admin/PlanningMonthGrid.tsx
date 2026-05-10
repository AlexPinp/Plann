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
import { getShiftDurationHours } from "@/lib/shift-hours";

export type DayCol = { key: string; dayNum: number; dow: string };

export type UserRow = { id: string; displayName: string };

export type GroupBlock = { label: string; color: string; users: UserRow[] };

export type ShiftOption = {
  id: string;
  code: string;
  color: string;
  label: string;
  startsAt: string;
  endsAt: string;
};
type PlanningCommentItem = {
  id: string;
  type: string;
  status: string;
  visibility: string;
  text: string;
  createdAtIso: string;
  createdByName: string;
};

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

type Props = {
  /** Slug d'équipe (URL) — transmis aux server actions pour le bon `PlanningWeek`. */
  teamSlug: string;
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

/** Aligné sur le récap Droits : ces codes ne comptent pas dans les heures travaillées. */
const EXCLUDE_CODES_FROM_WORKED_HOURS = ["CA", "CF", "CH", "RTT"] as const;

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

function formatMonthHoursDisplay(hours: number): string {
  const rounded = Math.round(hours * 10) / 10;
  return Number.isInteger(rounded) ? `${rounded}` : rounded.toFixed(1);
}

const COMMENT_POPOVER_WIDTH = 352;
const COMMENT_POPOVER_MAX_HEIGHT = 360;
const VIEW_MARGIN = 8;

/** Position sous l’ancre ; remonte au-dessus si pas assez de place en bas (viewport). */
function computeCommentPopoverPosition(anchor: {
  left: number;
  top: number;
  bottom: number;
  width: number;
}): { top: number; left: number; width: number } {
  if (typeof window === "undefined") {
    return { top: anchor.bottom + 6, left: anchor.left, width: COMMENT_POPOVER_WIDTH };
  }
  const vw = window.innerWidth;
  const vh = window.innerHeight;
  const width = Math.min(COMMENT_POPOVER_WIDTH, vw - 2 * VIEW_MARGIN);
  let left = anchor.left;
  left = Math.max(VIEW_MARGIN, Math.min(left, vw - width - VIEW_MARGIN));
  const gap = 6;
  let top = anchor.bottom + gap;
  if (top + COMMENT_POPOVER_MAX_HEIGHT > vh - VIEW_MARGIN) {
    top = anchor.top - COMMENT_POPOVER_MAX_HEIGHT - gap;
  }
  if (top < VIEW_MARGIN) top = VIEW_MARGIN;
  return { top, left, width };
}

export function PlanningMonthGrid({
  teamSlug,
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
  const gridScrollRef = useRef<HTMLDivElement>(null);
  const [selectedCommentCell, setSelectedCommentCell] = useState<{
    key: string;
    userId: string;
    userName: string;
    date: string;
    anchorRect: { left: number; top: number; bottom: number; width: number };
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

  useEffect(() => {
    if (!selectedCommentCell) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setSelectedCommentCell(null);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [selectedCommentCell]);

  useEffect(() => {
    if (!selectedCommentCell) return;
    const el = gridScrollRef.current;
    if (!el) return;
    const close = () => setSelectedCommentCell(null);
    el.addEventListener("scroll", close, { passive: true });
    return () => el.removeEventListener("scroll", close);
  }, [selectedCommentCell]);

  const legend = useMemo(() => orderedLegendShifts(shifts), [shifts]);

  const allUsers = useMemo(() => groups.flatMap((g) => g.users), [groups]);

  const shiftValueForCell = (k: string): string => {
    const local = localCells[k];
    if (local !== undefined) return local;
    return cellShiftByKey[k] ?? templateShiftByUserAndDate[k] ?? "";
  };
  const commentsForCell = (k: string): PlanningCommentItem[] => commentsByKey[k] ?? [];

  const shiftById = useMemo(() => new Map(shifts.map((s) => [s.id, s])), [shifts]);

  const monthlyWorkedHoursByUserId = useMemo(() => {
    const map: Record<string, number> = {};
    for (const u of allUsers) {
      let sum = 0;
      for (const d of days) {
        const k = `${u.id}|${d.key}`;
        const sid = shiftValueForCell(k);
        if (!sid) continue;
        const st = shiftById.get(sid);
        if (!st || EXCLUDE_CODES_FROM_WORKED_HOURS.some((c) => c === st.code)) continue;
        sum += getShiftDurationHours(st.startsAt, st.endsAt);
      }
      map[u.id] = sum;
    }
    return map;
  }, [allUsers, days, shiftById, cellShiftByKey, templateShiftByUserAndDate, localCells]);

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
        const isOk =
          required !== null && (required === 0 ? count === 0 : count === required);
        const isOver = required !== null && count > required;
        const isUnder = required !== null && required > 0 && count < required;
        return {
          count,
          required,
          isOk,
          isOver,
          isUnder,
        };
      });
      return { code: rule.code, isRpj: rule.code === "RPJ", checks };
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

  const popoverPos = selectedCommentCell ? computeCommentPopoverPosition(selectedCommentCell.anchorRect) : null;

  return (
    <>
      <div className="space-y-3">
        <div className="mx-auto w-max max-w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-center text-sm font-semibold capitalize text-zinc-900">
          {monthLabel}
        </div>

        <div
          ref={gridScrollRef}
          className="mx-auto max-h-[85vh] w-max max-w-full overflow-auto rounded-lg border border-zinc-300 bg-white shadow-sm"
        >
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
                rowSpan={2}
                title="Heures travaillées sur le mois (somme des durées des codes horaires)"
                className="sticky top-0 z-30 w-[34px] min-w-[34px] max-w-[34px] border border-zinc-300 bg-zinc-200 px-0 py-1 text-center text-[9px] font-semibold leading-tight text-zinc-800"
              >
                h
                <br />
                mois
              </th>
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
                  className="sticky top-[28px] z-30 min-w-[22px] border border-zinc-300 px-0 py-1 text-center text-[10px] font-semibold leading-tight text-zinc-700"
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
                    colSpan={days.length + legend.length + 2}
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
                              <input type="hidden" name="teamSlug" value={teamSlug} />
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
                              onClick={(ev) => {
                                const r = ev.currentTarget.getBoundingClientRect();
                                setSelectedCommentCell({
                                  key: k,
                                  userId: u.id,
                                  userName: u.displayName,
                                  date: d.key,
                                  anchorRect: {
                                    left: r.left,
                                    top: r.top,
                                    bottom: r.bottom,
                                    width: r.width,
                                  },
                                });
                              }}
                            >
                              {cellComments.length > 0
                                ? `${firstType ? planningCommentTypeBadge(firstType) : "CM"}${cellComments.length > 1 ? `+${cellComments.length - 1}` : ""}`
                                : "+"}
                            </button>
                          </div>
                        </td>
                      );
                    })}
                    <td className="w-[34px] min-w-[34px] max-w-[34px] border border-zinc-200 bg-zinc-50 px-0 py-0.5 text-center tabular-nums text-[9px] font-semibold text-zinc-900">
                      {formatMonthHoursDisplay(monthlyWorkedHoursByUserId[u.id] ?? 0)}
                    </td>
                    {legend.map((s) => (
                      <td
                        key={`${u.id}-${s.code}`}
                        className="min-w-[22px] max-w-[26px] border border-zinc-200 bg-white px-0 py-0.5 text-center text-[10px] tabular-nums leading-none text-zinc-800"
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
                  colSpan={days.length + legend.length + 2}
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
                <td colSpan={days.length} className="border border-zinc-300 p-0 align-middle">
                  <div
                    className="grid h-full min-h-[22px] w-full divide-x divide-zinc-300"
                    style={{ gridTemplateColumns: `repeat(${days.length}, minmax(0, 1fr))` }}
                  >
                    {row.checks.map((check, idx) => (
                      <div
                        key={`sector-${row.code}-${days[idx].key}`}
                        className={[
                          "flex items-center justify-center px-0 py-0.5",
                          row.isRpj
                            ? check.count > 0
                              ? "bg-emerald-100 font-semibold text-emerald-800"
                              : "bg-white text-zinc-800"
                            : check.isOk
                              ? "bg-emerald-100 font-semibold text-emerald-800"
                              : check.isUnder
                                ? "bg-rose-100 font-semibold text-rose-800"
                                : check.isOver
                                  ? "bg-amber-100 font-semibold text-amber-900"
                                  : "text-zinc-800",
                        ].join(" ")}
                        title={
                          row.isRpj
                            ? `${row.code}: ${check.count} affectation(s)`
                            : check.required === null
                              ? `${row.code}: ${check.count} affectation(s) — pas de minimum imposé`
                              : check.isOver
                                ? `${row.code}: ${check.count}/${check.required} — sur-effectif`
                                : check.isUnder
                                  ? `${row.code}: ${check.count}/${check.required} — sous-effectif`
                                  : `${row.code}: ${check.count}/${check.required}`
                        }
                      >
                        <span className="inline-flex max-w-[22px] flex-col items-center gap-0 leading-none">
                          <span className="text-center text-[8px] font-semibold tabular-nums">
                            {check.count}
                            {row.isRpj ? "" : check.isOver ? "+" : check.isUnder ? "−" : ""}
                          </span>
                        </span>
                      </div>
                    ))}
                  </div>
                </td>
                <td
                  className="w-[34px] min-w-[34px] max-w-[34px] border border-zinc-300 bg-indigo-50/50"
                  aria-hidden="true"
                />
                <td colSpan={legend.length} className="border border-zinc-300 bg-indigo-50/50" />
              </tr>
            ))}
          </tbody>
        </table>
        </div>
      </div>

      {selectedCommentCell && popoverPos ? (
        <>
          <button
            type="button"
            className="fixed inset-0 z-[90] cursor-default bg-zinc-900/15"
            aria-label="Fermer les commentaires"
            onClick={() => setSelectedCommentCell(null)}
          />
          <aside
            role="dialog"
            aria-modal="true"
            aria-labelledby="planning-comment-popover-title"
            className="fixed z-[100] max-h-[360px] overflow-y-auto rounded-lg border border-sky-200 bg-sky-50/95 px-3 py-2 shadow-xl ring-1 ring-black/10"
            style={{
              top: popoverPos.top,
              left: popoverPos.left,
              width: popoverPos.width,
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="mb-2 flex items-start justify-between gap-2">
              <div className="min-w-0">
                <h2 id="planning-comment-popover-title" className="text-xs font-semibold text-zinc-900">
                  Commentaires du jour
                </h2>
                <p className="truncate text-[11px] text-zinc-600">
                  {selectedCommentCell.userName} —{" "}
                  {format(new Date(`${selectedCommentCell.date}T12:00:00.000Z`), "dd MMM yyyy", { locale: fr })}
                </p>
              </div>
              <button
                type="button"
                className="shrink-0 rounded border border-zinc-300 bg-white px-2 py-0.5 text-[11px] text-zinc-600 hover:bg-zinc-50"
                onClick={() => setSelectedCommentCell(null)}
              >
                Fermer
              </button>
            </div>

            <div className="max-h-36 space-y-1.5 overflow-y-auto">
              {commentsForCell(selectedCommentCell.key).length === 0 ? (
                <p className="rounded border border-dashed border-zinc-300 bg-white/80 px-2 py-1 text-[11px] text-zinc-500">
                  Aucun commentaire pour ce jour.
                </p>
              ) : (
                commentsForCell(selectedCommentCell.key).map((comment) => (
                  <div key={comment.id} className="rounded border border-zinc-200 bg-white p-2 text-[11px] text-zinc-700">
                    <div className="flex items-start justify-between gap-2">
                      <div className="font-semibold text-zinc-900">
                        {planningCommentTypeLabel(comment.type as PlanningCommentType)} —{" "}
                        {planningCommentStatusLabel(comment.status as PlanningCommentStatus)}
                      </div>
                      <form action={deletePlanningComment}>
                        <input type="hidden" name="teamSlug" value={teamSlug} />
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
                      {planningCommentVisibilityLabel(comment.visibility as PlanningCommentVisibility)} —{" "}
                      {format(new Date(comment.createdAtIso), "dd/MM/yy HH:mm")} — {comment.createdByName}
                    </p>
                  </div>
                ))
              )}
            </div>

            <form action={addPlanningComment} className="mt-2 grid gap-1.5 rounded border border-zinc-200 bg-white p-2">
              <input type="hidden" name="teamSlug" value={teamSlug} />
              <input type="hidden" name="userId" value={selectedCommentCell.userId} />
              <input type="hidden" name="date" value={selectedCommentCell.date} />
              <div className="grid grid-cols-1 gap-1 sm:grid-cols-3">
                <select name="type" defaultValue="INFO" className="rounded border border-zinc-300 px-1.5 py-1 text-[11px] text-zinc-700">
                  {PLANNING_COMMENT_TYPES.map((type) => (
                    <option key={type} value={type}>
                      {planningCommentTypeLabel(type)}
                    </option>
                  ))}
                </select>
                <select name="status" defaultValue="NONE" className="rounded border border-zinc-300 px-1.5 py-1 text-[11px] text-zinc-700">
                  {PLANNING_COMMENT_STATUSES.map((status) => (
                    <option key={status} value={status}>
                      {planningCommentStatusLabel(status)}
                    </option>
                  ))}
                </select>
                <select
                  name="visibility"
                  defaultValue="TEAM"
                  className="rounded border border-zinc-300 px-1.5 py-1 text-[11px] text-zinc-700"
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
                rows={2}
                className="w-full rounded border border-zinc-300 px-2 py-1 text-[11px] text-zinc-700"
                placeholder="Ex: CA validé, formation…"
              />
              <button
                type="submit"
                className="justify-self-start rounded border border-sky-600 bg-sky-600 px-2 py-1 text-[11px] font-semibold text-white hover:bg-sky-700"
              >
                Ajouter
              </button>
            </form>
          </aside>
        </>
      ) : null}
    </>
  );
}
