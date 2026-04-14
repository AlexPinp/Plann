import { UserRole } from "@/generated/prisma/enums";
import type { User } from "@/generated/prisma/client";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { PLANNING_AND_STAFF_ROLES } from "@/lib/user-roles";

export type StaffAgent = User & { role: UserRole };

export async function requireStaffAdmin(): Promise<StaffAgent> {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user?.id) {
    redirect("/login?next=/admin");
  }

  const agent = await prisma.user.findFirst({
    where: { authUserId: user.id },
  });

  if (!agent) {
    redirect("/login?error=" + encodeURIComponent("Profil agent introuvable."));
  }

  if (!PLANNING_AND_STAFF_ROLES.includes(agent.role)) {
    redirect(
      "/?notice=" + encodeURIComponent("Accès réservé aux cadres, référents et administrateurs."),
    );
  }

  return agent as StaffAgent;
}

/** Seul l’admin peut attribuer les rôles CADRE, REFERENT et ADMIN. Cadre et référent ne créent que des agents. */
export function canAssignRole(actor: StaffAgent, targetRole: UserRole): boolean {
  if (actor.role === UserRole.ADMIN) return true;
  if (actor.role === UserRole.CADRE || actor.role === UserRole.REFERENT) {
    return targetRole === UserRole.AGENT;
  }
  return false;
}
