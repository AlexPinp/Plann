import type { PrismaClient } from "@/generated/prisma/client";
import { normalizeTemplateCycleWeeks } from "@/lib/planning-template";

export function parseCycleStartDateForImport(s: string | null | undefined): Date | null {
  if (s == null || String(s).trim() === "") return null;
  const parts = String(s).split("-").map(Number);
  if (parts.length !== 3 || parts.some((n) => Number.isNaN(n))) return null;
  const [y, mo, d] = parts;
  if (!Number.isInteger(y) || !Number.isInteger(mo) || !Number.isInteger(d)) return null;
  if (mo < 1 || mo > 12 || d < 1 || d > 31) return null;
  const dt = new Date(Date.UTC(y, mo - 1, d, 12, 0, 0, 0));
  if (dt.getUTCFullYear() !== y || dt.getUTCMonth() + 1 !== mo || dt.getUTCDate() !== d) return null;
  return dt;
}

/** Upsert une trame et ses entrées à partir de codes horaires (cases vides ignorées). */
export async function upsertPlanningTemplateFromCellCodes(
  prisma: PrismaClient,
  teamId: string,
  params: {
    number: number;
    label: string;
    cycleWeeks: number;
    cycleStartDate: Date | null;
    cells: (string | null | undefined)[];
    codeToId: Map<string, string>;
  },
): Promise<{ entriesCount: number }> {
  const { number: num, label, cycleStartDate, codeToId } = params;
  const cycleWeeks = normalizeTemplateCycleWeeks(params.cycleWeeks);
  const expectedLen = cycleWeeks * 7;
  if (params.cells.length !== expectedLen) {
    throw new Error(
      `Trame ${num} : attendu ${expectedLen} cases (${cycleWeeks} sem. × 7), reçu ${params.cells.length}.`,
    );
  }

  const unknownCodes = new Set<string>();
  const entries: { dayOffset: number; shiftTypeId: string }[] = [];
  for (let dayOffset = 0; dayOffset < expectedLen; dayOffset += 1) {
    const cell = params.cells[dayOffset];
    if (cell == null || String(cell).trim() === "") continue;
    const code = String(cell).trim();
    const id = codeToId.get(code);
    if (!id) unknownCodes.add(code);
    else entries.push({ dayOffset, shiftTypeId: id });
  }
  if (unknownCodes.size > 0) {
    throw new Error(
      `Trame ${num} : codes inconnus (Codes horaires) : ${[...unknownCodes].sort().join(", ")}`,
    );
  }

  const template = await prisma.planningTemplate.upsert({
    where: { teamId_number: { teamId, number: num } },
    create: {
      teamId,
      number: num,
      label: label.slice(0, 500),
      cycleWeeks,
      cycleStartDate,
    },
    update: { label: label.slice(0, 500), cycleWeeks, cycleStartDate },
    select: { id: true },
  });

  await prisma.$transaction([
    prisma.planningTemplateEntry.deleteMany({ where: { templateId: template.id } }),
    ...(entries.length
      ? [
          prisma.planningTemplateEntry.createMany({
            data: entries.map((e) => ({
              templateId: template.id,
              dayOffset: e.dayOffset,
              shiftTypeId: e.shiftTypeId,
            })),
            skipDuplicates: true,
          }),
        ]
      : []),
  ]);

  return { entriesCount: entries.length };
}
