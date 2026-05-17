"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { requireStaffAdmin } from "@/lib/require-staff-admin";
import { LEGACY_DEFAULT_TEAM_SLUG, revalidateAllTeamPaths } from "@/lib/team";
import { adminTeamPath } from "@/lib/routes";

function teamSlugFromForm(formData: FormData): string {
  const slug = String(formData.get("teamSlug") ?? "").trim();
  return slug || LEGACY_DEFAULT_TEAM_SLUG;
}

const COMMENTARY_STATUSES = ["TODO", "IN_PROGRESS", "DONE"] as const;
type CommentaryStatus = (typeof COMMENTARY_STATUSES)[number];

function isCommentaryStatus(value: string): value is CommentaryStatus {
  return (COMMENTARY_STATUSES as readonly string[]).includes(value);
}

function parseCommentaryStatus(value: FormDataEntryValue | null): CommentaryStatus {
  const raw = String(value ?? "");
  return isCommentaryStatus(raw) ? raw : "TODO";
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

function normalizeOptionalText(value: FormDataEntryValue | null): string | null {
  const raw = String(value ?? "").trim();
  return raw ? raw : null;
}

async function refreshPage() {
  await revalidateAllTeamPaths(revalidatePath, { adminSegment: "commentaires-suivis" });
}

function getCommentaryDelegates(adminBasePath: string) {
  const delegates = prisma as unknown as {
    commentaryEntry?: {
      create: typeof prisma.commentaryEntry.create;
      update: typeof prisma.commentaryEntry.update;
      delete: typeof prisma.commentaryEntry.delete;
    };
    followUpEntry?: {
      create: typeof prisma.followUpEntry.create;
      update: typeof prisma.followUpEntry.update;
      delete: typeof prisma.followUpEntry.delete;
    };
  };
  if (!delegates.commentaryEntry || !delegates.followUpEntry) {
    redirect(
      adminBasePath +
        "?error=" +
        encodeURIComponent("Module indisponible temporairement. Relancez le serveur de développement."),
    );
  }
  return {
    commentaryEntry: delegates.commentaryEntry,
    followUpEntry: delegates.followUpEntry,
  };
}

export async function createCommentaryEntry(formData: FormData) {
  const actor = await requireStaffAdmin();
  const teamSlug = teamSlugFromForm(formData);
  const base = adminTeamPath(teamSlug, "commentaires-suivis");
  const { commentaryEntry } = getCommentaryDelegates(base);
  const subject = String(formData.get("subject") ?? "").trim();
  if (!subject) redirect(base + "?error=" + encodeURIComponent("L'objet est obligatoire."));

  await commentaryEntry.create({
    data: {
      monthLabel: normalizeOptionalText(formData.get("monthLabel")),
      datesLabel: normalizeOptionalText(formData.get("datesLabel")),
      subject,
      personnel: normalizeOptionalText(formData.get("personnel")),
      trainer: normalizeOptionalText(formData.get("trainer")),
      comment: normalizeOptionalText(formData.get("comment")),
      status: parseCommentaryStatus(formData.get("status")),
      createdById: actor.id,
      createdByName: `${actor.lastName.toUpperCase()} ${actor.firstName}`,
    },
  });

  await refreshPage();
  redirect(base + "?commentCreated=1");
}

export async function createFollowUpEntry(formData: FormData) {
  const actor = await requireStaffAdmin();
  const teamSlug = teamSlugFromForm(formData);
  const base = adminTeamPath(teamSlug, "commentaires-suivis");
  const { followUpEntry } = getCommentaryDelegates(base);
  const subject = String(formData.get("subject") ?? "").trim();
  if (!subject) redirect(base + "?error=" + encodeURIComponent("L'objet est obligatoire."));

  await followUpEntry.create({
    data: {
      subject,
      recurrence: normalizeOptionalText(formData.get("recurrence")),
      referents: normalizeOptionalText(formData.get("referents")),
      personnel: normalizeOptionalText(formData.get("personnel")),
      lastDate: parseOptionalDate(formData.get("lastDate")),
      lastBy: normalizeOptionalText(formData.get("lastBy")),
      nextDate: parseOptionalDate(formData.get("nextDate")),
      nextBy: normalizeOptionalText(formData.get("nextBy")),
      note: normalizeOptionalText(formData.get("note")),
      createdById: actor.id,
      createdByName: `${actor.lastName.toUpperCase()} ${actor.firstName}`,
    },
  });

  await refreshPage();
  redirect(base + "?followCreated=1");
}

export async function updateCommentaryEntry(formData: FormData) {
  await requireStaffAdmin();
  const teamSlug = teamSlugFromForm(formData);
  const base = adminTeamPath(teamSlug, "commentaires-suivis");
  const { commentaryEntry } = getCommentaryDelegates(base);

  const id = String(formData.get("id") ?? "");
  const subject = String(formData.get("subject") ?? "").trim();
  if (!id || !subject) {
    redirect(base + "?error=" + encodeURIComponent("Données commentaire invalides."));
  }

  await commentaryEntry.update({
    where: { id },
    data: {
      monthLabel: normalizeOptionalText(formData.get("monthLabel")),
      datesLabel: normalizeOptionalText(formData.get("datesLabel")),
      subject,
      personnel: normalizeOptionalText(formData.get("personnel")),
      trainer: normalizeOptionalText(formData.get("trainer")),
      comment: normalizeOptionalText(formData.get("comment")),
      status: parseCommentaryStatus(formData.get("status")),
    },
  });

  await refreshPage();
  redirect(base + "?commentUpdated=1");
}

export async function deleteCommentaryEntry(formData: FormData) {
  await requireStaffAdmin();
  const teamSlug = teamSlugFromForm(formData);
  const base = adminTeamPath(teamSlug, "commentaires-suivis");
  const { commentaryEntry } = getCommentaryDelegates(base);
  const id = String(formData.get("id") ?? "");
  if (!id) redirect(base + "?error=" + encodeURIComponent("Commentaire introuvable."));

  await commentaryEntry.delete({ where: { id } });
  await refreshPage();
  redirect(base + "?commentDeleted=1");
}

export async function updateFollowUpEntry(formData: FormData) {
  await requireStaffAdmin();
  const teamSlug = teamSlugFromForm(formData);
  const base = adminTeamPath(teamSlug, "commentaires-suivis");
  const { followUpEntry } = getCommentaryDelegates(base);

  const id = String(formData.get("id") ?? "");
  const subject = String(formData.get("subject") ?? "").trim();
  if (!id || !subject) {
    redirect(base + "?error=" + encodeURIComponent("Données suivi invalides."));
  }

  await followUpEntry.update({
    where: { id },
    data: {
      subject,
      recurrence: normalizeOptionalText(formData.get("recurrence")),
      referents: normalizeOptionalText(formData.get("referents")),
      personnel: normalizeOptionalText(formData.get("personnel")),
      lastDate: parseOptionalDate(formData.get("lastDate")),
      lastBy: normalizeOptionalText(formData.get("lastBy")),
      nextDate: parseOptionalDate(formData.get("nextDate")),
      nextBy: normalizeOptionalText(formData.get("nextBy")),
      note: normalizeOptionalText(formData.get("note")),
    },
  });

  await refreshPage();
  redirect(base + "?followUpdated=1");
}

export async function deleteFollowUpEntry(formData: FormData) {
  await requireStaffAdmin();
  const teamSlug = teamSlugFromForm(formData);
  const base = adminTeamPath(teamSlug, "commentaires-suivis");
  const { followUpEntry } = getCommentaryDelegates(base);
  const id = String(formData.get("id") ?? "");
  if (!id) redirect(base + "?error=" + encodeURIComponent("Suivi introuvable."));

  await followUpEntry.delete({ where: { id } });
  await refreshPage();
  redirect(base + "?followDeleted=1");
}
