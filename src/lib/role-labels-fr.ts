import { UserRole } from "@/generated/prisma/enums";

/** Libellés français des rôles — module sans dépendance serveur (safe pour les Client Components). */
export const roleLabelsFr: Record<UserRole, string> = {
  [UserRole.AGENT]: "Agent",
  [UserRole.CADRE]: "Cadre",
  [UserRole.REFERENT]: "Référent",
  [UserRole.ADMIN]: "Administrateur",
};
