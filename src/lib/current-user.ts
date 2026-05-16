import { cache } from "react";
import { prisma } from "@/lib/prisma";
import { createSupabaseServerClient } from "@/lib/supabase/server";

/** Agent Prisma lié à la session Supabase courante, si présent (dédupliqué par requête RSC). */
export const getSessionPrismaUser = cache(async () => {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user?.id) return null;
  return prisma.user.findFirst({
    where: { authUserId: user.id },
  });
});
