import { UserRole } from "@/generated/prisma/enums";
import { redirect } from "next/navigation";
import { getSessionPrismaUser } from "@/lib/current-user";

/** Rôles autorisés à modifier le planning, gérer les agents (panneau admin) et les compétences. */
export const PLANNING_AND_STAFF_ROLES: UserRole[] = [UserRole.ADMIN, UserRole.CADRE, UserRole.REFERENT];

export function canEditPlanningAndStaff(role: UserRole | undefined | null): boolean {
  if (!role) return false;
  return PLANNING_AND_STAFF_ROLES.includes(role);
}

/** Refus d’accès au planning en écriture ou au panneau admin — redirige vers l’accueil. */
export async function requirePlanningAndStaffAccess() {
  const agent = await getSessionPrismaUser();
  if (!agent || !canEditPlanningAndStaff(agent.role)) {
    redirect(
      "/?notice=" +
        encodeURIComponent(
          "Accès réservé aux cadres, référents et administrateurs pour cette fonctionnalité.",
        ),
    );
  }
  return agent;
}

export const roleLabelsFr: Record<UserRole, string> = {
  [UserRole.AGENT]: "Agent (lecture seule)",
  [UserRole.CADRE]: "Cadre",
  [UserRole.REFERENT]: "Référent",
  [UserRole.ADMIN]: "Administrateur",
};
