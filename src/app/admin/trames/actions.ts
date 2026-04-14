"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { TEMPLATE_CYCLE_DAYS } from "@/lib/planning-template";
import { requireStaffAdmin } from "@/lib/require-staff-admin";

function parseTemplateNumber(raw: FormDataEntryValue | null): number | null {
  const n = Number(String(raw ?? ""));
  if (!Number.isInteger(n) || n < 1) return null;
  return n;
}

export async function savePlanningTemplate(formData: FormData) {
  await requireStaffAdmin();

  const templateNumber = parseTemplateNumber(formData.get("templateNumber"));
  if (!templateNumber) {
    redirect("/admin/trames?error=" + encodeURIComponent("Numero de trame invalide."));
  }

  const shiftTypes = await prisma.shiftType.findMany({ select: { id: true } });
  const validShiftIds = new Set(shiftTypes.map((s) => s.id));

  const template = await prisma.planningTemplate.upsert({
    where: { number: templateNumber },
    create: { number: templateNumber },
    update: {},
    select: { id: true },
  });

  const entriesToCreate: { templateId: string; dayOffset: number; shiftTypeId: string }[] = [];
  for (let dayOffset = 0; dayOffset < TEMPLATE_CYCLE_DAYS; dayOffset += 1) {
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

  revalidatePath("/admin/trames");
  revalidatePath("/admin/agents");
  revalidatePath("/admin/planning");
  revalidatePath("/planning/admin");
  revalidatePath("/planning-equipe");
  revalidatePath("/planning-moi");
  redirect(`/admin/trames?template=${templateNumber}&saved=1`);
}
