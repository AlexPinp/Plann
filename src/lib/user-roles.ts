import { UserRole } from "@/generated/prisma/enums";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { getSessionPrismaUser } from "@/lib/current-user";

export { roleLabelsFr } from "@/lib/role-labels-fr";

/** Rôles autorisés à modifier le planning, gérer les agents (panneau admin) et les compétences. */
export const PLANNING_AND_STAFF_ROLES: UserRole[] = [UserRole.ADMIN, UserRole.CADRE, UserRole.REFERENT];

/** Rôles globaux avec accès à toutes les équipes (sans appartenance UserTeam). */
export const GLOBAL_ROLES_ALL_TEAMS: UserRole[] = [UserRole.ADMIN, UserRole.CADRE];

export function hasAccessToAllTeams(globalRole: UserRole | undefined | null): boolean {
  if (!globalRole) return false;
  return GLOBAL_ROLES_ALL_TEAMS.includes(globalRole);
}

export function canEditPlanningAndStaff(role: UserRole | undefined | null): boolean {
  if (!role) return false;
  return PLANNING_AND_STAFF_ROLES.includes(role);
}

/** Peut-il modifier planning/staff dans UNE équipe donnée ?
 *  - ADMIN / CADRE globaux : oui, partout
 *  - sinon, il faut être CADRE / REFERENT / ADMIN dans son `UserTeam` */
export function canEditPlanningAndStaffForTeam(
  globalRole: UserRole | undefined | null,
  teamRole: UserRole | undefined | null,
): boolean {
  if (hasAccessToAllTeams(globalRole)) return true;
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
 *  - ADMIN / CADRE globaux : toutes les équipes.
 *  - REFERENT global : équipes où il est membre (attributions UserTeam).
 *  - Autres : équipes avec roleInTeam ∈ staff.
 *  Renvoie la liste des teamIds autorisés. */
export async function getEditableTeamIds(userId: string, globalRole: UserRole): Promise<string[]> {
  if (hasAccessToAllTeams(globalRole)) {
    const teams = await prisma.team.findMany({ select: { id: true } });
    return teams.map((t) => t.id);
  }
  if (globalRole === UserRole.REFERENT) {
    const memberships = await prisma.userTeam.findMany({
      where: { userId },
      select: { teamId: true },
    });
    return memberships.map((m) => m.teamId);
  }
  const memberships = await prisma.userTeam.findMany({
    where: { userId, roleInTeam: { in: PLANNING_AND_STAFF_ROLES } },
    select: { teamId: true },
  });
  return memberships.map((m) => m.teamId);
}
