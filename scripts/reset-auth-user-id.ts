/**
 * Remet authUserId à null pour un agent (déblocage après changement de projet Supabase / AUTH_CONFLICT).
 * Usage : npx tsx scripts/reset-auth-user-id.ts <email@domaine.fr>
 */
import { config } from "dotenv";
import { join } from "node:path";

config({ path: join(process.cwd(), ".env.local") });
config();

const email = process.argv[2]?.trim().toLowerCase();

async function main() {
  if (!email) {
    console.error("Usage: npx tsx scripts/reset-auth-user-id.ts <email@domaine.fr>");
    process.exit(1);
  }
  const { prisma } = await import("../src/lib/prisma");
  const result = await prisma.user.updateMany({
    where: { email: { equals: email, mode: "insensitive" } },
    data: { authUserId: null },
  });
  if (result.count === 0) {
    console.error(`Aucun utilisateur Prisma pour l'email : ${email}`);
    process.exit(1);
  }
  console.log(`authUserId remis à null pour ${result.count} ligne(s) (${email}).`);
  await prisma.$disconnect();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
