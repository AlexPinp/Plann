"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { ShiftCategory } from "@/generated/prisma/enums";
import { prisma } from "@/lib/prisma";
import { requireStaffAdmin } from "@/lib/require-staff-admin";
import { getAllTeams } from "@/lib/team";
import { revalidateTeamPlanningSurfaces } from "@/lib/routes";

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
  if (!/^\d{2}:\d{2}$/.test(value)) return fallback;
  const [h, m] = value.split(":").map(Number);
  if (!Number.isFinite(h) || !Number.isFinite(m) || h < 0 || h > 23 || m < 0 || m > 59) return fallback;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
}

async function revalidateShiftPages() {
  revalidatePath("/admin/codes-horaires");
  const teams = await getAllTeams();
  for (const t of teams) {
    revalidateTeamPlanningSurfaces(t.slug, revalidatePath);
  }
}

export async function createShiftCode(formData: FormData) {
  await requireStaffAdmin();

  const code = String(formData.get("code") ?? "").trim().toUpperCase();
  const label = String(formData.get("label") ?? "").trim();
  const color = parseColor(formData.get("color"));
  const category = parseCategory(formData.get("category"));
  const startsAt = parseTime(formData.get("startsAt"), "08:00");
  const endsAt = parseTime(formData.get("endsAt"), "16:00");

  if (!code || !label) {
    redirect("/admin/codes-horaires?error=" + encodeURIComponent("Code, nom, heure de debut et heure de fin sont obligatoires."));
  }

  try {
    await prisma.shiftType.create({
      data: {
        code,
        label,
        color,
        category,
        startsAt,
        endsAt,
      },
    });
  } catch {
    redirect("/admin/codes-horaires?error=" + encodeURIComponent("Impossible de creer ce code (deja existant ou invalide)."));
  }

  await revalidateShiftPages();
  redirect("/admin/codes-horaires?created=1");
}

export async function updateShiftCode(formData: FormData) {
  await requireStaffAdmin();

  const id = String(formData.get("id") ?? "").trim();
  if (!id) {
    redirect("/admin/codes-horaires?error=" + encodeURIComponent("Code horaire introuvable."));
  }

  const existing = await prisma.shiftType.findUnique({ where: { id } });
  if (!existing) {
    redirect("/admin/codes-horaires?error=" + encodeURIComponent("Code horaire introuvable."));
  }

  const code = String(formData.get("code") ?? "").trim().toUpperCase();
  const label = String(formData.get("label") ?? "").trim();
  const color = parseColor(formData.get("color"));
  const category = parseCategory(formData.get("category"));
  const startsAt = parseTime(formData.get("startsAt"), existing.startsAt);
  const endsAt = parseTime(formData.get("endsAt"), existing.endsAt);

  if (!code || !label) {
    redirect("/admin/codes-horaires?error=" + encodeURIComponent("Code, nom, heure de debut et heure de fin sont obligatoires."));
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
      },
    });
  } catch {
    redirect("/admin/codes-horaires?error=" + encodeURIComponent("Impossible de modifier ce code (doublon ou donnees invalides)."));
  }

  await revalidateShiftPages();
  redirect("/admin/codes-horaires?updated=1");
}

export async function deleteShiftCode(formData: FormData) {
  await requireStaffAdmin();

  const id = String(formData.get("id") ?? "").trim();
  if (!id) return;

  const assignmentCount = await prisma.assignment.count({ where: { shiftTypeId: id } });
  if (assignmentCount > 0) {
    redirect(
      "/admin/codes-horaires?error=" +
        encodeURIComponent("Suppression impossible: ce code est deja utilise dans le planning."),
    );
  }

  await prisma.shiftType.delete({ where: { id } });
  await revalidateShiftPages();
  redirect("/admin/codes-horaires?deleted=1");
}
