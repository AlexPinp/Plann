/**
 * Postes (codes horaires) autorisés par profil de compétence secteur.
 * Les libellés doivent correspondre aux entrées `Skill.name` en base (seed bootstrap).
 */
export const SKILL_ALLOWED_SHIFT_CODES: Record<string, readonly string[]> = {
  "CMC + UDOM": ["JM1", "JM2", "JM3", "JH1", "JH2", "JG2"],
  SAUV: ["JM1", "JM2", "JM3", "JM4", "JH1", "JH2", "JG2", "JS"],
  GYPSO: ["JM1", "JM2", "JM3", "JM4", "JH1", "JH2", "JG1", "JG2", "JS"],
  IOA: ["JM1", "JM2", "JM3", "JM4", "JH1", "JH2", "JG1", "JG2", "JS", "JO1", "JO2", "JCD"],
};

/** Codes pour lesquels on contrôle la cohérence agent ↔ secteur. */
export const ALL_TRACKED_SECTOR_SHIFT_CODES = new Set(
  Object.values(SKILL_ALLOWED_SHIFT_CODES).flat(),
);

export type SectorCompetenceViolation = {
  userId: string;
  userDisplayName: string;
  dateKey: string;
  shiftCode: string;
  userSkillsLabel: string;
};

function allowedCodesForSkillNames(skillNames: string[]): Set<string> {
  const out = new Set<string>();
  for (const name of skillNames) {
    const key = name.trim();
    const allowed = SKILL_ALLOWED_SHIFT_CODES[key];
    if (allowed) {
      for (const c of allowed) out.add(c);
    }
  }
  return out;
}

/**
 * Détecte les affectations sur un poste secteur alors que le libellé des compétences de l'agent
 * n'autorise pas ce code.
 *
 * — Ignore les agents sans compétence enregistrée (pas de signal RH).
 * — Ignore les agents dont aucune compétence ne correspond aux clés connues ci-dessus.
 * — Ignore les codes hors périmètre secteur (CA, RTT, garde, etc.).
 */
export function collectSectorCompetenceViolations(params: {
  days: { key: string }[];
  members: {
    userId: string;
    lastName: string;
    firstName: string;
    skillNames: string[];
  }[];
  cellShiftByKey: Record<string, string>;
  templateShiftByUserAndDate: Record<string, string>;
  shiftIdToCode: Map<string, string>;
}): SectorCompetenceViolation[] {
  const violations: SectorCompetenceViolation[] = [];

  for (const mem of params.members) {
    const skillNames = mem.skillNames;
    if (skillNames.length === 0) continue;

    const allowed = allowedCodesForSkillNames(skillNames);
    if (allowed.size === 0) continue;

    for (const day of params.days) {
      const k = `${mem.userId}|${day.key}`;
      const shiftId = params.cellShiftByKey[k] ?? params.templateShiftByUserAndDate[k];
      if (!shiftId) continue;

      const code = params.shiftIdToCode.get(shiftId);
      if (!code || !ALL_TRACKED_SECTOR_SHIFT_CODES.has(code)) continue;

      if (!allowed.has(code)) {
        violations.push({
          userId: mem.userId,
          userDisplayName: `${mem.lastName.toUpperCase()} ${mem.firstName}`,
          dateKey: day.key,
          shiftCode: code,
          userSkillsLabel: skillNames.slice().sort((a, b) => a.localeCompare(b, "fr")).join(", "),
        });
      }
    }
  }

  violations.sort((a, b) => {
    const dk = a.dateKey.localeCompare(b.dateKey);
    if (dk !== 0) return dk;
    return a.userDisplayName.localeCompare(b.userDisplayName, "fr");
  });

  return violations;
}
