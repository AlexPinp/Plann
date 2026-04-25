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

const LEAVE_REQUEST_TYPES = ["CA", "CF", "CH", "RTT", "REC", "AUTRE"] as const;
type LeaveRequestType = (typeof LEAVE_REQUEST_TYPES)[number];

function isLeaveRequestType(value: string): value is LeaveRequestType {
  return (LEAVE_REQUEST_TYPES as readonly string[]).includes(value);
}

function parseType(value: FormDataEntryValue | null): LeaveRequestType {
  const raw = String(value ?? "");
  if (isLeaveRequestType(raw)) {
    return raw;
  }
  return "CA";
}

function parseDateOnly(value: FormDataEntryValue | null): Date | null {
  const raw = String(value ?? "").trim();
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(raw);
  if (!m) return null;
  const y = Number(m[1]);
  const mo = Number(m[2]);
  const d = Number(m[3]);
  if (!Number.isInteger(y) || !Number.isInteger(mo) || !Number.isInteger(d)) return null;
  if (mo < 1 || mo > 12 || d < 1 || d > 31) return null;
  const dt = new Date(Date.UTC(y, mo - 1, d, 12, 0, 0, 0));
  if (Number.isNaN(dt.getTime())) return null;
  return dt;
}

async function refreshDemandesPages() {
  await revalidateAllTeamPaths(revalidatePath, {
    workspaceSegment: "demandes",
    adminSegment: "demandes",
  });
}

export async function createLeaveRequest(formData: FormData) {
  const teamSlug = teamSlugFromForm(formData);
  const demandesUrl = workspacePath(teamSlug, "demandes");
  const me = await getSessionPrismaUser();
  if (!me) redirect("/login?next=" + encodeURIComponent(demandesUrl));

  const type = parseType(formData.get("type"));
  const startsAt = parseDateOnly(formData.get("startsAt"));
  const endsAt = parseDateOnly(formData.get("endsAt")) ?? startsAt;
  const noteRaw = String(formData.get("note") ?? "").trim();
  const note = noteRaw ? noteRaw : null;

  if (!startsAt || !endsAt) {
    redirect(demandesUrl + "?error=" + encodeURIComponent("Dates invalides."));
  }
  if (endsAt.getTime() < startsAt.getTime()) {
    redirect(demandesUrl + "?error=" + encodeURIComponent("La date de fin doit être après la date de début."));
  }

  await prisma.leaveRequest.create({
    data: {
      userId: me.id,
      type,
      startsAt,
      endsAt,
      note,
    },
  });

  await refreshDemandesPages();
  redirect(demandesUrl + "?created=1");
}

export async function updateLeaveRequest(formData: FormData) {
  const teamSlug = teamSlugFromForm(formData);
  const demandesUrl = workspacePath(teamSlug, "demandes");
  const me = await getSessionPrismaUser();
  if (!me) redirect("/login?next=" + encodeURIComponent(demandesUrl));

  const id = String(formData.get("id") ?? "");
  if (!id) redirect(demandesUrl + "?error=" + encodeURIComponent("Demande introuvable."));

  const existing = await prisma.leaveRequest.findUnique({ where: { id } });
  if (!existing || existing.userId !== me.id) {
    redirect(demandesUrl + "?error=" + encodeURIComponent("Demande introuvable."));
  }
  if (existing.status !== "PENDING") {
    redirect(demandesUrl + "?error=" + encodeURIComponent("Seules les demandes en attente sont modifiables."));
  }

  const type = parseType(formData.get("type"));
  const startsAt = parseDateOnly(formData.get("startsAt"));
  const endsAt = parseDateOnly(formData.get("endsAt")) ?? startsAt;
  const noteRaw = String(formData.get("note") ?? "").trim();
  const note = noteRaw ? noteRaw : null;

  if (!startsAt || !endsAt) {
    redirect(demandesUrl + "?error=" + encodeURIComponent("Dates invalides."));
  }
  if (endsAt.getTime() < startsAt.getTime()) {
    redirect(demandesUrl + "?error=" + encodeURIComponent("La date de fin doit être après la date de début."));
  }

  await prisma.leaveRequest.update({
    where: { id },
    data: { type, startsAt, endsAt, note },
  });

  await refreshDemandesPages();
  redirect(demandesUrl + "?updated=1");
}

export async function cancelLeaveRequest(formData: FormData) {
  const teamSlug = teamSlugFromForm(formData);
  const demandesUrl = workspacePath(teamSlug, "demandes");
  const me = await getSessionPrismaUser();
  if (!me) redirect("/login?next=" + encodeURIComponent(demandesUrl));

  const id = String(formData.get("id") ?? "");
  if (!id) redirect(demandesUrl + "?error=" + encodeURIComponent("Demande introuvable."));

  const existing = await prisma.leaveRequest.findUnique({ where: { id } });
  if (!existing || existing.userId !== me.id) {
    redirect(demandesUrl + "?error=" + encodeURIComponent("Demande introuvable."));
  }
  if (existing.status !== "PENDING") {
    redirect(demandesUrl + "?error=" + encodeURIComponent("Cette demande est déjà annulée."));
  }

  await prisma.leaveRequest.update({
    where: { id },
    data: { status: "CANCELLED" },
  });

  await refreshDemandesPages();
  redirect(demandesUrl + "?cancelled=1");
}
