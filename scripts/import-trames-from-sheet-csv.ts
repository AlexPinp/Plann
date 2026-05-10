/**
 * Importe des trames depuis un CSV exporté depuis Google Sheets.
 *
 * Disposition attendue (alignée sur la grille du site : pour chaque semaine,
 * 7 colonnes dans l’ordre lundi → dimanche, puis semaine suivante, etc.) :
 *
 * - Par défaut `--leading-cols=0` : une ligne = une trame ; uniquement les
 *   N colonnes de grille (N = cycleWeeks × 7). Numéro de trame = numéro de ligne
 *   dans le fichier (ligne 1 → trame 1…), sauf si --skip-header.
 *
 * - `--leading-cols=2` : col A = numéro de trame, col B = libellé, puis la grille.
 *
 * Usage :
 *   npx tsx scripts/import-trames-from-sheet-csv.ts ./trames.csv ide-jour
 *   npx tsx scripts/import-trames-from-sheet-csv.ts "./mon fichier.csv" ide-jour --cycle-weeks=33
 *   (les guillemets sont obligatoires si le nom du fichier contient des espaces)
 *   npx tsx scripts/import-trames-from-sheet-csv.ts ./trames.csv ide-jour --delimiter=";"
 *
 * Feuille Google : Fichier → Télécharger → Valeurs séparées par des virgules (.csv).
 */
import { config } from "dotenv";
import { existsSync, readFileSync } from "node:fs";
import { join, resolve } from "node:path";
import {
  parseCycleStartDateForImport,
  upsertPlanningTemplateFromCellCodes,
} from "../src/lib/planning-template-import";

config({ path: join(process.cwd(), ".env.local") });
config();

function parseArgv(argv: string[]) {
  const positional: string[] = [];
  const flags = new Map<string, string>();
  for (const a of argv) {
    if (a.startsWith("--")) {
      const eq = a.indexOf("=");
      if (eq === -1) flags.set(a.slice(2), "true");
      else flags.set(a.slice(2, eq), a.slice(eq + 1));
    } else positional.push(a);
  }
  return { positional, flags };
}

/** Parse une ligne CSV simple (guillemets doubles échappés ""). */
function parseCsvLine(line: string, delimiter: string): string[] {
  const out: string[] = [];
  let cur = "";
  let i = 0;
  let inQuotes = false;
  while (i < line.length) {
    const c = line[i]!;
    if (inQuotes) {
      if (c === '"') {
        if (line[i + 1] === '"') {
          cur += '"';
          i += 2;
          continue;
        }
        inQuotes = false;
        i += 1;
        continue;
      }
      cur += c;
      i += 1;
      continue;
    }
    if (c === '"') {
      inQuotes = true;
      i += 1;
      continue;
    }
    if (c === delimiter) {
      out.push(cur.trim());
      cur = "";
      i += 1;
      continue;
    }
    cur += c;
    i += 1;
  }
  out.push(cur.trim());
  return out;
}

function detectDelimiter(firstLine: string): "," | ";" {
  const commas = (firstLine.match(/,/g) ?? []).length;
  const semis = (firstLine.match(/;/g) ?? []).length;
  return semis > commas ? ";" : ",";
}

function normalizeCell(raw: string): string | null {
  const s = raw.trim();
  if (s === "" || s === "-" || s === "—" || s === ".") return null;
  return s;
}

