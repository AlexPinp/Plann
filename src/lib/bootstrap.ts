import { prisma } from "@/lib/prisma";
import { ShiftCategory, UserRole } from "@/generated/prisma/enums";

export async function ensureBaselineData() {
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

  await prisma.planningTemplate.createMany({
    data: Array.from({ length: 33 }, (_, i) => ({ number: i + 1 })),
    skipDuplicates: true,
  });

  /* Injection des codes uniquement sur base vide, pour ne pas recréer un code supprimé volontairement. */
  if (shiftCount === 0) {
    await prisma.shiftType.createMany({
      data: [
        { code: "J10", label: "JOUR 10H", color: "#dbeafe", startsAt: "08:30", endsAt: "18:30", category: ShiftCategory.JOUR10 },
        { code: "J12", label: "JOUR 12H", color: "#fef3c7", startsAt: "07:00", endsAt: "19:00", category: ShiftCategory.JOUR12 },
        { code: "N", label: "Nuit", color: "#e0e7ff", startsAt: "19:00", endsAt: "07:00", category: ShiftCategory.NUIT },
        { code: "RTT", label: "RTT", color: "#e5e7eb", startsAt: "09:00", endsAt: "17:00", category: ShiftCategory.JOUR12 },
        { code: "RCJ", label: "RCJ", color: "#e5e7eb", startsAt: "08:30", endsAt: "18:30", category: ShiftCategory.JOUR10 },
        { code: "JCD", label: "JCD", color: "#bae6fd", startsAt: "08:30", endsAt: "18:30", category: ShiftCategory.JOUR10 },
        { code: "JO1", label: "JO1", color: "#bae6fd", startsAt: "07:00", endsAt: "19:00", category: ShiftCategory.JOUR12 },
        { code: "JO2", label: "JO2", color: "#bae6fd", startsAt: "07:00", endsAt: "19:00", category: ShiftCategory.JOUR12 },
        { code: "JM1", label: "JM1", color: "#bae6fd", startsAt: "07:00", endsAt: "19:00", category: ShiftCategory.JOUR12 },
        { code: "JM2", label: "JM2", color: "#bae6fd", startsAt: "07:00", endsAt: "19:00", category: ShiftCategory.JOUR12 },
        { code: "JM3", label: "JM3", color: "#bae6fd", startsAt: "07:00", endsAt: "19:00", category: ShiftCategory.JOUR12 },
        { code: "JM4", label: "JM4", color: "#bae6fd", startsAt: "08:30", endsAt: "18:30", category: ShiftCategory.JOUR10 },
        { code: "JH1", label: "JH1", color: "#ccfbf1", startsAt: "07:00", endsAt: "19:00", category: ShiftCategory.JOUR12 },
        { code: "JH2", label: "JH2", color: "#ccfbf1", startsAt: "08:30", endsAt: "18:30", category: ShiftCategory.JOUR10 },
        { code: "JG1", label: "JG1", color: "#bbf7d0", startsAt: "08:30", endsAt: "18:30", category: ShiftCategory.JOUR10 },
        { code: "JG2", label: "JG2", color: "#bbf7d0", startsAt: "09:00", endsAt: "19:00", category: ShiftCategory.JOUR10 },
        { code: "CA", label: "CA", color: "#fef08a", startsAt: "00:00", endsAt: "23:59", category: ShiftCategory.JOUR10 },
        { code: "CP", label: "CP", color: "#fef08a", startsAt: "00:00", endsAt: "23:59", category: ShiftCategory.JOUR10 },
        { code: "NA", label: "NA", color: "#fecaca", startsAt: "19:00", endsAt: "07:00", category: ShiftCategory.NUIT },
        { code: "RPJ", label: "RPJ", color: "#fed7aa", startsAt: "08:30", endsAt: "18:30", category: ShiftCategory.JOUR10 },
        { code: "SSU", label: "SSU", color: "#ddd6fe", startsAt: "07:00", endsAt: "19:00", category: ShiftCategory.JOUR10 },
        { code: "JF", label: "JF", color: "#e5e7eb", startsAt: "09:00", endsAt: "17:00", category: ShiftCategory.JOUR10 },
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
      ],
      skipDuplicates: true,
    });
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
}
