"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { adminTeamPath } from "@/lib/routes";
import { getTeamBySlug, LEGACY_DEFAULT_TEAM_SLUG, requireTeamAdmin } from "@/lib/team";

function teamSlugFromForm(formData: FormData): string {
  const slug = String(formData.get("teamSlug") ?? "").trim();
  return slug || LEGACY_DEFAULT_TEAM_SLUG;
}

function formationsPath(teamSlug: string): string {
  return adminTeamPath(teamSlug, "formations");
}

function parseOptionalDate(value: FormDataEntryValue | null): Date | null {
  const raw = String(value ?? "").trim();
  if (!raw) return null;
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(raw);
  if (!match) return null;
  const y = Number(match[1]);
  const m = Number(match[2]);
  const d = Number(match[3]);
  if (!Number.isInteger(y) || !Number.isInteger(m) || !Number.isInteger(d)) return null;
  if (m < 1 || m > 12 || d < 1 || d > 31) return null;
  const dt = new Date(Date.UTC(y, m - 1, d, 12, 0, 0, 0));
  return Number.isNaN(dt.getTime()) ? null : dt;
}

function parsePositiveInt(value: FormDataEntryValue | null): number | null {
  const raw = String(value ?? "").trim();
  if (!raw) return null;
  const n = Number(raw);
  if (!Number.isInteger(n) || n <= 0 || n > 600) return null;
  return n;
}

function getTrainingDelegates(basePath: string) {
  const delegates = prisma as unknown as {
    teamTrainingType?: {
      create: typeof prisma.teamTrainingType.create;
      update: typeof prisma.teamTrainingType.update;
      delete: typeof prisma.teamTrainingType.delete;
      findFirst: typeof prisma.teamTrainingType.findFirst;
    };
    userTrainingCompletion?: {
      upsert: typeof prisma.userTrainingCompletion.upsert;
      delete: typeof prisma.userTrainingCompletion.delete;
    };
  };
  if (!delegates.teamTrainingType || !delegates.userTrainingCompletion) {
    redirect(
      basePath +
        "?error=" +
        encodeURIComponent("Module indisponible temporairement. Relancez le serveur de développement."),
    );
  }
  return {
    teamTrainingType: delegates.teamTrainingType,
    userTrainingCompletion: delegates.userTrainingCompletion,
  };
}

async function revalidateFormations(teamSlug: string) {
  revalidatePath(formationsPath(teamSlug));
}

export async function createTrainingType(formData: FormData) {
  const teamSlug = teamSlugFromForm(formData);
  const base = formationsPath(teamSlug);
  await requireTeamAdmin(teamSlug);
  const { teamTrainingType } = getTrainingDelegates(base);

  const team = await getTeamBySlug(teamSlug);
  if (!team) {
    redirect(base + "?error=" + encodeURIComponent("Équipe introuvable."));
  }

  const name = String(formData.get("name") ?? "").trim();
  if (!name) {
    redirect(base + "?error=" + encodeURIComponent("Nom de formation requis."));
  }

  const recurrenceMonths = parsePositiveInt(formData.get("recurrenceMonths"));

  const last = await teamTrainingType.findFirst({
    where: { teamId: team.id },
    orderBy: { displayOrder: "desc" },
    select: { displayOrder: true },
  });

  await teamTrainingType.create({
    data: {
      teamId: team.id,
      name,
      recurrenceMonths,
      displayOrder: (last?.displayOrder ?? -1) + 1,
    },
  });

  await revalidateFormations(teamSlug);
  redirect(base + "?created=1");
}

export async function updateTrainingType(formData: FormData) {
  const teamSlug = teamSlugFromForm(formData);
  const base = formationsPath(teamSlug);
  await requireTeamAdmin(teamSlug);
  const { teamTrainingType } = getTrainingDelegates(base);

  const id = String(formData.get("id") ?? "").trim();
  if (!id) {
    redirect(base + "?error=" + encodeURIComponent("Formation introuvable."));
  }

  const team = await getTeamBySlug(teamSlug);
  if (!team) {
    redirect(base + "?error=" + encodeURIComponent("Équipe introuvable."));
  }

  const existing = await teamTrainingType.findFirst({
    where: { id, teamId: team.id },
  });
  if (!existing) {
    redirect(base + "?error=" + encodeURIComponent("Formation introuvable."));
  }

  const nameRaw = formData.get("name");
  const recurrenceRaw = formData.get("recurrenceMonths");

  const data: { name?: string; recurrenceMonths?: number | null } = {};
  if (nameRaw !== null) {
    const name = String(nameRaw).trim();
    if (!name) {
      redirect(base + "?error=" + encodeURIComponent("Nom de formation requis."));
    }
    data.name = name;
  }
  if (recurrenceRaw !== null) {
    const raw = String(recurrenceRaw).trim();
    data.recurrenceMonths = raw ? parsePositiveInt(recurrenceRaw) : null;
  }

  await teamTrainingType.update({ where: { id }, data });
  await revalidateFormations(teamSlug);
}

export async function deleteTrainingType(formData: FormData) {
  const teamSlug = teamSlugFromForm(formData);
  const base = formationsPath(teamSlug);
  await requireTeamAdmin(teamSlug);
  const { teamTrainingType } = getTrainingDelegates(base);

  const id = String(formData.get("id") ?? "").trim();
  if (!id) {
    redirect(base + "?error=" + encodeURIComponent("Formation introuvable."));
  }

  const team = await getTeamBySlug(teamSlug);
  if (!team) {
    redirect(base + "?error=" + encodeURIComponent("Équipe introuvable."));
  }

  const existing = await teamTrainingType.findFirst({
    where: { id, teamId: team.id },
  });
  if (!existing) {
    redirect(base + "?error=" + encodeURIComponent("Formation introuvable."));
  }

  await teamTrainingType.delete({ where: { id } });
  await revalidateFormations(teamSlug);
  redirect(base + "?deleted=1");
}

export async function upsertTrainingCompletion(formData: FormData) {
  const teamSlug = teamSlugFromForm(formData);
  const base = formationsPath(teamSlug);
  await requireTeamAdmin(teamSlug);
  const { teamTrainingType, userTrainingCompletion } = getTrainingDelegates(base);

  const userId = String(formData.get("userId") ?? "").trim();
  const trainingTypeId = String(formData.get("trainingTypeId") ?? "").trim();
  if (!userId || !trainingTypeId) {
    redirect(base + "?error=" + encodeURIComponent("Données invalides."));
  }

  const team = await getTeamBySlug(teamSlug);
  if (!team) {
    redirect(base + "?error=" + encodeURIComponent("Équipe introuvable."));
  }

  const training = await teamTrainingType.findFirst({
    where: { id: trainingTypeId, teamId: team.id },
  });
  if (!training) {
    redirect(base + "?error=" + encodeURIComponent("Formation introuvable."));
  }

  const membership = await prisma.userTeam.findUnique({
    where: { userId_teamId: { userId, teamId: team.id } },
  });
  if (!membership) {
    redirect(base + "?error=" + encodeURIComponent("Agent hors équipe."));
  }

  const lastCompletedAt = parseOptionalDate(formData.get("lastCompletedAt"));

  if (!lastCompletedAt) {
    await userTrainingCompletion.delete({
      where: { userId_trainingTypeId: { userId, trainingTypeId } },
    }).catch(() => undefined);
  } else {
    await userTrainingCompletion.upsert({
      where: { userId_trainingTypeId: { userId, trainingTypeId } },
      create: { userId, trainingTypeId, lastCompletedAt },
      update: { lastCompletedAt },
    });
  }

  await revalidateFormations(teamSlug);
}
