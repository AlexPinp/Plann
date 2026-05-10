/**
 * Importe des trames cycliques depuis un fichier JSON (usage ponctuel).
 *
 * Prérequis : les codes horaires (ShiftType) existent déjà et correspondent aux chaînes du JSON.
 *
 * Usage :
 *   npx tsx scripts/import-planning-templates-from-json.ts scripts/import-trames.example.json
 *
 * Format JSON :
 * - teamSlug : équipe propriétaire (ex. ide-jour)
 * - templates[] :
 *   - number : numéro de trame (1..N)
 *   - label : libellé (optionnel)
 *   - cycleWeeks : durée en semaines (optionnel, défaut 52)
 *   - cycleStartDate : "YYYY-MM-DD" UTC ou absent (ancrage legacy)
 *   - cells : tableau de longueur cycleWeeks × 7, dans l’ordre du site :
 *             semaine 1 [lun..dim], semaine 2 [lun..dim], …
 *             Chaque entrée : code horaire (string) ou null pour case vide.
 */
import { config } from "dotenv";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { normalizeTemplateCycleWeeks } from "../src/lib/planning-template";
import {
  parseCycleStartDateForImport,
  upsertPlanningTemplateFromCellCodes,
} from "../src/lib/planning-template-import";
import { getTeamBySlug } from "../src/lib/team";

config({ path: join(process.cwd(), ".env.local") });
config();

type TemplateJson = {
  number: number;
  label?: string;
  cycleWeeks?: number;
  cycleStartDate?: string | null;
  cells: (string | null)[];
};

type FileJson = {
  teamSlug: string;
  templates: TemplateJson[];
};

async function main() {
  const filePath = process.argv[2]?.trim();
  if (!filePath) {
    console.error("Usage: npx tsx scripts/import-planning-templates-from-json.ts <fichier.json>");
    process.exit(1);
  }

  const raw = readFileSync(filePath, "utf8");
  const data = JSON.parse(raw) as FileJson;
  if (!data.teamSlug || !Array.isArray(data.templates)) {
    console.error("JSON invalide : teamSlug et templates[] requis.");
    process.exit(1);
  }

  const team = await getTeamBySlug(data.teamSlug);
  if (!team) {
    console.error(`Équipe introuvable pour le slug : ${data.teamSlug}`);
    process.exit(1);
  }

  const { prisma } = await import("../src/lib/prisma");
  const shiftTypes = await prisma.shiftType.findMany({
    where: { teamId: team.id },
    select: { id: true, code: true },
  });
  const codeToId = new Map(shiftTypes.map((s) => [s.code, s.id]));

  for (const t of data.templates) {
    const num = Math.floor(Number(t.number));
    if (!Number.isInteger(num) || num < 1) {
      console.error(`Numéro de trame invalide : ${JSON.stringify(t.number)}`);
      process.exit(1);
    }

    const cycleWeeks = normalizeTemplateCycleWeeks(t.cycleWeeks ?? undefined);
    const expectedLen = cycleWeeks * 7;
    if (!Array.isArray(t.cells) || t.cells.length !== expectedLen) {
      console.error(
        `Trame ${num} : cells doit avoir ${expectedLen} entrées (${cycleWeeks} sem. × 7 jours), reçu ${t.cells?.length ?? 0}.`,
      );
      process.exit(1);
    }

    const cycleStartDate = parseCycleStartDateForImport(t.cycleStartDate ?? null);
    const label = (t.label?.trim() || `Trame ${num}`).slice(0, 500);

    try {
      const { entriesCount } = await upsertPlanningTemplateFromCellCodes(prisma, team.id, {
        number: num,
        label,
        cycleWeeks,
        cycleStartDate,
        cells: t.cells,
        codeToId,
      });
      console.log(`Trame ${num} « ${label} » : ${entriesCount} jour(s) renseigné(s).`);
    } catch (e) {
      console.error(`Trame ${num} :`, e instanceof Error ? e.message : e);
      process.exit(1);
    }
  }

  console.log("Import terminé.");
  await prisma.$disconnect();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
