import { cache } from "react";
import { notFound, redirect } from "next/navigation";
import type { Team, User, UserTeam } from "@/generated/prisma/client";
import { UserRole } from "@/generated/prisma/enums";
import { prisma } from "@/lib/prisma";
import { getSessionPrismaUser } from "@/lib/current-user";

/** Id de l'équipe historique (« Infirmiers de jour »), créée par la migration
 *  avec un id stable. Utilisé PONCTUELLEMENT par le code pré-phase-3 qui ne
 *  connaît pas encore le contexte d'équipe (trames, validation planning...).
 *  À retirer une fois la phase 3 (routes `[team]`) livrée. */
export const LEGACY_DEFAULT_TEAM_ID = "team_ide_jour";
export const LEGACY_DEFAULT_TEAM_SLUG = "ide-jour";

/** Appartenance d'un utilisateur à une équipe, avec l'équipe jointe pour l'affichage. */
export type UserTeamWithTeam = UserTeam & { team: Team };

/** Contexte résolu pour une page scopée à une équipe (via un segment dynamique /[team]). */
export type TeamContext = {
  /** L'équipe visée (jamais null : notFound() est déclenché sinon). */
  team: Team;
  /** Utilisateur connecté (jamais null : redirect vers /login sinon). */
  user: User;
  /** Appartenance de l'utilisateur à cette équipe, ou null si c'est un ADMIN global étranger à l'équipe. */
  userTeam: UserTeam | null;
  /** Rôle effectif de l'utilisateur DANS cette équipe (ADMIN global l'emporte sur roleInTeam). */
  effectiveRole: UserRole;
  /** Peut-il modifier planning/staff/trames dans cette équipe ? */
  canEditStaff: boolean;
};

/** Renvoie toutes les équipes, triées selon l'ordre d'affichage puis le libellé. */
export const getAllTeams = cache(async () => {
  return prisma.team.findMany({
    orderBy: [{ displayOrder: "asc" }, { label: "asc" }],
  });
});

/** Résout une équipe par son slug, ou null si elle n'existe pas. */
export const getTeamBySlug = cache(async (slug: string) => {
  return prisma.team.findUnique({ where: { slug } });
});

/** Équipes par identifiants (ordre d'affichage), pour vues multi-équipes ciblées. */
export async function getTeamsByIds(teamIds: string[]) {
  if (teamIds.length === 0) return [];
  return prisma.team.findMany({
    where: { id: { in: teamIds } },
    orderBy: [{ displayOrder: "asc" }, { label: "asc" }],
  });
}

/** Toutes les équipes auxquelles appartient un utilisateur, primaire d'abord. */
export async function getUserTeams(userId: string): Promise<UserTeamWithTeam[]> {
  return prisma.userTeam.findMany({
    where: { userId },
    include: { team: true },
    orderBy: [{ isPrimary: "desc" }, { team: { displayOrder: "asc" } }],
  });
}

/** Équipes de la session courante (vide si personne n'est connecté). */
export async function getSessionUserTeams(): Promise<{
  user: User | null;
  userTeams: UserTeamWithTeam[];
}> {
  const user = await getSessionPrismaUser();
  if (!user) return { user: null, userTeams: [] };
  const userTeams = await getUserTeams(user.id);
  return { user, userTeams };
}

/** Équipe primaire de la session, ou la première si aucune n'est marquée primaire. */
export async function getSessionPrimaryTeam(): Promise<UserTeamWithTeam | null> {
  const { user, userTeams } = await getSessionUserTeams();
  if (!user || userTeams.length === 0) return null;
  return userTeams.find((ut) => ut.isPrimary) ?? userTeams[0];
}

/** True si le rôle (global ou d'équipe) autorise la modification planning/staff. */
export function isStaffRole(role: UserRole | null | undefined): boolean {
  if (!role) return false;
  return role === UserRole.ADMIN || role === UserRole.CADRE || role === UserRole.REFERENT;
}

/** Résolution du rôle effectif d'un utilisateur dans une équipe :
 *  - ADMIN global écrase tout,
 *  - sinon on prend le roleInTeam (AGENT si non-membre). */
export function effectiveRoleInTeam(
  globalRole: UserRole,
  teamRole: UserRole | null | undefined,
): UserRole {
  if (globalRole === UserRole.ADMIN) return UserRole.ADMIN;
  return teamRole ?? UserRole.AGENT;
}

/** Garde d'accès pour une page scopée à une équipe : exige que l'utilisateur connecté
 *  en soit membre (ou soit ADMIN global). Redirige ou déclenche notFound() sinon. */
export async function requireTeamMembership(slug: string): Promise<TeamContext> {
  const user = await getSessionPrismaUser();
  if (!user) {
    redirect("/login");
  }

  const team = await getTeamBySlug(slug);
  if (!team) {
    notFound();
  }

  const userTeam = await prisma.userTeam.findUnique({
    where: { userId_teamId: { userId: user.id, teamId: team.id } },
  });

  if (!userTeam && user.role !== UserRole.ADMIN) {
    redirect(
      "/?notice=" +
        encodeURIComponent(`Vous n'appartenez pas à l'équipe ${team.label}.`),
    );
  }

  const effective = effectiveRoleInTeam(user.role, userTeam?.roleInTeam);

  return {
    team,
    user,
    userTeam,
    effectiveRole: effective,
    canEditStaff: isStaffRole(effective),
  };
}

/** Garde d'accès plus stricte : exige en plus un rôle cadre/référent/admin dans l'équipe. */
export async function requireTeamAdmin(slug: string): Promise<TeamContext> {
  const ctx = await requireTeamMembership(slug);
  if (!ctx.canEditStaff) {
    redirect(
      "/?notice=" +
        encodeURIComponent(
          `Accès réservé aux cadres, référents et administrateurs de l'équipe ${ctx.team.label}.`,
        ),
    );
  }
  return ctx;
}

/** Slug d'équipe suggéré pour un utilisateur : son équipe primaire, sinon la 1ère. */
export async function getDefaultTeamSlugForUser(userId: string): Promise<string | null> {
  const memberships = await getUserTeams(userId);
  if (memberships.length === 0) return null;
  return (memberships.find((ut) => ut.isPrimary) ?? memberships[0]).team.slug;
}

/** Invalide une même route sous chaque slug d'équipe (données globales affichées dans chaque contexte `[team]`). */
export async function revalidateAllTeamPaths(
  revalidatePathFn: (path: string) => void,
  opts: { workspaceSegment?: string; adminSegment?: string },
) {
  const teams = await getAllTeams();
  for (const t of teams) {
    if (opts.workspaceSegment) revalidatePathFn(`/${t.slug}/${opts.workspaceSegment}`);
    if (opts.adminSegment) revalidatePathFn(`/admin/${t.slug}/${opts.adminSegment}`);
  }
}
