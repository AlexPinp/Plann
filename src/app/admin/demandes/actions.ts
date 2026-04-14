"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { requireStaffAdmin } from "@/lib/require-staff-admin";

function revalidateDemandes() {
  revalidatePath("/admin/demandes");
  revalidatePath("/demandes");
}

export async function decideLeaveRequest(formData: FormData) {
  const actor = await requireStaffAdmin();

  const id = String(formData.get("id") ?? "");
  const decision = String(formData.get("decision") ?? "");
  const decisionNoteRaw = String(formData.get("decisionNote") ?? "").trim();
  const decisionNote = decisionNoteRaw ? decisionNoteRaw : null;
  if (!id) redirect("/admin/demandes?error=" + encodeURIComponent("Demande introuvable."));
  if (decision !== "APPROVED" && decision !== "REFUSED") {
    redirect("/admin/demandes?error=" + encodeURIComponent("Décision invalide."));
  }

  const existing = await prisma.leaveRequest.findUnique({ where: { id } });
  if (!existing) redirect("/admin/demandes?error=" + encodeURIComponent("Demande introuvable."));
  if (existing.status !== "PENDING") {
    redirect("/admin/demandes?error=" + encodeURIComponent("Seules les demandes en attente sont actionnables."));
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

  revalidateDemandes();
  redirect("/admin/demandes?updated=1");
}
