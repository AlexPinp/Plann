"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { PlanningStatus } from "@/generated/prisma/enums";
import { getOrCreatePlanningWeekForDate, utcDayRange, startOfIsoWeekMondayUtc } from "@/lib/planning-week";
import { requirePlanningAndStaffAccess } from "@/lib/user-roles";
import { getAllTeams, getTeamBySlug, LEGACY_DEFAULT_TEAM_ID } from "@/lib/team";
import {
  PLANNING_COMMENT_STATUSES,
  PLANNING_COMMENT_TYPES,
  PLANNING_COMMENT_VISIBILITIES,
  type PlanningCommentStatus,
  type PlanningCommentType,
  type PlanningCommentVisibility,
} from "@/lib/planning-comments";
import { adminTeamPath, workspacePath } from "@/lib/routes";

async function resolveTeamIdFromForm(formData: FormData): Promise<{ teamId: string; teamSlug: string }> {
  const slug = String(formData.get("teamSlug") ?? "").trim();
  const team = slug ? await getTeamBySlug(slug) : null;
  if (team) return { teamId: team.id, teamSlug: team.slug };
  return { teamId: LEGACY_DEFAULT_TEAM_ID, teamSlug: "ide-jour" };
}

async function revalidatePlanningViews(teamSlug: string) {
  revalidatePath(adminTeamPath(teamSlug, "planning"));
  revalidatePath(workspacePath(teamSlug, "planning-moi"));
  revalidatePath(workspacePath(teamSlug, "planning-equipe"));
  revalidatePath(`${workspacePath(teamSlug, "planning")}/admin`);
  revalidatePath(workspacePath(teamSlug, "droits"));
  const teams = await getAllTeams();
  for (const t of teams) {
    revalidatePath(workspacePath(t.slug, "organisation"));
  }
}

export async function setPlanningCell(formData: FormData) {
  await requirePlanningAndStaffAccess();
  const { teamId, teamSlug } = await resolveTeamIdFromForm(formData);

  const userId = String(formData.get("userId") ?? "").trim();
  const dateStr = String(formData.get("date") ?? "").trim();
  const shiftTypeIdRaw = formData.get("shiftTypeId");
  const shiftTypeId =
    shiftTypeIdRaw === null || shiftTypeIdRaw === "" ? "" : String(shiftTypeIdRaw).trim();

  if (!userId || !dateStr) {
    return;
  }

  const parts = dateStr.split("-").map(Number);
  if (parts.length !== 3 || parts.some((n) => Number.isNaN(n))) {
    return;
  }
  const [y, m, d] = parts;
  const { start: dayStart, end: dayEnd } = utcDayRange(y, m - 1, d);

  if (!shiftTypeId) {
    await prisma.assignment.deleteMany({
      where: {
        userId,
        date: { gte: dayStart, lt: dayEnd },
        planningWeek: { teamId },
      },
    });
    await revalidatePlanningViews(teamSlug);
    return;
  }

  const week = await getOrCreatePlanningWeekForDate(dayStart, teamId);
  const existing = await prisma.assignment.findFirst({
    where: {
      userId,
      date: { gte: dayStart, lt: dayEnd },
      planningWeek: { teamId },
    },
  });

  if (existing) {
    await prisma.assignment.update({
      where: { id: existing.id },
      data: {
        shiftTypeId,
        planningWeekId: week.id,
      },
    });
  } else {
    await prisma.assignment.create({
      data: {
        userId,
        date: dayStart,
        shiftTypeId,
        planningWeekId: week.id,
      },
    });
  }

  await revalidatePlanningViews(teamSlug);
}

/** Weeks that overlap with a given month (weekStart Monday → Sunday). */
function weekStartsForMonth(y: number, m: number): Date[] {
  const firstDay = new Date(Date.UTC(y, m - 1, 1, 12, 0, 0));
  const lastDay = new Date(Date.UTC(y, m, 0, 12, 0, 0));
  const starts = new Set<number>();
  const result: Date[] = [];
  for (let d = new Date(firstDay); d <= lastDay; d.setUTCDate(d.getUTCDate() + 1)) {
    const ws = startOfIsoWeekMondayUtc(d);
    if (!starts.has(ws.getTime())) {
      starts.add(ws.getTime());
      result.push(ws);
    }
  }
  return result;
}

