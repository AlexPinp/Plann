import { redirect } from "next/navigation";
import { getSessionPrismaUser } from "@/lib/current-user";
import { getDefaultTeamSlugForUser, LEGACY_DEFAULT_TEAM_SLUG } from "@/lib/team";
import { workspacePath } from "@/lib/routes";

/** Anciens chemins sans segment équipe : renvoie vers `/{slug}/…`. */
export async function redirectLegacyWorkspaceSegment(segment: string, loginNextPath: string): Promise<never> {
  const user = await getSessionPrismaUser();
  if (!user) {
    redirect(`/login?next=${encodeURIComponent(loginNextPath)}`);
  }
  const slug = (await getDefaultTeamSlugForUser(user.id)) ?? LEGACY_DEFAULT_TEAM_SLUG;
  redirect(workspacePath(slug, segment));
}
