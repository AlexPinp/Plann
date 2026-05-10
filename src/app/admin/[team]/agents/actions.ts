"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { UserRole } from "@/generated/prisma/enums";
import { prisma } from "@/lib/prisma";
import { parsePlanningRhProfile } from "@/lib/planning-rh";
import { canAssignRole, requireStaffAdmin } from "@/lib/require-staff-admin";
import { getEditableTeamIds } from "@/lib/user-roles";
import { getAllTeams, getTeamBySlug, LEGACY_DEFAULT_TEAM_SLUG } from "@/lib/team";
import { adminTeamPath, workspacePath } from "@/lib/routes";

function teamSlugFromForm(formData: FormData): string {
  const slug = String(formData.get("teamSlug") ?? "").trim();
  return slug || LEGACY_DEFAULT_TEAM_SLUG;
}

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

async function revalidateAgentPages(teamSlug: string, id?: string) {
  const agentsPath = adminTeamPath(teamSlug, "agents");
  revalidatePath(agentsPath);
  if (id) revalidatePath(`${agentsPath}/${id}`);
  revalidatePath(adminTeamPath(teamSlug, "planning"));
  revalidatePath(`${workspacePath(teamSlug, "planning")}/admin`);
  revalidatePath(workspacePath(teamSlug, "planning-equipe"));
  revalidatePath(workspacePath(teamSlug, "droits"));
  const teams = await getAllTeams();
  for (const t of teams) {
    revalidatePath(workspacePath(t.slug, "planification"));
  }
}

async function revalidateWorkRateReporting(teamSlug: string, userId: string) {
  await revalidateAgentPages(teamSlug, userId);
  const teams = await getAllTeams();
  for (const t of teams) {
    revalidatePath(workspacePath(t.slug, "droits"));
  }
}

const SEGMENT_WORK_PERCENTAGES = [100, 90, 80, 75, 70, 60, 50] as const;

function parseSegmentWorkPercentage(raw: FormDataEntryValue | null): number | null {
  const n = Number(raw ?? "");
  return SEGMENT_WORK_PERCENTAGES.includes(n as (typeof SEGMENT_WORK_PERCENTAGES)[number]) ? n : null;
}

/** Champ mois HTML `YYYY-MM` → premier jour du mois UTC. */
function parseSegmentMonthStartsOn(raw: string): Date | null {
  const match = /^(\d{4})-(\d{2})$/.exec(raw.trim());
  if (!match) return null;
  const y = Number(match[1]);
  const mo = Number(match[2]);
  if (!Number.isInteger(y) || !Number.isInteger(mo) || mo < 1 || mo > 12) return null;
  return new Date(Date.UTC(y, mo - 1, 1, 12, 0, 0, 0));
}

export async function upsertUserWorkRateSegment(formData: FormData) {
  await requireStaffAdmin();
  const teamSlug = teamSlugFromForm(formData);
  const agentsBase = adminTeamPath(teamSlug, "agents");
  const userId = String(formData.get("userId") ?? "").trim();
  const monthStartsOn = parseSegmentMonthStartsOn(String(formData.get("segmentMonth") ?? ""));
  const workPercentage = parseSegmentWorkPercentage(formData.get("segmentWorkPercentage"));

  if (!userId || !monthStartsOn || workPercentage === null) {
    redirect(
      `${userId ? `${agentsBase}/${userId}` : agentsBase}?error=` +
        encodeURIComponent("Mois (AAAA-MM) et pourcentage valides sont obligatoires."),
    );
  }

  await prisma.userWorkRateSegment.upsert({
    where: { userId_monthStartsOn: { userId, monthStartsOn } },
    create: { userId, monthStartsOn, workPercentage },
    update: { workPercentage },
  });

  await revalidateWorkRateReporting(teamSlug, userId);
  redirect(`${agentsBase}/${userId}?segmentSaved=1`);
}

