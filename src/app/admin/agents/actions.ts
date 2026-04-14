"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { UserRole } from "@/generated/prisma/enums";
import { prisma } from "@/lib/prisma";
import { parsePlanningRhProfile } from "@/lib/planning-rh";
import { canAssignRole, requireStaffAdmin } from "@/lib/require-staff-admin";

function parseRole(
  raw: string,
  actor: Awaited<ReturnType<typeof requireStaffAdmin>>,
  fallbackIfDenied: UserRole = UserRole.AGENT,
): UserRole {
  const r =
    raw === UserRole.ADMIN ||
    raw === UserRole.CADRE ||
    raw === UserRole.REFERENT ||
    raw === UserRole.AGENT
      ? raw
      : UserRole.AGENT;
  if (canAssignRole(actor, r)) return r;
  return fallbackIfDenied;
}

function revalidateAgentPages(id?: string) {
  revalidatePath("/admin/agents");
  if (id) revalidatePath(`/admin/agents/${id}`);
  revalidatePath("/admin/planning");
  revalidatePath("/planning/admin");
  revalidatePath("/planning-equipe");
  revalidatePath("/droits");
}

function parseTemplateNumber(raw: FormDataEntryValue | null): number | null {
  const str = String(raw ?? "").trim();
  if (!str) return null;
  const n = Number(str);
  if (!Number.isInteger(n) || n < 1) return null;
  return n;
}

function parseOptionalString(raw: FormDataEntryValue | null): string | null {
  const value = String(raw ?? "").trim();
  return value ? value : null;
}

function parseAlternanceCycleWeeks(raw: FormDataEntryValue | null): number {
  const n = Number(raw ?? 6);
  if (!Number.isInteger(n) || n < 1 || n > 52) return 6;
  return n;
}

function parseAlternancePhase(raw: FormDataEntryValue | null): number {
  return String(raw ?? "0") === "1" ? 1 : 0;
}

function parseAlternanceAnchorDate(raw: FormDataEntryValue | null): Date | null {
  const value = String(raw ?? "").trim();
  if (!value) return null;
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!match) return null;
  const y = Number(match[1]);
  const m = Number(match[2]);
  const d = Number(match[3]);
  if (!Number.isInteger(y) || !Number.isInteger(m) || !Number.isInteger(d)) return null;
  return new Date(Date.UTC(y, m - 1, d, 12, 0, 0, 0));
}

export async function createAgent(formData: FormData) {
  const actor = await requireStaffAdmin();

  const firstName = String(formData.get("firstName") ?? "").trim();
  const lastName = String(formData.get("lastName") ?? "").trim();
  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  const workPercentage = Number(formData.get("workPercentage") ?? 100);
  const planningGroupLabel = String(formData.get("planningGroupLabel") ?? "").trim() || null;
  const planningGroupColor = String(formData.get("planningGroupColor") ?? "").trim() || null;
  const planningTemplateNumber = parseTemplateNumber(formData.get("planningTemplateNumber"));
  const planningRhProfile = parsePlanningRhProfile(formData.get("planningRhProfile"));
  const role = parseRole(String(formData.get("role") ?? UserRole.AGENT), actor);

  const skillIds = formData.getAll("skillIds").map(String).filter(Boolean);

  if (!firstName || !lastName || !email) {
    redirect("/admin/agents?error=" + encodeURIComponent("Prenom, nom et email sont obligatoires."));
  }

  try {
    await prisma.user.create({
      data: {
        firstName,
        lastName,
        email,
        workPercentage: Number.isFinite(workPercentage) && workPercentage > 0 && workPercentage <= 100 ? Math.round(workPercentage) : 100,
        planningGroupLabel,
        planningGroupColor,
        planningTemplateNumber,
      isAlternant: false,
        planningRhProfile,
        role,
        skills: skillIds.length
          ? { createMany: { data: skillIds.map((id) => ({ skillId: id })), skipDuplicates: true } }
          : undefined,
      },
    });
  } catch {
    redirect("/admin/agents?error=" + encodeURIComponent("Cet email est deja utilise par un autre agent."));
  }

  revalidateAgentPages();
  redirect("/admin/agents?created=1");
}

export async function setAgentActive(formData: FormData) {
  const actor = await requireStaffAdmin();

  const id = String(formData.get("id") ?? "");
  const active = String(formData.get("active") ?? "") === "true";

  if (!id) return;

  if (id === actor.id && !active) {
    redirect("/admin/agents?error=" + encodeURIComponent("Vous ne pouvez pas vous desactiver vous-meme."));
  }

  await prisma.user.update({
    where: { id },
    data: { active },
  });

  revalidateAgentPages(id);
}

