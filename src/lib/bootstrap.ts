import { prisma } from "@/lib/prisma";
import { ShiftCategory, TeamJob, TeamRhythm, UserRole } from "@/generated/prisma/enums";
import { DEFAULT_TEMPLATE_CYCLE_WEEKS } from "@/lib/planning-template";

/** Équipes de référence du service. Les slugs sont utilisés dans les URLs et
 *  doivent rester stables ; les ids sont déterministes pour aligner seed et migration. */
const TEAM_DEFINITIONS = [
  { id: "team_ide_jour", slug: "ide-jour", label: "Infirmiers de jour",      job: TeamJob.IDE, rhythm: TeamRhythm.JOUR, color: "#bbf7d0", displayOrder: 0 },
  { id: "team_ide_nuit", slug: "ide-nuit", label: "Infirmiers de nuit",      job: TeamJob.IDE, rhythm: TeamRhythm.NUIT, color: "#c7d2fe", displayOrder: 1 },
  { id: "team_as_jour",  slug: "as-jour",  label: "Aides-soignants de jour", job: TeamJob.AS,  rhythm: TeamRhythm.JOUR, color: "#fde68a", displayOrder: 2 },
  { id: "team_as_nuit",  slug: "as-nuit",  label: "Aides-soignants de nuit", job: TeamJob.AS,  rhythm: TeamRhythm.NUIT, color: "#fbcfe8", displayOrder: 3 },
] as const;

const DEFAULT_TEAM_SLUG = "ide-jour";

