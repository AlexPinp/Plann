import { redirect } from "next/navigation";
import { getSessionPrismaUser } from "@/lib/current-user";
import { getDefaultTeamSlugForUser, LEGACY_DEFAULT_TEAM_SLUG } from "@/lib/team";
import { adminTeamPath } from "@/lib/routes";

export default async function AdminIndexPage() {
  const user = await getSessionPrismaUser();
  if (!user) {
    redirect("/login?next=/admin");
  }
  const slug = (await getDefaultTeamSlugForUser(user.id, user.role)) ?? LEGACY_DEFAULT_TEAM_SLUG;
  redirect(adminTeamPath(slug, "planning"));
}
