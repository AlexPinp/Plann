/**
 * Crée l’utilisateur Supabase Auth pour test.dev@ght85.fr (mot de passe) et lie authUserId en Prisma.
 * Nécessite SUPABASE_SERVICE_ROLE_KEY dans .env.local (Dashboard Supabase → Paramètres → API → service_role, secret).
 * Usage : npx tsx scripts/ensure-test-dev-auth.ts
 */
import { config } from "dotenv";
import { join } from "node:path";

config({ path: join(process.cwd(), ".env.local") });
config();

const EMAIL = "test.dev@ght85.fr";
const PASSWORD = "test.dev";

async function main() {
  const { createClient } = await import("@supabase/supabase-js");
  const { prisma } = await import("../src/lib/prisma");

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();

  if (!url || !serviceKey) {
    console.error(
      "Définissez NEXT_PUBLIC_SUPABASE_URL et SUPABASE_SERVICE_ROLE_KEY dans .env.local, puis relancez.\n" +
        "Sans ça, exécutez d’abord `npm run db:seed`, puis inscrivez-vous sur /login (même email / mot de passe).",
    );
    process.exit(1);
  }

  const supabase = createClient(url, serviceKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  const agent = await prisma.user.findFirst({
    where: { email: { equals: EMAIL, mode: "insensitive" } },
  });
  if (!agent) {
    console.error("Aucun agent Prisma pour cet email. Lancez d’abord : npm run db:seed");
    process.exit(1);
  }

  const { data: created, error: createError } = await supabase.auth.admin.createUser({
    email: EMAIL,
    password: PASSWORD,
    email_confirm: true,
  });

  let authId = created.user?.id;

  if (createError) {
    const msg = createError.message?.toLowerCase() ?? "";
    if (!msg.includes("registered") && !msg.includes("exists") && !msg.includes("duplicate")) {
      console.error("Supabase :", createError.message);
      process.exit(1);
    }
    const { data: list, error: listError } = await supabase.auth.admin.listUsers({ page: 1, perPage: 200 });
    if (listError) {
      console.error("Liste utilisateurs :", listError.message);
      process.exit(1);
    }
    const u = list.users.find((x) => x.email?.toLowerCase() === EMAIL);
    if (!u) {
      console.error("Compte Supabase introuvable pour", EMAIL);
      process.exit(1);
    }
    authId = u.id;
    const { error: upErr } = await supabase.auth.admin.updateUserById(u.id, {
      password: PASSWORD,
      email_confirm: true,
    });
    if (upErr) {
      console.error("Mise à jour mot de passe :", upErr.message);
      process.exit(1);
    }
    console.log("Compte Supabase existant : mot de passe mis à jour.");
  } else {
    console.log("Compte Supabase créé (email confirmé).");
  }

  if (authId && (!agent.authUserId || agent.authUserId !== authId)) {
    if (agent.authUserId && agent.authUserId !== authId) {
      console.warn(
        "Conflit : authUserId Prisma pointe déjà vers un autre compte. Corrigez la base ou supprimez l’ancien compte Auth.",
      );
    } else {
      await prisma.user.update({
        where: { id: agent.id },
        data: { authUserId: authId },
      });
      console.log("authUserId synchronisé en base.");
    }
  }

  await prisma.$disconnect();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