export async function validatePlanningMonth(formData: FormData) {
  const actor = await requirePlanningAndStaffAccess();
  const { teamId, teamSlug } = await resolveTeamIdFromForm(formData);
  const y = Number(formData.get("year"));
  const m = Number(formData.get("month"));
  if (!y || !m) return;

  const weekStarts = weekStartsForMonth(y, m);
  const now = new Date();
  const actorName = `${actor.firstName} ${actor.lastName.toUpperCase()}`;

  for (const ws of weekStarts) {
    await prisma.planningWeek.upsert({
      where: { teamId_weekStart: { teamId, weekStart: ws } },
      update: {
        status: PlanningStatus.VALIDATED,
        validatedAt: now,
        validatedBy: actor.id,
        validatedByName: actorName,
      },
      create: {
        teamId,
        weekStart: ws,
        status: PlanningStatus.VALIDATED,
        validatedAt: now,
        validatedBy: actor.id,
        validatedByName: actorName,
      },
    });
  }

  await revalidatePlanningViews(teamSlug);
}

export async function unvalidatePlanningMonth(formData: FormData) {
  await requirePlanningAndStaffAccess();
  const { teamId, teamSlug } = await resolveTeamIdFromForm(formData);
  const y = Number(formData.get("year"));
  const m = Number(formData.get("month"));
  if (!y || !m) return;

  const weekStarts = weekStartsForMonth(y, m);

  for (const ws of weekStarts) {
    await prisma.planningWeek.updateMany({
      where: { teamId, weekStart: ws },
      data: {
        status: PlanningStatus.DRAFT,
        validatedAt: null,
        validatedBy: null,
        validatedByName: null,
      },
    });
  }

  await revalidatePlanningViews(teamSlug);
}

function parseCommentEnum<T extends string>(value: FormDataEntryValue | null, allowed: readonly T[]): T | null {
  const raw = typeof value === "string" ? value.trim() : "";
  if (!raw) return null;
  return allowed.includes(raw as T) ? (raw as T) : null;
}

export async function addPlanningComment(formData: FormData) {
  const actor = await requirePlanningAndStaffAccess();
  const { teamSlug } = await resolveTeamIdFromForm(formData);

  const userId = String(formData.get("userId") ?? "").trim();
  const dateStr = String(formData.get("date") ?? "").trim();
  const text = String(formData.get("text") ?? "").trim();
  const type = parseCommentEnum(formData.get("type"), PLANNING_COMMENT_TYPES);
  const status =
    parseCommentEnum(formData.get("status"), PLANNING_COMMENT_STATUSES) ?? ("NONE" as PlanningCommentStatus);
  const visibility =
    parseCommentEnum(formData.get("visibility"), PLANNING_COMMENT_VISIBILITIES) ??
    ("TEAM" as PlanningCommentVisibility);

  if (!userId || !dateStr || !text || !type) return;

  const parts = dateStr.split("-").map(Number);
  if (parts.length !== 3 || parts.some((n) => Number.isNaN(n))) return;
  const [y, m, d] = parts;
  const { start: dayStart } = utcDayRange(y, m - 1, d);

  await prisma.planningComment.create({
    data: {
      userId,
      date: dayStart,
      type: type as PlanningCommentType,
      status,
      visibility,
      text,
      createdById: actor.id,
    },
  });

  await revalidatePlanningViews(teamSlug);
}

export async function deletePlanningComment(formData: FormData) {
  await requirePlanningAndStaffAccess();
  const { teamSlug } = await resolveTeamIdFromForm(formData);
  const commentId = String(formData.get("commentId") ?? "").trim();
  if (!commentId) return;

  await prisma.planningComment.deleteMany({
    where: { id: commentId },
  });

  await revalidatePlanningViews(teamSlug);
}
