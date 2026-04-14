"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { getSessionPrismaUser } from "@/lib/current-user";

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

function refreshDemandesPages() {
  revalidatePath("/demandes");
  revalidatePath("/admin/demandes");
}

export async function createLeaveRequest(formData: FormData) {
  const me = await getSessionPrismaUser();
  if (!me) redirect("/login?next=/demandes");

  const type = parseType(formData.get("type"));
  const startsAt = parseDateOnly(formData.get("startsAt"));
  const endsAt = parseDateOnly(formData.get("endsAt")) ?? startsAt;
  const noteRaw = String(formData.get("note") ?? "").trim();
  const note = noteRaw ? noteRaw : null;

  if (!startsAt || !endsAt) {
    redirect("/demandes?error=" + encodeURIComponent("Dates invalides."));
  }
  if (endsAt.getTime() < startsAt.getTime()) {
    redirect("/demandes?error=" + encodeURIComponent("La date de fin doit être après la date de début."));
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

  refreshDemandesPages();
  redirect("/demandes?created=1");
}

export async function updateLeaveRequest(formData: FormData) {
  const me = await getSessionPrismaUser();
  if (!me) redirect("/login?next=/demandes");

  const id = String(formData.get("id") ?? "");
  if (!id) redirect("/demandes?error=" + encodeURIComponent("Demande introuvable."));

  const existing = await prisma.leaveRequest.findUnique({ where: { id } });
  if (!existing || existing.userId !== me.id) {
    redirect("/demandes?error=" + encodeURIComponent("Demande introuvable."));
  }
  if (existing.status !== "PENDING") {
    redirect("/demandes?error=" + encodeURIComponent("Seules les demandes en attente sont modifiables."));
  }

  const type = parseType(formData.get("type"));
  const startsAt = parseDateOnly(formData.get("startsAt"));
  const endsAt = parseDateOnly(formData.get("endsAt")) ?? startsAt;
  const noteRaw = String(formData.get("note") ?? "").trim();
  const note = noteRaw ? noteRaw : null;

  if (!startsAt || !endsAt) {
    redirect("/demandes?error=" + encodeURIComponent("Dates invalides."));
  }
  if (endsAt.getTime() < startsAt.getTime()) {
    redirect("/demandes?error=" + encodeURIComponent("La date de fin doit être après la date de début."));
  }

  await prisma.leaveRequest.update({
    where: { id },
    data: { type, startsAt, endsAt, note },
  });

  refreshDemandesPages();
  redirect("/demandes?updated=1");
}

export async function cancelLeaveRequest(formData: FormData) {
  const me = await getSessionPrismaUser();
  if (!me) redirect("/login?next=/demandes");

  const id = String(formData.get("id") ?? "");
  if (!id) redirect("/demandes?error=" + encodeURIComponent("Demande introuvable."));

  const existing = await prisma.leaveRequest.findUnique({ where: { id } });
  if (!existing || existing.userId !== me.id) {
    redirect("/demandes?error=" + encodeURIComponent("Demande introuvable."));
  }
  if (existing.status !== "PENDING") {
    redirect("/demandes?error=" + encodeURIComponent("Cette demande est déjà annulée."));
  }

  await prisma.leaveRequest.update({
    where: { id },
    data: { status: "CANCELLED" },
  });

  refreshDemandesPages();
  redirect("/demandes?cancelled=1");
}
