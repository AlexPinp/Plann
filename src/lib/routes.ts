/** Chemins URL versionnés par équipe (slug stable : ide-jour, as-nuit, …). */

export function workspacePath(teamSlug: string, segment: string): string {
  return `/${teamSlug}/${segment}`;
}

export function adminTeamPath(teamSlug: string, segment: string): string {
  return `/admin/${teamSlug}/${segment}`;
}

/** Invalide les pages planning côté workspace et admin pour une équipe. */
export function revalidateTeamPlanningSurfaces(teamSlug: string, revalidatePath: (path: string) => void) {
  revalidatePath(workspacePath(teamSlug, "planning-moi"));
  revalidatePath(workspacePath(teamSlug, "planning-equipe"));
  revalidatePath(workspacePath(teamSlug, "organisation"));
  revalidatePath(adminTeamPath(teamSlug, "planning"));
  revalidatePath(workspacePath(teamSlug, "planning/admin"));
  revalidatePath(workspacePath(teamSlug, "droits"));
}
