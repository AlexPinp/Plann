import { format } from "date-fns";
import {
  DEFAULT_TEMPLATE_CYCLE_WEEKS,
  getTemplateDayOffsetForCycle,
  normalizeTemplateCycleWeeks,
} from "@/lib/planning-template";
import { startOfIsoWeekMondayUtc } from "@/lib/planning-week";
import {
  alternanceTimingFromUser,
  getEffectivePlanningConfigForUserTeam,
  planningConfigFromUserOrTeam,
} from "@/lib/planning-alternance";
import { prisma } from "@/lib/prisma";
import { PlanningStatus } from "@/generated/prisma/enums";
import { requireTeamMembership } from "@/lib/team";

function parseMonth(searchParams: URLSearchParams): { year: number; month: number } {
  const now = new Date();
  const rawYear = Number(searchParams.get("year"));
  const rawMonth = Number(searchParams.get("month"));
  const year = Number.isFinite(rawYear) ? rawYear : now.getUTCFullYear();
  const month = Number.isFinite(rawMonth) ? rawMonth : now.getUTCMonth() + 1;

  if (month < 1 || month > 12) {
    return { year: now.getUTCFullYear(), month: now.getUTCMonth() + 1 };
  }
  return { year, month };
}

function foldIcsLine(line: string): string {
  const max = 73;
  if (line.length <= max) return line;
  const chunks: string[] = [];
  for (let i = 0; i < line.length; i += max) {
    chunks.push(i === 0 ? line.slice(i, i + max) : ` ${line.slice(i, i + max)}`);
  }
  return chunks.join("\r\n");
}

function escapeIcsText(text: string): string {
  return text
    .replace(/\\/g, "\\\\")
    .replace(/;/g, "\\;")
    .replace(/,/g, "\\,")
    .replace(/\r?\n/g, "\\n");
}

function toUtcStamp(date: Date): string {
  const y = String(date.getUTCFullYear());
  const m = String(date.getUTCMonth() + 1).padStart(2, "0");
  const d = String(date.getUTCDate()).padStart(2, "0");
  const hh = String(date.getUTCHours()).padStart(2, "0");
  const mm = String(date.getUTCMinutes()).padStart(2, "0");
  const ss = String(date.getUTCSeconds()).padStart(2, "0");
  return `${y}${m}${d}T${hh}${mm}${ss}Z`;
}

function toLocalDateTimeStamp(date: Date, hhmm: string): string {
  const [hhRaw, mmRaw] = hhmm.split(":");
  const hh = Number(hhRaw);
  const mm = Number(mmRaw);
  const y = String(date.getUTCFullYear());
  const m = String(date.getUTCMonth() + 1).padStart(2, "0");
  const d = String(date.getUTCDate()).padStart(2, "0");
  const hour = String(Number.isFinite(hh) ? hh : 0).padStart(2, "0");
  const min = String(Number.isFinite(mm) ? mm : 0).padStart(2, "0");
  return `${y}${m}${d}T${hour}${min}00`;
}

function buildIcsCalendar(events: Array<{ uid: string; start: string; end: string; summary: string; description: string }>) {
  const nowStamp = toUtcStamp(new Date());
  const lines: string[] = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//Planner SAU LRSY//Mon Planning//FR",
    "CALSCALE:GREGORIAN",
    "METHOD:PUBLISH",
  ];

  for (const event of events) {
    lines.push("BEGIN:VEVENT");
    lines.push(foldIcsLine(`UID:${event.uid}`));
    lines.push(`DTSTAMP:${nowStamp}`);
    lines.push(`DTSTART:${event.start}`);
    lines.push(`DTEND:${event.end}`);
    lines.push(foldIcsLine(`SUMMARY:${escapeIcsText(event.summary)}`));
    lines.push(foldIcsLine(`DESCRIPTION:${escapeIcsText(event.description)}`));
    lines.push("END:VEVENT");
  }

  lines.push("END:VCALENDAR");
  return `${lines.join("\r\n")}\r\n`;
}

