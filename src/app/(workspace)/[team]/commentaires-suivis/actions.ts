"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { getSessionPrismaUser } from "@/lib/current-user";
import { LEGACY_DEFAULT_TEAM_SLUG, revalidateAllTeamPaths } from "@/lib/team";
import { workspacePath } from "@/lib/routes";

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
  await revalidateAllTeamPaths(revalidatePath, {
    workspaceSegment: "commentaires-suivis",
    adminSegment: "commentaires-suivis",
  });
}

export async function createCommentaryEntry(formData: FormData) {
  const teamSlug = teamSlugFromForm(formData);
  const pageUrl = workspacePath(teamSlug, "commentaires-suivis");
  const me = await getSessionPrismaUser();
  if (!me) redirect("/login?next=" + encodeURIComponent(pageUrl));

  const subject = String(formData.get("subject") ?? "").trim();
  if (!subject) redirect(pageUrl + "?error=" + encodeURIComponent("L'objet est obligatoire."));

  await prisma.commentaryEntry.create({
    data: {
      monthLabel: normalizeOptionalText(formData.get("monthLabel")),
      datesLabel: normalizeOptionalText(formData.get("datesLabel")),
      subject,
      personnel: normalizeOptionalText(formData.get("personnel")),
      trainer: normalizeOptionalText(formData.get("trainer")),
      comment: normalizeOptionalText(formData.get("comment")),
      status: parseCommentaryStatus(formData.get("status")),
      createdById: me.id,
      createdByName: `${me.lastName.toUpperCase()} ${me.firstName}`,
    },
  });

  await refreshPage();
  redirect(pageUrl + "?commentCreated=1");
}

export async function updateCommentaryEntry(formData: FormData) {
  const teamSlug = teamSlugFromForm(formData);
  const pageUrl = workspacePath(teamSlug, "commentaires-suivis");
  const me = await getSessionPrismaUser();
  if (!me) redirect("/login?next=" + encodeURIComponent(pageUrl));

  const id = String(formData.get("id") ?? "");
  const subject = String(formData.get("subject") ?? "").trim();
  if (!id || !subject) {
    redirect(pageUrl + "?error=" + encodeURIComponent("Données commentaire invalides."));
  }

  const existing = await prisma.commentaryEntry.findUnique({ where: { id }, select: { createdById: true } });
  if (!existing || existing.createdById !== me.id) {
    redirect(pageUrl + "?error=" + encodeURIComponent("Modification non autorisée."));
  }

  await prisma.commentaryEntry.update({
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
  redirect(pageUrl + "?commentUpdated=1");
}

export async function createFollowUpEntry(formData: FormData) {
  const teamSlug = teamSlugFromForm(formData);
  const pageUrl = workspacePath(teamSlug, "commentaires-suivis");
  const me = await getSessionPrismaUser();
  if (!me) redirect("/login?next=" + encodeURIComponent(pageUrl));

  const subject = String(formData.get("subject") ?? "").trim();
  if (!subject) redirect(pageUrl + "?error=" + encodeURIComponent("L'objet est obligatoire."));

  await prisma.followUpEntry.create({
    data: {
      subject,
      personnel: normalizeOptionalText(formData.get("personnel")),
      lastDate: parseOptionalDate(formData.get("lastDate")),
      lastBy: normalizeOptionalText(formData.get("lastBy")),
      nextDate: parseOptionalDate(formData.get("nextDate")),
      nextBy: normalizeOptionalText(formData.get("nextBy")),
      note: normalizeOptionalText(formData.get("note")),
      createdById: me.id,
      createdByName: `${me.lastName.toUpperCase()} ${me.firstName}`,
    },
  });

  await refreshPage();
  redirect(pageUrl + "?followCreated=1");
}

export async function updateFollowUpEntry(formData: FormData) {
  const teamSlug = teamSlugFromForm(formData);
  const pageUrl = workspacePath(teamSlug, "commentaires-suivis");
  const me = await getSessionPrismaUser();
  if (!me) redirect("/login?next=" + encodeURIComponent(pageUrl));

  const id = String(formData.get("id") ?? "");
  const subject = String(formData.get("subject") ?? "").trim();
  if (!id || !subject) {
    redirect(pageUrl + "?error=" + encodeURIComponent("Données suivi invalides."));
  }

  const existing = await prisma.followUpEntry.findUnique({ where: { id }, select: { createdById: true } });
  if (!existing || existing.createdById !== me.id) {
    redirect(pageUrl + "?error=" + encodeURIComponent("Modification non autorisée."));
  }

  await prisma.followUpEntry.update({
    where: { id },
    data: {
      subject,
      personnel: normalizeOptionalText(formData.get("personnel")),
      lastDate: parseOptionalDate(formData.get("lastDate")),
      lastBy: normalizeOptionalText(formData.get("lastBy")),
      nextDate: parseOptionalDate(formData.get("nextDate")),
      nextBy: normalizeOptionalText(formData.get("nextBy")),
      note: normalizeOptionalText(formData.get("note")),
    },
  });

  await refreshPage();
  redirect(pageUrl + "?followUpdated=1");
}