export async function deleteUserWorkRateSegment(formData: FormData) {
  await requireStaffAdmin();
  const teamSlug = teamSlugFromForm(formData);
  const agentsBase = adminTeamPath(teamSlug, "agents");
  const userId = String(formData.get("userId") ?? "").trim();
  const segmentId = String(formData.get("segmentId") ?? "").trim();
  if (!userId || !segmentId) {
    redirect(`${agentsBase}?error=` + encodeURIComponent("Segment invalide."));
  }

  const existing = await prisma.userWorkRateSegment.findFirst({
    where: { id: segmentId, userId },
    select: { id: true },
  });
  if (!existing) {
    redirect(`${agentsBase}/${userId}?error=` + encodeURIComponent("Segment introuvable."));
  }

  await prisma.userWorkRateSegment.delete({ where: { id: segmentId } });
  await revalidateWorkRateReporting(teamSlug, userId);
  redirect(`${agentsBase}/${userId}?segmentDeleted=1`);
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
  const teamSlug = teamSlugFromForm(formData);
  const agentsListPath = adminTeamPath(teamSlug, "agents");
  const teamRecord = await getTeamBySlug(teamSlug);

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
    redirect(`${agentsListPath}?error=` + encodeURIComponent("Prenom, nom et email sont obligatoires."));
  }

  const allTeams = await prisma.team.findMany({ orderBy: [{ displayOrder: "asc" }, { label: "asc" }] });
  const allTeamIdSet = new Set(allTeams.map((t) => t.id));
  const requestedTeamIds = [...new Set(formData.getAll("initialTeamId").map(String))].filter((id) =>
    allTeamIdSet.has(id),
  );
  const toAttachIds =
    requestedTeamIds.length > 0
      ? requestedTeamIds
      : teamRecord
        ? [teamRecord.id]
        : [];
  if (toAttachIds.length === 0) {
    redirect(`${agentsListPath}?error=` + encodeURIComponent("Selectionnez au moins une equipe."));
  }
  const allowedList = await getEditableTeamIds(actor.id, actor.role);
  for (const tid of toAttachIds) {
    if (!allowedList.includes(tid)) {
      redirect(`${agentsListPath}?error=` + encodeURIComponent("Vous ne pouvez pas rattacher a cette equipe."));
    }
  }
  const orderedAttach = allTeams.filter((t) => toAttachIds.includes(t.id));

  try {
    await prisma.$transaction(async (tx) => {
      const created = await tx.user.create({
        data: {
          firstName,
          lastName,
          email,
          workPercentage:
            Number.isFinite(workPercentage) && workPercentage > 0 && workPercentage <= 100 ? Math.round(workPercentage) : 100,
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
      for (let i = 0; i < orderedAttach.length; i++) {
        const t = orderedAttach[i];
        const isContextTeam = teamRecord?.id === t.id;
        await tx.userTeam.create({
          data: {
            userId: created.id,
            teamId: t.id,
            roleInTeam: role,
            isPrimary: i === 0,
            planningGroupLabel: isContextTeam ? planningGroupLabel : null,
            planningGroupColor: isContextTeam ? planningGroupColor : null,
            displayOrder: 0,
            planningTemplateNumber: isContextTeam ? planningTemplateNumber : null,
          },
        });
      }
    });
  } catch {
    redirect(`${agentsListPath}?error=` + encodeURIComponent("Cet email est deja utilise par un autre agent."));
  }

  for (const t of orderedAttach) {
    await revalidateAgentPages(t.slug);
  }
  redirect(`${agentsListPath}?created=1`);
}

export async function updateAgentTeamMemberships(formData: FormData) {
  const actor = await requireStaffAdmin();
  const teamSlug = teamSlugFromForm(formData);
  const agentsListPath = adminTeamPath(teamSlug, "agents");
  const ctxTeam = await getTeamBySlug(teamSlug);
  const userId = String(formData.get("userId") ?? "").trim();
  const returnToDetail = String(formData.get("afterMembership") ?? "") === "detail";
  if (!userId || !ctxTeam) {
    redirect(`${agentsListPath}?error=` + encodeURIComponent("Donnees invalides."));
  }
  const agentsDetailPath = `${agentsListPath}/${userId}`;
  const redirectBase = returnToDetail ? agentsDetailPath : agentsListPath;

  const allTeams = await prisma.team.findMany({ orderBy: [{ displayOrder: "asc" }, { label: "asc" }] });
  const allTeamIdSet = new Set(allTeams.map((t) => t.id));
  const allowedList = await getEditableTeamIds(actor.id, actor.role);
  const allowed = new Set(allowedList);

  const existingRows = await prisma.userTeam.findMany({ where: { userId } });
  const current = new Set(existingRows.map((r) => r.teamId));

  const requestedFromForm = new Set(
    formData.getAll("membershipTeamId").map(String).filter((id) => allTeamIdSet.has(id)),
  );

  const next = new Set<string>();
  for (const teamId of current) {
    if (!allowed.has(teamId)) next.add(teamId);
  }
  for (const teamId of allowed) {
    if (requestedFromForm.has(teamId)) next.add(teamId);
  }

  if (next.size === 0) {
    redirect(`${redirectBase}?error=` + encodeURIComponent("Au moins une equipe est requise."));
  }

  const toAdd = [...next].filter((id) => !current.has(id));
  const toRemove = [...current].filter((id) => !next.has(id));

  const refRow = existingRows.find((r) => r.teamId === ctxTeam.id) ?? existingRows[0];
  const defaultRole = refRow?.roleInTeam ?? UserRole.AGENT;

  const teamById = new Map(allTeams.map((t) => [t.id, t]));

  await prisma.$transaction(async (tx) => {
    for (const teamId of toRemove) {
      await tx.userTeam.delete({ where: { userId_teamId: { userId, teamId } } });
    }
    for (const teamId of toAdd) {
      await tx.userTeam.create({
        data: {
          userId,
          teamId,
          roleInTeam: defaultRole,
          isPrimary: false,
          planningGroupLabel: null,
          planningGroupColor: null,
          displayOrder: 0,
          planningTemplateNumber: null,
          showInTeamPlanning: true,
          showInAdminPlanning: true,
        },
      });
    }
    const remaining = await tx.userTeam.findMany({ where: { userId } });
    if (remaining.length === 0) return;
    const order = new Map(allTeams.map((t) => [t.id, t.displayOrder]));
    remaining.sort((a, b) => (order.get(a.teamId) ?? 0) - (order.get(b.teamId) ?? 0));
    const marked = remaining.filter((m) => m.isPrimary);
    const primaryTeamId =
      marked.length > 0
        ? [...marked].sort((a, b) => (order.get(a.teamId) ?? 0) - (order.get(b.teamId) ?? 0))[0].teamId
        : remaining[0].teamId;
    for (const m of remaining) {
      await tx.userTeam.update({
        where: { userId_teamId: { userId, teamId: m.teamId } },
        data: { isPrimary: m.teamId === primaryTeamId },
      });
    }
  });

  const affectedSlugs = new Set<string>([teamSlug]);
  for (const id of toAdd) affectedSlugs.add(teamById.get(id)!.slug);
  for (const id of toRemove) affectedSlugs.add(teamById.get(id)!.slug);
  for (const s of affectedSlugs) await revalidateAgentPages(s, userId);

  redirect(`${redirectBase}?teamsUpdated=1`);
}

export async function setAgentActive(formData: FormData) {
  const actor = await requireStaffAdmin();
  const teamSlug = teamSlugFromForm(formData);
  const agentsListPath = adminTeamPath(teamSlug, "agents");

  const id = String(formData.get("id") ?? "");
  const active = String(formData.get("active") ?? "") === "true";

  if (!id) return;

  if (id === actor.id && !active) {
    redirect(`${agentsListPath}?error=` + encodeURIComponent("Vous ne pouvez pas vous desactiver vous-meme."));
  }

  await prisma.user.update({
    where: { id },
    data: { active },
  });

  await revalidateAgentPages(teamSlug, id);
}

export async function updateAgent(formData: FormData) {
  const actor = await requireStaffAdmin();
  const teamSlug = teamSlugFromForm(formData);
  const agentsListPath = adminTeamPath(teamSlug, "agents");
  const agentsDetailPath = (agentId: string) => `${agentsListPath}/${agentId}`;
  const teamRecord = await getTeamBySlug(teamSlug);

  const id = String(formData.get("id") ?? "");
  if (!id) redirect(`${agentsListPath}?error=` + encodeURIComponent("Agent introuvable."));

  const existing = await prisma.user.findUnique({ where: { id } });
  if (!existing) redirect(`${agentsListPath}?error=` + encodeURIComponent("Agent introuvable."));

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
  const ctxMembership =
    teamRecord
      ? await prisma.userTeam.findUnique({
          where: { userId_teamId: { userId: id, teamId: teamRecord.id } },
          select: { displayOrder: true },
        })
      : null;
  const preservedTeamDisplayOrder = ctxMembership?.displayOrder ?? existing.displayOrder;
  const showInTeamPlanning = String(formData.get("showInTeamPlanning") ?? "") === "on";
  const showInAdminPlanning = String(formData.get("showInAdminPlanning") ?? "") === "on";

  const requestedSkillIds = formData.getAll("skillIds").map(String).filter(Boolean);

  if (!firstName || !lastName) {
    redirect(`${agentsDetailPath(id)}?error=` + encodeURIComponent("Prenom et nom obligatoires."));
  }

  // If account is already linked to Supabase Auth, keep email immutable
  // and avoid relying on form payload for this field.
  const email = existing.authUserId ? existing.email : emailFromForm;

  if (!existing.authUserId && !email) {
    redirect(`${agentsDetailPath(id)}?error=` + encodeURIComponent("Email obligatoire."));
  }
  if (alternancePartnerId === id) {
    redirect(`${agentsDetailPath(id)}?error=` + encodeURIComponent("Un agent ne peut pas etre son propre binome."));
  }

  const partner =
    alternancePartnerId
      ? await prisma.user.findUnique({
          where: { id: alternancePartnerId },
          select: { id: true, alternancePartnerId: true, active: true },
        })
      : null;
  if (alternancePartnerId && !partner) {
    redirect(`${agentsDetailPath(id)}?error=` + encodeURIComponent("Binome introuvable."));
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
      displayOrder: existing.displayOrder,
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
        if (teamRecord) {
          await tx.userTeam.upsert({
            where: { userId_teamId: { userId: id, teamId: teamRecord.id } },
            create: {
              userId: id,
              teamId: teamRecord.id,
              roleInTeam: role,
              isPrimary: !(await tx.userTeam.findFirst({ where: { userId: id } })),
              planningGroupLabel,
              planningGroupColor,
              displayOrder: preservedTeamDisplayOrder,
              planningTemplateNumber,
              planningTemplateNumberA: isAlternant ? planningTemplateNumberA : null,
              planningTemplateNumberB: isAlternant ? planningTemplateNumberB : null,
              planningGroupLabelA: isAlternant ? planningGroupLabelA : null,
              planningGroupLabelB: isAlternant ? planningGroupLabelB : null,
            },
            update: {
              roleInTeam: role,
              planningGroupLabel,
              planningGroupColor,
              displayOrder: preservedTeamDisplayOrder,
              planningTemplateNumber,
              planningTemplateNumberA: isAlternant ? planningTemplateNumberA : null,
              planningTemplateNumberB: isAlternant ? planningTemplateNumberB : null,
              planningGroupLabelA: isAlternant ? planningGroupLabelA : null,
              planningGroupLabelB: isAlternant ? planningGroupLabelB : null,
            },
          });
          // Hors upsert : évite « Unknown argument » si le client Prisma chargé par Next est plus ancien que le schéma.
          await tx.$executeRaw`
            UPDATE "UserTeam"
            SET "showInTeamPlanning" = ${showInTeamPlanning}, "showInAdminPlanning" = ${showInAdminPlanning}
            WHERE "userId" = ${id} AND "teamId" = ${teamRecord.id}
          `;
        }
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

    redirect(`${agentsDetailPath(id)}?error=` + encodeURIComponent(message));
  }

  await revalidateAgentPages(teamSlug, id);
  redirect(`${agentsListPath}?updated=1`);
}
