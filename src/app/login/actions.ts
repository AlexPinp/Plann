"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { getSafeInternalPath, isAllowedProfessionalEmail } from "@/lib/auth-email";
import { linkAuthToPrismaUser, messageForLinkFailure } from "@/lib/auth-link";
import { prisma } from "@/lib/prisma";
import { createSupabaseServerClient } from "@/lib/supabase/server";

const MIN_PASSWORD_LENGTH = 8;

async function assertAgentMayRegister(email: string) {
  const normalized = email.trim().toLowerCase();
  const agent = await prisma.user.findFirst({
    where: { email: { equals: normalized, mode: "insensitive" } },
  });
  if (!agent) {
    redirect(`/login?error=${encodeURIComponent(messageForLinkFailure("NO_AGENT"))}`);
  }
  if (!agent.active) {
    redirect(`/login?error=${encodeURIComponent(messageForLinkFailure("INACTIVE"))}`);
  }
  if (agent.authUserId) {
    redirect(
      `/login?error=${encodeURIComponent("Un compte existe déjà pour cet agent — utilisez « Connexion ».")}`,
    );
  }
}

async function enforceLinkOrSignOut(supabase: Awaited<ReturnType<typeof createSupabaseServerClient>>) {
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user?.id || !user.email) {
    await supabase.auth.signOut();
    redirect(`/login?error=${encodeURIComponent("Session invalide — reconnectez-vous.")}`);
  }
  const link = await linkAuthToPrismaUser(user.id, user.email);
  if (!link.ok) {
    await supabase.auth.signOut();
    redirect(`/login?error=${encodeURIComponent(messageForLinkFailure(link.code))}`);
  }
}

export async function signInWithPassword(formData: FormData) {
  const email = String(formData.get("email") ?? "")
    .trim()
    .toLowerCase();
  const password = String(formData.get("password") ?? "");
  const next = getSafeInternalPath(formData.get("next") || "/planning-moi");

  if (!email || !password) {
    redirect(`/login?error=${encodeURIComponent("Email et mot de passe requis.")}`);
  }

  if (!isAllowedProfessionalEmail(email)) {
    redirect(`/login?error=${encodeURIComponent("Cette adresse email professionnelle n'est pas autorisée.")}`);
  }

  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.auth.signInWithPassword({ email, password });

  if (error) {
    redirect(`/login?error=${encodeURIComponent(error.message)}`);
  }

  await enforceLinkOrSignOut(supabase);

  revalidatePath("/");
  redirect(next);
}

export async function signUpWithPassword(formData: FormData) {
  const email = String(formData.get("email") ?? "")
    .trim()
    .toLowerCase();
  const password = String(formData.get("password") ?? "");
  const confirm = String(formData.get("confirmPassword") ?? "");

  if (!email || !password) {
    redirect(`/login?error=${encodeURIComponent("Email et mot de passe requis.")}`);
  }

  if (!isAllowedProfessionalEmail(email)) {
    redirect(`/login?error=${encodeURIComponent("Cette adresse email professionnelle n'est pas autorisée.")}`);
  }

  if (password.length < MIN_PASSWORD_LENGTH) {
    redirect(
      `/login?error=${encodeURIComponent(`Mot de passe : au moins ${MIN_PASSWORD_LENGTH} caractères.`)}`,
    );
  }

  if (password !== confirm) {
    redirect(`/login?error=${encodeURIComponent("Les mots de passe ne correspondent pas.")}`);
  }

  await assertAgentMayRegister(email);

  const supabase = await createSupabaseServerClient();
  const origin = process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";

  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: {
      emailRedirectTo: `${origin}/api/auth/callback?next=/`,
    },
  });

  if (error) {
    redirect(`/login?error=${encodeURIComponent(error.message)}`);
  }

  if (data.user?.id) {
    const link = await linkAuthToPrismaUser(data.user.id, email);
    if (!link.ok) {
      redirect(`/login?error=${encodeURIComponent(messageForLinkFailure(link.code))}`);
    }
  }

  redirect("/login?registered=1");
}

export async function signOut() {
  const supabase = await createSupabaseServerClient();
  await supabase.auth.signOut();
  revalidatePath("/");
  redirect("/login");
}
