"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { DEFAULT_TEMPLATE_CYCLE_WEEKS, normalizeTemplateCycleWeeks } from "@/lib/planning-template";
import { requireStaffAdmin } from "@/lib/require-staff-admin";
import { getTeamBySlug, LEGACY_DEFAULT_TEAM_ID } from "@/lib/team";
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

export async function savePlanningTemplate(formData: FormData) {
  await requireStaffAdmin();
  const { teamId, teamSlug } = await teamIdAndSlugFromForm(formData);
  const tramesPath = adminTeamPath(teamSlug, "trames");

  const templateNumber = parseTemplateNumber(formData.get("templateNumber"));
  if (!templateNumber) {
    redirect(`${tramesPath}?error=` + encodeURIComponent("Numero de trame invalide."));
  }

  const cycleWeeks = parseCycleWeeks(formData.get("cycleWeeks"));
  const labelRaw = String(formData.get("templateLabel") ?? "").trim();
  const label = labelRaw || `Trame ${templateNumber}`;
  const cycleDays = normalizeTemplateCycleWeeks(cycleWeeks) * 7;

  const shiftTypes = await prisma.shiftType.findMany({ select: { id: true } });
  const validShiftIds = new Set(shiftTypes.map((s) => s.id));

  const template = await prisma.planningTemplate.upsert({
    where: { teamId_number: { teamId, number: templateNumber } },
    create: {
      teamId,
      number: templateNumber,
      label,
      cycleWeeks: normalizeTemplateCycleWeeks(cycleWeeks),
    },
    update: {
      label,
      cycleWeeks: normalizeTemplateCycleWeeks(cycleWeeks),
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
