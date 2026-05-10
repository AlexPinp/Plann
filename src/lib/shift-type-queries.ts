import type { ShiftType } from "@/generated/prisma/client";
import { Prisma } from "@/generated/prisma/client";
import { ShiftCategory } from "@/generated/prisma/enums";
import { prisma } from "@/lib/prisma";

function normalizeShiftCategoryFromDb(value: string): ShiftCategory {
  return value === ShiftCategory.NUIT ? ShiftCategory.NUIT : ShiftCategory.JOUR;
}

function isUnknownShiftCategoryEnumError(error: unknown): boolean {
  const message = error instanceof Error ? error.message : String(error);
  return message.includes("ShiftCategory") && message.includes("Value");
}

/**
 * Codes horaires d'une équipe, triés par code.
 * Si Postgres contient encore des libellés d'enum absents du client Prisma,
 * lecture via SQL brut et normalisation vers JOUR / NUIT.
 */
export async function findManyShiftTypesOrdered(teamId: string): Promise<{
  shifts: ShiftType[];
  usedLegacyCategoryFallback: boolean;
}> {
  try {
    const shifts = await prisma.shiftType.findMany({
      where: { teamId },
      orderBy: { code: "asc" },
    });
    return { shifts, usedLegacyCategoryFallback: false };
  } catch (error) {
    if (!isUnknownShiftCategoryEnumError(error)) throw error;

    type Raw = {
      id: string;
      teamId: string;
      code: string;
      label: string;
      color: string;
      startsAt: string;
      endsAt: string;
      category: string;
      createdAt: Date;
      updatedAt: Date;
    };

    const rows = await prisma.$queryRaw<Raw[]>(Prisma.sql`
      SELECT
        "id",
        "teamId",
        "code",
        "label",
        "color",
        "startsAt",
        "endsAt",
        "category"::text AS "category",
        "createdAt",
        "updatedAt"
      FROM "ShiftType"
      WHERE "teamId" = ${teamId}
      ORDER BY "code" ASC
    `);

    const shifts: ShiftType[] = rows.map((r) => ({
      ...r,
      category: normalizeShiftCategoryFromDb(r.category),
    }));

    return { shifts, usedLegacyCategoryFallback: true };
  }
}

/** Carte code → id pour une équipe (imports JSON / CSV de trames). */
export async function getShiftCodeToIdMapForTeam(teamId: string): Promise<Map<string, string>> {
  const rows = await prisma.shiftType.findMany({
    where: { teamId },
    select: { id: true, code: true },
  });
  return new Map(rows.map((r) => [r.code, r.id]));
}
