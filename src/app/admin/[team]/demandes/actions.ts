"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { requireStaffAdmin } from "@/lib/require-staff-admin";
import { getEditableTeamIds } from "@/lib/user-roles";
import { LEGACY_DEFAULT_TEAM_SLUG, revalidateAllTeamPaths, getTeamBySlug } from "@/lib/team";
import { adminTeamPath } from "@/lib/routes";

function teamSlugFromForm(formData: FormData): string {
  const slug = String(formData.get("teamSlug") ?? "").trim();
  return slug || LEGACY_DEFAULT_TEAM_SLUG;
}

async function revalidateDemandes() {
  await revalidateAllTeamPaths(revalidatePath, {
    workspaceSegment: "demandes",
    adminSegment: "demandes",
  });
}

export async function decideLeaveRequest(formData: FormData) {
  const actor = await requireStaffAdmin();
  const teamSlug = teamSlugFromForm(formData);
  const adminDemandesUrl = adminTeamPath(teamSlug, "demandes");
  const team = await getTeamBySlug(teamSlug);
  if (!team) {
    redirect(adminDemandesUrl + "?error=" + encodeURIComponent("Équipe introuvable."));
  }
  const allowedTeamIds = await getEditableTeamIds(actor.id, actor.role);
  if (!allowedTeamIds.includes(team.id)) {
    redirect(
      "/?notice=" + encodeURIComponent("Vous ne pouvez pas traiter les demandes pour cette équipe."),
    );
  }

  const id = String(formData.get("id") ?? "");
  const decision = String(formData.get("decision") ?? "");
  const decisionNoteRaw = String(formData.get("decisionNote") ?? "").trim();
  const decisionNote = decisionNoteRaw ? decisionNoteRaw : null;
  if (!id) redirect(adminDemandesUrl + "?error=" + encodeURIComponent("Demande introuvable."));
  if (decision !== "APPROVED" && decision !== "REFUSED") {
    redirect(adminDemandesUrl + "?error=" + encodeURIComponent("Décision invalide."));
  }

  const existing = await prisma.leaveRequest.findUnique({ where: { id } });
  if (!existing) redirect(adminDemandesUrl + "?error=" + encodeURIComponent("Demande introuvable."));
  if (existing.status !== "PENDING") {
    redirect(adminDemandesUrl + "?error=" + encodeURIComponent("Seules les demandes en attente sont actionnables."));
  }

  const requesterInTeam = await prisma.userTeam.findUnique({
    where: { userId_teamId: { userId: existing.userId, teamId: team.id } },
  });
  if (!requesterInTeam) {
    redirect(
      adminDemandesUrl +
        "?error=" +
        encodeURIComponent("Cette demande ne concerne pas un membre de cette équipe."),
    );
  }

  await prisma.leaveRequest.update({
    where: { id },
    data: {
      status: decision,
      decidedAt: new Date(),
      decidedById: actor.id,
      decidedByName: `${actor.lastName.toUpperCase()} ${actor.firstName}`,
      decisionNote,
    },
  });

  await revalidateDemandes();
  redirect(adminDemandesUrl + "?updated=1");
}
