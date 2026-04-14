import { prisma } from "@/lib/prisma";

export type LinkAuthResult =
  | { ok: true }
  | { ok: false; code: "NO_AGENT" | "INACTIVE" | "AUTH_CONFLICT" };

/**
 * Associe la session Supabase à la ligne `User` Prisma (même email pro, agent actif).
 * Met à jour `authUserId` si encore vide ; refuse si un autre compte Auth est déjà lié.
 */
export async function linkAuthToPrismaUser(authUserId: string, email: string): Promise<LinkAuthResult> {
  const normalized = email.trim().toLowerCase();

  const agent = await prisma.user.findFirst({
    where: {
      email: { equals: normalized, mode: "insensitive" },
    },
  });

  if (!agent) return { ok: false, code: "NO_AGENT" };
  if (!agent.active) return { ok: false, code: "INACTIVE" };

  if (agent.authUserId && agent.authUserId !== authUserId) {
    return { ok: false, code: "AUTH_CONFLICT" };
  }

  if (!agent.authUserId) {
    await prisma.user.update({
      where: { id: agent.id },
      data: { authUserId },
    });
  }

  return { ok: true };
}

export function messageForLinkFailure(code: "NO_AGENT" | "INACTIVE" | "AUTH_CONFLICT"): string {
  switch (code) {
    case "NO_AGENT":
      return "Aucun agent enregistré avec cette adresse email. Contactez votre cadre.";
    case "INACTIVE":
      return "Ce compte agent est désactivé. Contactez votre cadre.";
    case "AUTH_CONFLICT":
      return "Ce profil agent est déjà associé à un autre compte de connexion.";
    default:
      return "Connexion refusée.";
  }
}