export async function updateAgent(formData: FormData) {
  const actor = await requireStaffAdmin();

  const id = String(formData.get("id") ?? "");
  if (!id) redirect("/admin/agents?error=" + encodeURIComponent("Agent introuvable."));

  const existing = await prisma.user.findUnique({ where: { id } });
  if (!existing) redirect("/admin/agents?error=" + encodeURIComponent("Agent introuvable."));

  const firstName = String(formData.get("firstName") ?? "").trim();
  const lastName = String(formData.get("lastName") ?? "").trim();
  const emailFromForm = String(formData.get("email") ?? "").trim().toLowerCase();
  const workPercentage = Number(formData.get("workPercentage") ?? 100);
  const planningGroupLabel = String(formData.get("planningGroupLabel") ?? "").trim() || null;
  const planningGroupColor = String(formData.get("planningGroupColor") ?? "").trim() || null;
  const planningTemplateNumber = parseTemplateNumber(formData.get("planningTemplateNumber"));
  const isAlternant = String(formData.get("isAlternant") ?? "") === "on";
  const alternanceCycleWeeks = parseAlternanceCycleWeeks(formData.get("alternanceCycleWeeks"));
  const alternancePhase = parseAlternancePhase(formData.get("alternancePhase"));
  const alternanceAnchorDate = parseAlternanceAnchorDate(formData.get("alternanceAnchorDate"));
  const planningTemplateNumberA = parseTemplateNumber(formData.get("planningTemplateNumberA"));
  const planningTemplateNumberB = parseTemplateNumber(formData.get("planningTemplateNumberB"));
  const planningGroupLabelA = parseOptionalString(formData.get("planningGroupLabelA"));
  const planningGroupLabelB = parseOptionalString(formData.get("planningGroupLabelB"));
  const alternancePartnerIdRaw = parseOptionalString(formData.get("alternancePartnerId"));
  const alternancePartnerId = isAlternant ? alternancePartnerIdRaw : null;
  const planningRhProfile = parsePlanningRhProfile(formData.get("planningRhProfile"));
  const role = parseRole(String(formData.get("role") ?? existing.role), actor, existing.role);
  const displayOrder = Number(formData.get("displayOrder") ?? existing.displayOrder);

  const requestedSkillIds = formData.getAll("skillIds").map(String).filter(Boolean);

  if (!firstName || !lastName) {
    redirect(`/admin/agents/${id}?error=` + encodeURIComponent("Prenom et nom obligatoires."));
  }

  // If account is already linked to Supabase Auth, keep email immutable
  // and avoid relying on form payload for this field.
  const email = existing.authUserId ? existing.email : emailFromForm;

  if (!existing.authUserId && !email) {
    redirect(`/admin/agents/${id}?error=` + encodeURIComponent("Email obligatoire."));
  }
  if (alternancePartnerId === id) {
    redirect(`/admin/agents/${id}?error=` + encodeURIComponent("Un agent ne peut pas etre son propre binome."));
  }

  const partner =
    alternancePartnerId
      ? await prisma.user.findUnique({
          where: { id: alternancePartnerId },
          select: { id: true, alternancePartnerId: true, active: true },
        })
      : null;
  if (alternancePartnerId && !partner) {
    redirect(`/admin/agents/${id}?error=` + encodeURIComponent("Binome introuvable."));
  }

  const validSkillIds = requestedSkillIds.length
    ? (
        await prisma.skill.findMany({
          where: { id: { in: requestedSkillIds } },
          select: { id: true },
        })
      ).map((s) => s.id)
    : [];

  try {
    const commonUserData = {
      firstName,
      lastName,
      email,
      workPercentage:
        Number.isFinite(workPercentage) && workPercentage > 0 && workPercentage <= 100 ? Math.round(workPercentage) : 100,
      planningGroupLabel,
      planningGroupColor,
      planningTemplateNumber,
      isAlternant,
      alternanceCycleWeeks: isAlternant ? alternanceCycleWeeks : 6,
      alternancePhase: isAlternant ? alternancePhase : 0,
      alternanceAnchorDate: isAlternant ? alternanceAnchorDate : null,
      planningTemplateNumberA: isAlternant ? planningTemplateNumberA : null,
      planningTemplateNumberB: isAlternant ? planningTemplateNumberB : null,
      planningGroupLabelA: isAlternant ? planningGroupLabelA : null,
      planningGroupLabelB: isAlternant ? planningGroupLabelB : null,
      alternancePartnerId,
      role,
      displayOrder: Number.isFinite(displayOrder) ? displayOrder : 0,
    };

    const runUpdateTx = async (includeRhProfile: boolean) =>
      prisma.$transaction(async (tx) => {
        const previousPartnerId = existing.alternancePartnerId;
        if (previousPartnerId && previousPartnerId !== alternancePartnerId) {
          await tx.user.updateMany({
            where: { id: previousPartnerId, alternancePartnerId: id },
            data: { alternancePartnerId: null },
          });
        }

        if (alternancePartnerId) {
          await tx.user.updateMany({
            where: { alternancePartnerId, id: { not: id } },
            data: { alternancePartnerId: null },
          });

          if (partner?.alternancePartnerId && partner.alternancePartnerId !== id) {
            await tx.user.updateMany({
              where: { id: partner.alternancePartnerId, alternancePartnerId: alternancePartnerId },
              data: { alternancePartnerId: null },
            });
          }

          await tx.user.update({
            where: { id: alternancePartnerId },
            data: { alternancePartnerId: id },
          });
        }

        await tx.user.update({
          where: { id },
          data: includeRhProfile ? { ...commonUserData, planningRhProfile } : commonUserData,
        });
        await tx.userSkill.deleteMany({ where: { userId: id } });
        if (validSkillIds.length) {
          await tx.userSkill.createMany({
            data: validSkillIds.map((skillId) => ({ userId: id, skillId })),
            skipDuplicates: true,
          });
        }
      });

    try {
      await runUpdateTx(true);
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : String(error);
      if (message.includes("Unknown argument `planningRhProfile`")) {
        await runUpdateTx(false);
      } else {
        throw error;
      }
    }
  } catch (error: unknown) {
    const prismaCode =
      typeof error === "object" && error && "code" in error ? String((error as { code?: unknown }).code ?? "") : "";

    const message =
      prismaCode === "P2002"
        ? "Cet email est deja utilise."
        : prismaCode === "P2003"
          ? "Une competence selectionnee n'existe plus. Rechargez la page puis reessayez."
          : error instanceof Error
            ? `Mise a jour impossible: ${error.message}`
            : "Mise a jour impossible. Verifiez les champs puis reessayez.";

    redirect(
      `/admin/agents/${id}?error=` + encodeURIComponent(message),
    );
  }

  revalidateAgentPages(id);
  redirect("/admin/agents?updated=1");
}