async function main() {
  const { positional, flags } = parseArgv(process.argv.slice(2));
  const csvPath = positional[0]?.trim();
  const teamSlug = positional[1]?.trim();
  if (!csvPath || !teamSlug) {
    console.error(
      "Usage: npx tsx scripts/import-trames-from-sheet-csv.ts <fichier.csv> <teamSlug> [--skip-header] [--cycle-weeks=33] [--leading-cols=0|2] [--delimiter=,|;]",
    );
    console.error('Astuce : si le nom du fichier contient des espaces, utilisez des guillemets : "mon fichier.csv".');
    process.exit(1);
  }

  const csvResolved = resolve(csvPath);
  if (!existsSync(csvResolved)) {
    console.error(`Fichier introuvable : ${csvPath}`);
    console.error(
      'Souvent : le chemin a été coupé aux espaces. Relancez en mettant le fichier entre guillemets, par exemple :\n' +
        `  npx tsx scripts/import-trames-from-sheet-csv.ts ".\\Plann IDE JOUR .csv" ide-jour --cycle-weeks=33`,
    );
    process.exit(1);
  }

  const skipHeader = flags.get("skip-header") === "true";
  const cycleWeeks = Math.floor(Number(flags.get("cycle-weeks") ?? "33"));
  const leadingCols = Math.floor(Number(flags.get("leading-cols") ?? "0"));
  const explicitDelim = flags.get("delimiter");

  if (!Number.isInteger(cycleWeeks) || cycleWeeks < 1 || cycleWeeks > 52) {
    console.error("--cycle-weeks doit être un entier entre 1 et 52.");
    process.exit(1);
  }
  if (leadingCols !== 0 && leadingCols !== 2) {
    console.error("--leading-cols doit être 0 ou 2.");
    process.exit(1);
  }

  const gridCols = cycleWeeks * 7;
  const expectedCols = leadingCols + gridCols;

  const rawFile = readFileSync(csvResolved, "utf8").replace(/^\uFEFF/, "");
  const lines = rawFile.split(/\r?\n/).filter((l) => l.length > 0);
  if (lines.length === 0) {
    console.error("Fichier CSV vide.");
    process.exit(1);
  }

  const delim = (
    explicitDelim === ";" || explicitDelim === "," ? explicitDelim : detectDelimiter(lines[0]!)
  ) as "," | ";";

  const { getTeamBySlug } = await import("../src/lib/team");
  const team = await getTeamBySlug(teamSlug);
  if (!team) {
    console.error(`Équipe introuvable : ${teamSlug}`);
    process.exit(1);
  }

  const { prisma } = await import("../src/lib/prisma");
  const shiftTypes = await prisma.shiftType.findMany({
    where: { teamId: team.id },
    select: { id: true, code: true },
  });
  const codeToId = new Map(shiftTypes.map((s) => [s.code, s.id]));

  const firstPhysicalLine = skipHeader ? 2 : 1;
  const dataLines = skipHeader ? lines.slice(1) : lines;

  for (let i = 0; i < dataLines.length; i += 1) {
    const line = dataLines[i]!;
    const cols = parseCsvLine(line, delim);
    if (cols.length === 1 && cols[0] === "") continue;

    const physicalLine = firstPhysicalLine + i;

    if (cols.length !== expectedCols) {
      console.error(
        `Ligne ${physicalLine} : ${cols.length} colonnes ; attendu ${expectedCols} (${leadingCols} métadonnées + ${gridCols} jours).`,
      );
      process.exit(1);
    }

    let templateNumber: number;
    let label: string;
    let gridStart: number;

    if (leadingCols === 0) {
      templateNumber = i + 1;
      label = `Trame ${templateNumber}`;
      gridStart = 0;
    } else {
      const n = Math.floor(Number(cols[0]));
      templateNumber = Number.isInteger(n) && n >= 1 ? n : i + 1;
      label = (cols[1]?.trim() || `Trame ${templateNumber}`).slice(0, 500);
      gridStart = 2;
    }

    const cells = cols.slice(gridStart, gridStart + gridCols).map(normalizeCell);

    const cycleStartRaw = flags.get("cycle-start-date") ?? null;
    const cycleStartDate =
      cycleStartRaw && cycleStartRaw !== "true"
        ? parseCycleStartDateForImport(cycleStartRaw)
        : null;

    try {
      const { entriesCount } = await upsertPlanningTemplateFromCellCodes(prisma, team.id, {
        number: templateNumber,
        label,
        cycleWeeks,
        cycleStartDate,
        cells,
        codeToId,
      });
      console.log(`Trame ${templateNumber} « ${label} » : ${entriesCount} jour(s) renseigné(s).`);
    } catch (e) {
      console.error(`Ligne ${physicalLine} :`, e instanceof Error ? e.message : e);
      process.exit(1);
    }
  }

  console.log("Import CSV terminé.");
  await prisma.$disconnect();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
