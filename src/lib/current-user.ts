import { prisma } from "@/lib/prisma";
import { createSupabaseServerClient } from "@/lib/supabase/server";

/** Agent Prisma lié à la session Supabase courante, si présent. */
export async function getSessionPrismaUser() {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user?.id) return null;
  return prisma.user.findFirst({
    where: { authUserId: user.id },
  });
}