export async function ensureBaselineData() {
  await prisma.team.createMany({
    data: TEAM_DEFINITIONS.map((t) => ({ ...t })),
    skipDuplicates: true,
  });

  const defaultTeam = await prisma.team.findUniqueOrThrow({ where: { slug: DEFAULT_TEAM_SLUG } });

  const [shiftCount, userCount, skillCount] = await Promise.all([
    prisma.shiftType.count(),
    prisma.user.count(),
    prisma.skill.count(),
  ]);

  if (skillCount === 0) {
    await prisma.skill.createMany({
      data: [{ name: "CMC + UDOM" }, { name: "SAUV" }, { name: "GYPSO" }, { name: "IOA" }],
      skipDuplicates: true,
    });
  }

  /* Trames de base uniquement pour l'équipe par défaut (IDE jour).
   * Les autres équipes partiront d'une liste vide et les cadres créeront
   * leurs propres trames avec la durée de cycle qui leur convient. */
  await prisma.planningTemplate.createMany({
    data: Array.from({ length: 33 }, (_, i) => ({
      teamId: defaultTeam.id,
      number: i + 1,
      label: `Trame ${i + 1}`,
      cycleWeeks: DEFAULT_TEMPLATE_CYCLE_WEEKS,
    })),
    skipDuplicates: true,
  });

  /* Injection des codes uniquement sur base vide, pour ne pas recréer un code supprimé volontairement. */
  if (shiftCount === 0) {
    await prisma.shiftType.createMany({
      data: [
        { code: "J10", label: "JOUR 10H", color: "#dbeafe", startsAt: "08:30", endsAt: "18:30", category: ShiftCategory.JOUR },
        { code: "J12", label: "JOUR 12H", color: "#fef3c7", startsAt: "07:00", endsAt: "19:00", category: ShiftCategory.JOUR },
        { code: "N", label: "Nuit", color: "#e0e7ff", startsAt: "19:00", endsAt: "07:00", category: ShiftCategory.NUIT },
        { code: "RTT", label: "RTT", color: "#e5e7eb", startsAt: "09:00", endsAt: "17:00", category: ShiftCategory.JOUR },
        { code: "RCJ", label: "RCJ", color: "#e5e7eb", startsAt: "08:30", endsAt: "18:30", category: ShiftCategory.JOUR },
        { code: "JCD", label: "JCD", color: "#bae6fd", startsAt: "08:30", endsAt: "18:30", category: ShiftCategory.JOUR },
        { code: "JO1", label: "JO1", color: "#bae6fd", startsAt: "07:00", endsAt: "19:00", category: ShiftCategory.JOUR },
        { code: "JO2", label: "JO2", color: "#bae6fd", startsAt: "07:00", endsAt: "19:00", category: ShiftCategory.JOUR },
        { code: "JM1", label: "JM1", color: "#bae6fd", startsAt: "07:00", endsAt: "19:00", category: ShiftCategory.JOUR },
        { code: "JM2", label: "JM2", color: "#bae6fd", startsAt: "07:00", endsAt: "19:00", category: ShiftCategory.JOUR },
        { code: "JM3", label: "JM3", color: "#bae6fd", startsAt: "07:00", endsAt: "19:00", category: ShiftCategory.JOUR },
        { code: "JM4", label: "JM4", color: "#bae6fd", startsAt: "08:30", endsAt: "18:30", category: ShiftCategory.JOUR },
        { code: "JH1", label: "JH1", color: "#ccfbf1", startsAt: "07:00", endsAt: "19:00", category: ShiftCategory.JOUR },
        { code: "JH2", label: "JH2", color: "#ccfbf1", startsAt: "08:30", endsAt: "18:30", category: ShiftCategory.JOUR },
        { code: "JG1", label: "JG1", color: "#bbf7d0", startsAt: "08:30", endsAt: "18:30", category: ShiftCategory.JOUR },
        { code: "JG2", label: "JG2", color: "#bbf7d0", startsAt: "09:00", endsAt: "19:00", category: ShiftCategory.JOUR },
        { code: "CA", label: "CA", color: "#fef08a", startsAt: "00:00", endsAt: "23:59", category: ShiftCategory.JOUR },
        { code: "CP", label: "CP", color: "#fef08a", startsAt: "00:00", endsAt: "23:59", category: ShiftCategory.JOUR },
        { code: "NA", label: "NA", color: "#fecaca", startsAt: "19:00", endsAt: "07:00", category: ShiftCategory.NUIT },
        { code: "RPJ", label: "RPJ", color: "#fed7aa", startsAt: "08:30", endsAt: "18:30", category: ShiftCategory.JOUR },
        { code: "SSU", label: "SSU", color: "#ddd6fe", startsAt: "07:00", endsAt: "19:00", category: ShiftCategory.JOUR },
        { code: "JF", label: "JF", color: "#e5e7eb", startsAt: "09:00", endsAt: "17:00", category: ShiftCategory.JOUR },
      ],
      skipDuplicates: true,
    });
  }

  if (userCount === 0) {
    await prisma.user.createMany({
      data: [
        {
          firstName: "Alexandre",
          lastName: "Genaudeau",
          email: "alexandre.genaudeau@ght85.fr",
          role: UserRole.REFERENT,
          workPercentage: 100,
          planningGroupLabel: "Bloc jour",
          planningGroupColor: "#d1fae5",
          displayOrder: 0,
        },
        {
          firstName: "Admin",
          lastName: "Admin",
          email: "admin.admin@ght85.fr",
          role: UserRole.ADMIN,
          workPercentage: 100,
          planningGroupLabel: "Bloc complementaire",
          planningGroupColor: "#fce7f3",
          displayOrder: 0,
        },
        {
          firstName: "Test",
          lastName: "Dev",
          email: "test.dev@ght85.fr",
          role: UserRole.REFERENT,
          workPercentage: 100,
          planningGroupLabel: "Bloc jour",
          planningGroupColor: "#d1fae5",
          displayOrder: 0,
        },
      ],
      skipDuplicates: true,
    });
  }

  /* Compte de développement (email test.dev@ght85.fr) — mot de passe côté Supabase (inscription UI ou script auth:test-dev) */
  {
    const email = "test.dev@ght85.fr";
    const existing = await prisma.user.findFirst({
      where: { email: { equals: email, mode: "insensitive" } },
    });
    if (!existing) {
      await prisma.user.create({
        data: {
          firstName: "Test",
          lastName: "Dev",
          email,
          role: UserRole.ADMIN,
          workPercentage: 100,
          planningGroupLabel: "Dev",
          planningGroupColor: "#e2e8f0",
          displayOrder: 999,
        },
      });
    }
  }

  /* Au moins un administrateur (bases déjà peuplées sans rôle ADMIN) */
  const adminCount = await prisma.user.count({ where: { role: UserRole.ADMIN } });
  if (adminCount === 0) {
    const first = await prisma.user.findFirst({ orderBy: [{ createdAt: "asc" }] });
    if (first) {
      await prisma.user.update({ where: { id: first.id }, data: { role: UserRole.ADMIN } });
    }
  }

  /* Attribuer un bloc par défaut aux utilisateurs existants sans groupe */
  const usersNoGroup = await prisma.user.findMany({
    where: { planningGroupLabel: null, active: true },
    orderBy: [{ createdAt: "asc" }],
  });
  const palette = ["#d1fae5", "#fce7f3", "#ffedd5", "#dbeafe"];
  let idx = 0;
  for (const u of usersNoGroup) {
    await prisma.user.update({
      where: { id: u.id },
      data: {
        planningGroupLabel: `Equipe ${idx + 1}`,
        planningGroupColor: palette[idx % palette.length],
        displayOrder: idx,
      },
    });
    idx += 1;
  }

  /* Assurer qu'à terme chaque utilisateur est rattaché à au moins une équipe.
   * Par défaut : IDE jour (équipe historique) en équipe primaire, en recopiant
   * les champs de planning portés jusqu'ici sur User pour ne rien perdre. */
  const usersNoTeam = await prisma.user.findMany({
    where: { teams: { none: {} } },
    orderBy: [{ createdAt: "asc" }],
  });
  if (usersNoTeam.length > 0) {
    await prisma.userTeam.createMany({
      data: usersNoTeam.map((u) => ({
        userId: u.id,
        teamId: defaultTeam.id,
        roleInTeam: u.role,
        isPrimary: true,
        planningGroupLabel: u.planningGroupLabel,
        planningGroupColor: u.planningGroupColor,
        displayOrder: u.displayOrder,
        planningTemplateNumber: u.planningTemplateNumber,
        planningTemplateNumberA: u.planningTemplateNumberA,
        planningTemplateNumberB: u.planningTemplateNumberB,
        planningGroupLabelA: u.planningGroupLabelA,
        planningGroupLabelB: u.planningGroupLabelB,
      })),
      skipDuplicates: true,
    });
  }
}
