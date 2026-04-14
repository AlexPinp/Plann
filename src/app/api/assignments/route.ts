import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { getSessionPrismaUser } from "@/lib/current-user";
import { canEditPlanningAndStaff } from "@/lib/user-roles";

const createAssignmentSchema = z.object({
  planningWeekId: z.string().min(1),
  shiftTypeId: z.string().min(1),
  date: z.string().datetime(),
  userId: z.string().min(1).optional(),
  note: z.string().max(300).optional(),
});

async function requireAuthenticatedUser() {
  const user = await getSessionPrismaUser();
  if (!user) {
    return null;
  }
  return user;
}

export async function GET(request: Request) {
  const user = await requireAuthenticatedUser();
  if (!user) {
    return Response.json({ error: "Authentication required" }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const planningWeekId = searchParams.get("planningWeekId");

  if (!planningWeekId) {
    return Response.json({ error: "planningWeekId is required" }, { status: 400 });
  }

  const assignments = await prisma.assignment.findMany({
    where: { planningWeekId },
    include: {
      user: true,
      shiftType: true,
    },
    orderBy: [{ date: "asc" }],
  });

  return Response.json({ data: assignments });
}

export async function POST(request: Request) {
  const user = await requireAuthenticatedUser();
  if (!user) {
    return Response.json({ error: "Authentication required" }, { status: 401 });
  }
  if (!canEditPlanningAndStaff(user.role)) {
    return Response.json({ error: "Insufficient permissions" }, { status: 403 });
  }

  const json = await request.json();
  const parsed = createAssignmentSchema.safeParse(json);

  if (!parsed.success) {
    return Response.json({ error: "Invalid payload", details: parsed.error.flatten() }, { status: 400 });
  }

  const data = parsed.data;

  const assignment = await prisma.assignment.create({
    data: {
      planningWeekId: data.planningWeekId,
      shiftTypeId: data.shiftTypeId,
      date: new Date(data.date),
      userId: data.userId,
      note: data.note,
    },
  });

  return Response.json({ data: assignment }, { status: 201 });
}
