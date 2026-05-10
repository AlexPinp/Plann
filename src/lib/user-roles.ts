import { UserRole } from "@/generated/prisma/enums";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { getSessionPrismaUser } from "@/lib/current-user";

/** Rôles autorisés à modifier le planning, gérer les agents (panneau admin) et les compétences. */
export const PLANNING_AND_STAFF_ROLES: UserRole[] = [UserRole.ADMIN, UserRole.CADRE, UserRole.REFERENT];

export function canEditPlanningAndStaff(role: UserRole | undefined | null): boolean {
  if (!role) return false;
  return PLANNING_AND_STAFF_ROLES.includes(role);
}

/** Peut-il modifier planning/staff dans UNE équipe donnée ?
 *  - ADMIN global : oui, partout
 *  - sinon, il faut être CADRE / REFERENT / ADMIN dans son `UserTeam` */
export function canEditPlanningAndStaffForTeam(
  globalRole: UserRole | undefined | null,
  teamRole: UserRole | undefined | null,
): boolean {
  if (globalRole === UserRole.ADMIN) return true;
  return canEditPlanningAndStaff(teamRole);
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

/** Scope qu'on peut voir/modifier côté admin :
 *  - ADMIN, CADRE, REFERENT globaux : toutes les équipes (mêmes droits globaux).
 *  - Autres : uniquement les équipes dont ils sont membres avec roleInTeam ∈ staff.
 *  Renvoie la liste des teamIds autorisés. */
export async function getEditableTeamIds(userId: string, globalRole: UserRole): Promise<string[]> {
  if (PLANNING_AND_STAFF_ROLES.includes(globalRole)) {
    const teams = await prisma.team.findMany({ select: { id: true } });
    return teams.map((t) => t.id);
  }
  const memberships = await prisma.userTeam.findMany({
    where: { userId, roleInTeam: { in: PLANNING_AND_STAFF_ROLES } },
    select: { teamId: true },
  });
  return memberships.map((m) => m.teamId);
}

export const roleLabelsFr: Record<UserRole, string> = {
  [UserRole.AGENT]: "Agent",
  [UserRole.CADRE]: "Cadre",
  [UserRole.REFERENT]: "Référent",
  [UserRole.ADMIN]: "Administrateur",
};
