"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { DEFAULT_TEMPLATE_CYCLE_WEEKS, normalizeTemplateCycleWeeks } from "@/lib/planning-template";
import { requireStaffAdmin } from "@/lib/require-staff-admin";
import { getTeamBySlug, LEGACY_DEFAULT_TEAM_ID } from "@/lib/team";
import { getEditableTeamIds } from "@/lib/user-roles";
import { adminTeamPath, workspacePath } from "@/lib/routes";

function parseTemplateNumber(raw: FormDataEntryValue | null): number | null {
  const n = Number(String(raw ?? ""));
  if (!Number.isInteger(n) || n < 1) return null;
  return n;
}

async function teamIdAndSlugFromForm(formData: FormData): Promise<{ teamId: string; teamSlug: string }> {
  const slug = String(formData.get("teamSlug") ?? "").trim();
  const team = slug ? await getTeamBySlug(slug) : null;
  if (team) return { teamId: team.id, teamSlug: team.slug };
  return { teamId: LEGACY_DEFAULT_TEAM_ID, teamSlug: "ide-jour" };
}

function parseCycleWeeks(raw: FormDataEntryValue | null): number {
  const n = Number(String(raw ?? ""));
  if (!Number.isInteger(n) || n < 1) return DEFAULT_TEMPLATE_CYCLE_WEEKS;
  return Math.min(52, n);
}

function parseCycleStartDate(raw: FormDataEntryValue | null): Date | null {
  const s = String(raw ?? "").trim();
  if (!s) return null;
  const parts = s.split("-").map(Number);
  if (parts.length !== 3 || parts.some((n) => Number.isNaN(n))) return null;
  const [y, mo, d] = parts;
  if (!Number.isInteger(y) || !Number.isInteger(mo) || !Number.isInteger(d)) return null;
  if (mo < 1 || mo > 12 || d < 1 || d > 31) return null;
  const dt = new Date(Date.UTC(y, mo - 1, d, 12, 0, 0, 0));
  if (dt.getUTCFullYear() !== y || dt.getUTCMonth() + 1 !== mo || dt.getUTCDate() !== d) return null;
  return dt;
}

export async function savePlanningTemplate(formData: FormData) {
  const actor = await requireStaffAdmin();
  const { teamId, teamSlug } = await teamIdAndSlugFromForm(formData);
  const tramesPath = adminTeamPath(teamSlug, "trames");

  const editableIds = await getEditableTeamIds(actor.id, actor.role);
  if (!editableIds.includes(teamId)) {
    redirect(tramesPath + "?error=" + encodeURIComponent("Accès refusé pour cette équipe."));
  }

  const templateNumber = parseTemplateNumber(formData.get("templateNumber"));
  if (!templateNumber) {
    redirect(`${tramesPath}?error=` + encodeURIComponent("Numero de trame invalide."));
  }

  const cycleWeeks = parseCycleWeeks(formData.get("cycleWeeks"));
  const cycleStartDate = parseCycleStartDate(formData.get("cycleStartDate"));
  const labelRaw = String(formData.get("templateLabel") ?? "").trim();
  const label = labelRaw || `Trame ${templateNumber}`;
  const cycleDays = normalizeTemplateCycleWeeks(cycleWeeks) * 7;

  const shiftTypes = await prisma.shiftType.findMany({
    where: { teamId },
    select: { id: true },
  });
  const validShiftIds = new Set(shiftTypes.map((s) => s.id));

  const template = await prisma.planningTemplate.upsert({
    where: { teamId_number: { teamId, number: templateNumber } },
    create: {
      teamId,
      number: templateNumber,
      label,
      cycleWeeks: normalizeTemplateCycleWeeks(cycleWeeks),
      cycleStartDate,
    },
    update: {
      label,
      cycleWeeks: normalizeTemplateCycleWeeks(cycleWeeks),
      cycleStartDate,
    },
    select: { id: true },
  });

  const entriesToCreate: { templateId: string; dayOffset: number; shiftTypeId: string }[] = [];
  for (let dayOffset = 0; dayOffset < cycleDays; dayOffset += 1) {
    const raw = String(formData.get(`d-${dayOffset}`) ?? "").trim();
    if (!raw) continue;
    if (!validShiftIds.has(raw)) continue;
    entriesToCreate.push({ templateId: template.id, dayOffset, shiftTypeId: raw });
  }

  await prisma.$transaction([
    prisma.planningTemplateEntry.deleteMany({ where: { templateId: template.id } }),
    ...(entriesToCreate.length
      ? [
          prisma.planningTemplateEntry.createMany({
            data: entriesToCreate,
            skipDuplicates: true,
          }),
        ]
      : []),
  ]);

  revalidatePath(tramesPath);
  revalidatePath(adminTeamPath(teamSlug, "agents"));
  revalidatePath(adminTeamPath(teamSlug, "planning"));
  revalidatePath(`${workspacePath(teamSlug, "planning")}/admin`);
  revalidatePath(workspacePath(teamSlug, "planning-equipe"));
  revalidatePath(workspacePath(teamSlug, "planning-moi"));
  redirect(`${tramesPath}?template=${templateNumber}&saved=1`);
}
