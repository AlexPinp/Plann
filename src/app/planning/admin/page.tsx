import { redirect } from "next/navigation";
import { getSessionPrismaUser } from "@/lib/current-user";
import { getDefaultTeamSlugForUser, LEGACY_DEFAULT_TEAM_SLUG } from "@/lib/team";
import { adminTeamPath } from "@/lib/routes";

type SearchProps = {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

export default async function LegacyPlanningAdminShortcut({ searchParams }: SearchProps) {
  const user = await getSessionPrismaUser();
  if (!user) {
    redirect("/login?next=/planning/admin");
  }
  const slug = (await getDefaultTeamSlugForUser(user.id)) ?? LEGACY_DEFAULT_TEAM_SLUG;
  const sp = await searchParams;
  const qp = new URLSearchParams();
  if (typeof sp.year === "string") qp.set("year", sp.year);
  if (typeof sp.month === "string") qp.set("month", sp.month);
  if (typeof sp.rowOrder === "string") qp.set("rowOrder", sp.rowOrder);
  const query = qp.toString();
  const base = adminTeamPath(slug, "planning");
  redirect(query ? `${base}?${query}` : base);
}
