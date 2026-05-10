import { redirect } from "next/navigation";
import { LEGACY_DEFAULT_TEAM_SLUG } from "@/lib/team";
import { adminTeamPath } from "@/lib/routes";

/** Ancienne URL globale : les codes horaires sont gérés par équipe. */
export default function LegacyAdminCodesRedirectPage() {
  redirect(adminTeamPath(LEGACY_DEFAULT_TEAM_SLUG, "codes-horaires"));
}
