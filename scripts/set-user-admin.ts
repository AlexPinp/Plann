/**
 * Met un utilisateur en ADMIN (rôle global + roleInTeam sur toutes ses équipes).
 * Usage : npx tsx scripts/set-user-admin.ts [email]
 */
import { config } from "dotenv";
import { join } from "node:path";

config({ path: join(process.cwd(), ".env.local") });
config();

const EMAIL = process.argv[2]?.trim() || "alexandre.genaudeau@ght85.fr";

async function main() {
  const { prisma } = await import("../src/lib/prisma");
  const { UserRole } = await import("../src/generated/prisma/enums");

  const user = await prisma.user.findFirst({
    where: {
      OR: [
        { email: { equals: EMAIL, mode: "insensitive" } },
        {
          AND: [
            { firstName: { equals: "Alexandre", mode: "insensitive" } },
            { lastName: { equals: "Genaudeau", mode: "insensitive" } },
          ],
        },
      ],
    },
    include: { teams: { include: { team: { select: { slug: true, label: true } } } } },
  });

  if (!user) {
    console.error(`Utilisateur introuvable (${EMAIL}).`);
    process.exit(1);
  }

  const updated = await prisma.user.update({
    where: { id: user.id },
    data: { role: UserRole.ADMIN },
  });

  const memberships = await prisma.userTeam.updateMany({
    where: { userId: user.id },
    data: { roleInTeam: UserRole.ADMIN },
  });

  console.log(
    `OK: ${updated.firstName} ${updated.lastName} <${updated.email}> — rôle global ADMIN (${memberships.count} équipe(s) mises à jour).`,
  );
  for (const ut of user.teams) {
    console.log(`  · ${ut.team.label} (${ut.team.slug})`);
  }
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    const { prisma } = await import("../src/lib/prisma");
    await prisma.$disconnect();
  });
