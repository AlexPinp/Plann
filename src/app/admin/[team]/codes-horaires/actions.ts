"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { ShiftCategory } from "@/generated/prisma/enums";
import { prisma } from "@/lib/prisma";
import {
  PrismaClientKnownRequestError,
} from "@prisma/client/runtime/client";
import { getShiftMutationErrorMessage } from "@/lib/shift-mutation-errors";
import { parseCountsInHoursRecapFromForm } from "@/lib/shift-type-recap";
import { getAllTeams, getTeamBySlug, LEGACY_DEFAULT_TEAM_SLUG, requireTeamAdmin } from "@/lib/team";
import { adminTeamPath, revalidateTeamPlanningSurfaces } from "@/lib/routes";

function parseCategory(raw: FormDataEntryValue | null): ShiftCategory {
  const value = String(raw ?? "");
  if (value === ShiftCategory.JOUR || value === ShiftCategory.NUIT) {
    return value;
  }
  return ShiftCategory.JOUR;
}

function parseColor(raw: FormDataEntryValue | null): string {
  const value = String(raw ?? "").trim();
  if (!/^#[0-9a-fA-F]{6}$/.test(value)) return "#e5e7eb";
  return value;
}

function parseTime(raw: FormDataEntryValue | null, fallback = "08:00"): string {
  const value = String(raw ?? "").trim();
  const match = value.match(/^(\d{1,2}):(\d{1,2})$/);
  if (!match) return fallback;
  const h = Number(match[1]);
  const m = Number(match[2]);
  if (!Number.isFinite(h) || !Number.isFinite(m) || h < 0 || h > 23 || m < 0 || m > 59) return fallback;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
}

function codesPath(teamSlug: string): string {
  const slug = teamSlug.trim() || LEGACY_DEFAULT_TEAM_SLUG;
  return adminTeamPath(slug, "codes-horaires");
}

async function revalidateShiftPages() {
  const teams = await getAllTeams();
  for (const t of teams) {
    revalidateTeamPlanningSurfaces(t.slug, revalidatePath);
    revalidatePath(adminTeamPath(t.slug, "codes-horaires"));
  }
}

export async function createShiftCode(formData: FormData) {
  const teamSlug = String(formData.get("teamSlug") ?? "").trim();
  await requireTeamAdmin(teamSlug || LEGACY_DEFAULT_TEAM_SLUG);

  const team = await getTeamBySlug(teamSlug || LEGACY_DEFAULT_TEAM_SLUG);
  const basePath = codesPath(team?.slug ?? teamSlug);

  if (!team) {
    redirect(basePath + "?error=" + encodeURIComponent("Équipe introuvable."));
  }

  const code = String(formData.get("code") ?? "")
    .trim()
    .toUpperCase();
  const label = String(formData.get("label") ?? "").trim();
  const color = parseColor(formData.get("color"));
  const category = parseCategory(formData.get("category"));
  const startsAt = parseTime(formData.get("startsAt"), "08:00");
  const endsAt = parseTime(formData.get("endsAt"), "16:00");
  const countsInHoursRecap = parseCountsInHoursRecapFromForm(formData);

  if (!code || !label) {
    redirect(basePath + "?error=" + encodeURIComponent("Code, nom, heure de debut et heure de fin sont obligatoires."));
  }

  try {
    await prisma.shiftType.create({
      data: {
        teamId: team.id,
        code,
        label,
        color,
        category,
        startsAt,
        endsAt,
        countsInHoursRecap,
      },
    });
  } catch (error) {
    redirect(basePath + "?error=" + encodeURIComponent(getShiftMutationErrorMessage(error)));
  }

  await revalidateShiftPages();
  redirect(basePath + "?created=1");
}

export async function updateShiftCode(formData: FormData) {
  const teamSlug = String(formData.get("teamSlug") ?? "").trim();
  await requireTeamAdmin(teamSlug || LEGACY_DEFAULT_TEAM_SLUG);

  const team = await getTeamBySlug(teamSlug || LEGACY_DEFAULT_TEAM_SLUG);
  const basePath = codesPath(team?.slug ?? teamSlug);

  if (!team) {
    redirect(basePath + "?error=" + encodeURIComponent("Équipe introuvable."));
  }

  const id = String(formData.get("id") ?? "").trim();
  if (!id) {
    redirect(basePath + "?error=" + encodeURIComponent("Code horaire introuvable."));
  }

  const existing = await prisma.shiftType.findUnique({ where: { id } });
  if (!existing || existing.teamId !== team.id) {
    redirect(basePath + "?error=" + encodeURIComponent("Code horaire introuvable."));
  }

  const code = String(formData.get("code") ?? "")
    .trim()
    .toUpperCase();
  const label = String(formData.get("label") ?? "").trim();
  const color = parseColor(formData.get("color"));
  const category = parseCategory(formData.get("category"));
  const startsAt = parseTime(formData.get("startsAt"), existing.startsAt);
  const endsAt = parseTime(formData.get("endsAt"), existing.endsAt);
  const countsInHoursRecap = parseCountsInHoursRecapFromForm(formData);

  if (!code || !label) {
    redirect(basePath + "?error=" + encodeURIComponent("Code, nom, heure de debut et heure de fin sont obligatoires."));
  }

  try {
    await prisma.shiftType.update({
      where: { id },
      data: {
        code,
        label,
        color,
        category,
        startsAt,
        endsAt,
        countsInHoursRecap,
      },
    });
  } catch (error) {
    redirect(basePath + "?error=" + encodeURIComponent(getShiftMutationErrorMessage(error)));
  }

  await revalidateShiftPages();
  redirect(basePath + "?updated=1");
}

export async function deleteShiftCode(formData: FormData) {
  const teamSlug = String(formData.get("teamSlug") ?? "").trim();
  await requireTeamAdmin(teamSlug || LEGACY_DEFAULT_TEAM_SLUG);

  const team = await getTeamBySlug(teamSlug || LEGACY_DEFAULT_TEAM_SLUG);
  const basePath = codesPath(team?.slug ?? teamSlug);

  if (!team) {
    redirect(basePath + "?error=" + encodeURIComponent("Équipe introuvable."));
  }

  const id = String(formData.get("id") ?? "").trim();
  if (!id) return;

  const existing = await prisma.shiftType.findUnique({ where: { id } });
  if (!existing || existing.teamId !== team.id) {
    redirect(basePath + "?error=" + encodeURIComponent("Code horaire introuvable."));
  }

  const assignmentCount = await prisma.assignment.count({ where: { shiftTypeId: id } });
  if (assignmentCount > 0) {
    redirect(
      basePath +
        "?error=" +
        encodeURIComponent("Suppression impossible: ce code est deja utilise dans le planning."),
    );
  }

  const deleted = await prisma.shiftType.deleteMany({ where: { id, teamId: team.id } });
  if (deleted.count === 0) {
    redirect(basePath + "?error=" + encodeURIComponent("Code horaire introuvable."));
  }
  await revalidateShiftPages();
  redirect(basePath + "?deleted=1");
}

/** Copie les codes manquants depuis une autre équipe (même libellé de code → ignoré sur la cible). */
export async function copyShiftCodesFromTeam(formData: FormData) {
  const teamSlug = String(formData.get("teamSlug") ?? "").trim();
  await requireTeamAdmin(teamSlug || LEGACY_DEFAULT_TEAM_SLUG);

  const targetTeam = await getTeamBySlug(teamSlug || LEGACY_DEFAULT_TEAM_SLUG);
  const basePath = codesPath(targetTeam?.slug ?? teamSlug);

  if (!targetTeam) {
    redirect(basePath + "?error=" + encodeURIComponent("Équipe introuvable."));
  }

  const sourceSlug = String(formData.get("sourceTeamSlug") ?? "").trim();
  const sourceTeam = await getTeamBySlug(sourceSlug);
  if (!sourceTeam) {
    redirect(basePath + "?error=" + encodeURIComponent("Équipe source introuvable."));
  }
  if (sourceTeam.id === targetTeam.id) {
    redirect(basePath + "?error=" + encodeURIComponent("Choisissez une autre équipe que la courante."));
  }

  const sourceShifts = await prisma.shiftType.findMany({
    where: { teamId: sourceTeam.id },
    include: { skills: true },
    orderBy: { code: "asc" },
  });

  const existingCodes = new Set(
    (
      await prisma.shiftType.findMany({
        where: { teamId: targetTeam.id },
        select: { code: true },
      })
    ).map((s) => s.code),
  );

  let copied = 0;
  for (const s of sourceShifts) {
    if (existingCodes.has(s.code)) continue;
    try {
      const created = await prisma.shiftType.create({
        data: {
          teamId: targetTeam.id,
          code: s.code,
          label: s.label,
          color: s.color,
          startsAt: s.startsAt,
          endsAt: s.endsAt,
          category: s.category,
          countsInHoursRecap: s.countsInHoursRecap,
        },
      });
      existingCodes.add(s.code);
      copied += 1;
      if (s.skills.length > 0) {
        await prisma.shiftSkill.createMany({
          data: s.skills.map((sk) => ({ shiftTypeId: created.id, skillId: sk.skillId })),
          skipDuplicates: true,
        });
      }
    } catch (error) {
      if (error instanceof PrismaClientKnownRequestError && error.code === "P2002") {
        existingCodes.add(s.code);
        continue;
      }
      redirect(basePath + "?error=" + encodeURIComponent(getShiftMutationErrorMessage(error)));
    }
  }

  await revalidateShiftPages();
  redirect(`${basePath}?copied=${copied}`);
}