export async function GET(
  req: Request,
  { params }: { params: Promise<{ team: string }> },
) {
  const { team: teamSlug } = await params;
  const ctx = await requireTeamMembership(teamSlug);
  const url = new URL(req.url);
  const { year, month } = parseMonth(url.searchParams);

  const me = ctx.user;
  const myTeamRow = await prisma.userTeam.findUnique({
    where: { userId_teamId: { userId: me.id, teamId: ctx.team.id } },
  });

  const lastDay = new Date(Date.UTC(year, month, 0)).getUTCDate();
  const rangeStart = new Date(Date.UTC(year, month - 1, 1, 0, 0, 0, 0));
  const rangeEnd = new Date(Date.UTC(year, month - 1, lastDay, 23, 59, 59, 999));
  const weekStartsInMonth: Date[] = [];
  {
    const seen = new Set<number>();
    for (let d = 1; d <= lastDay; d++) {
      const ws = startOfIsoWeekMondayUtc(new Date(Date.UTC(year, month - 1, d, 12, 0, 0)));
      if (!seen.has(ws.getTime())) {
        seen.add(ws.getTime());
        weekStartsInMonth.push(ws);
      }
    }
  }

  const cfg = planningConfigFromUserOrTeam(me, myTeamRow);
  const myTemplateNumbers = Array.from(
    new Set(
      [cfg.planningTemplateNumber, cfg.planningTemplateNumberA, cfg.planningTemplateNumberB].filter(
        (n): n is number => typeof n === "number",
      ),
    ),
  );
  const timing = alternanceTimingFromUser(me);

  const [assignments, shifts, myTemplates, planningWeeks] = await Promise.all([
    prisma.assignment.findMany({
      where: {
        userId: me.id,
        date: { gte: rangeStart, lte: rangeEnd },
        planningWeek: { teamId: ctx.team.id },
      },
      include: { shiftType: true },
      orderBy: { date: "asc" },
    }),
    prisma.shiftType.findMany({ orderBy: { code: "asc" } }),
    myTemplateNumbers.length
      ? prisma.planningTemplate.findMany({
          where: { teamId: ctx.team.id, number: { in: myTemplateNumbers } },
          include: { entries: { where: { shiftTypeId: { not: null } } } },
        })
      : Promise.resolve([]),
    prisma.planningWeek.findMany({
      where: { teamId: ctx.team.id, weekStart: { in: weekStartsInMonth } },
    }),
  ]);

  const validatedWeekStarts = new Set(
    planningWeeks
      .filter((w) => w.status === PlanningStatus.VALIDATED)
      .map((w) => w.weekStart.getTime()),
  );
  const isDayValidated = (dayNum: number): boolean => {
    const ws = startOfIsoWeekMondayUtc(new Date(Date.UTC(year, month - 1, dayNum, 12, 0, 0)));
    return validatedWeekStarts.has(ws.getTime());
  };

  const byDate = new Map<string, (typeof assignments)>();
  for (const a of assignments) {
    const key = format(a.date, "yyyy-MM-dd");
    const list = byDate.get(key) ?? [];
    list.push(a);
    byDate.set(key, list);
  }
  const shiftById = new Map(shifts.map((s) => [s.id, s]));
  const templateShiftByNumberAndOffset = new Map<string, string>();
  const cycleWeeksByTemplateNumber = new Map<number, number>();
  for (const template of myTemplates) {
    cycleWeeksByTemplateNumber.set(template.number, normalizeTemplateCycleWeeks(template.cycleWeeks));
    for (const entry of template.entries) {
      if (entry.shiftTypeId) {
        templateShiftByNumberAndOffset.set(`${template.number}|${entry.dayOffset}`, entry.shiftTypeId);
      }
    }
  }

  const events: Array<{ uid: string; start: string; end: string; summary: string; description: string }> = [];
  const todayDate = new Date();
  const exportDate = `${todayDate.getUTCFullYear()}-${String(todayDate.getUTCMonth() + 1).padStart(2, "0")}-${String(todayDate.getUTCDate()).padStart(2, "0")}`;

  for (let dayNum = 1; dayNum <= lastDay; dayNum++) {
    const key = `${year}-${String(month).padStart(2, "0")}-${String(dayNum).padStart(2, "0")}`;
    const dayAssignments = byDate.get(key) ?? [];
    const date = new Date(Date.UTC(year, month - 1, dayNum, 12, 0, 0));
    const effectiveTemplateNumber = getEffectivePlanningConfigForUserTeam(timing, cfg, date).templateNumber;
    const cycleW = effectiveTemplateNumber
      ? cycleWeeksByTemplateNumber.get(effectiveTemplateNumber) ?? DEFAULT_TEMPLATE_CYCLE_WEEKS
      : 6;
    const offset = getTemplateDayOffsetForCycle(date, cycleW);
    const templateShiftId = effectiveTemplateNumber
      ? templateShiftByNumberAndOffset.get(`${effectiveTemplateNumber}|${offset}`)
      : undefined;
    const templateShift = templateShiftId ? shiftById.get(templateShiftId) : undefined;
    const dayValidated = isDayValidated(dayNum);

    const displayAssignments =
      dayValidated
        ? dayAssignments.length > 0
          ? dayAssignments
          : templateShift
            ? [{ id: `tpl-${key}`, shiftType: templateShift }]
            : []
        : templateShift
          ? [{ id: `tpl-${key}`, shiftType: templateShift }]
          : [];

    for (const assignment of displayAssignments) {
      const shift = assignment.shiftType;
      const startStamp = toLocalDateTimeStamp(date, shift.startsAt);
      let endDate = new Date(date);
      if (shift.endsAt <= shift.startsAt) {
        endDate = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate() + 1, 12, 0, 0));
      }
      const endStamp = toLocalDateTimeStamp(endDate, shift.endsAt);
      events.push({
        uid: `${me.id}-${key}-${shift.code}@planner-sau-lrsy`,
        start: startStamp,
        end: endStamp,
        summary: `${shift.code} - ${shift.label}`,
        description: `Equipe: ${ctx.team.label}\nHoraires: ${shift.startsAt}-${shift.endsAt}\nExport du: ${exportDate}`,
      });
    }
  }

  const ics = buildIcsCalendar(events);
  const filename = `mon-planning-${ctx.team.slug}-${year}-${String(month).padStart(2, "0")}.ics`;

  return new Response(ics, {
    headers: {
      "Content-Type": "text/calendar; charset=utf-8",
      "Content-Disposition": `attachment; filename="${filename}"`,
      "Cache-Control": "no-store",
    },
  });
}
