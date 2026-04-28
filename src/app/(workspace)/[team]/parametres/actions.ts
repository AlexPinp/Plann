"use server";

import { redirect } from "next/navigation";
import { workspacePath } from "@/lib/routes";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { requireTeamMembership } from "@/lib/team";

const MIN_PASSWORD_LENGTH = 8;
const ALLOWED_UI_THEMES = ["system", "light", "dark"] as const;
const ALLOWED_UI_DENSITIES = ["comfortable", "compact"] as const;

export async function updateMyPassword(formData: FormData) {
  const teamSlug = String(formData.get("teamSlug") ?? "").trim();
  if (!teamSlug) {
    redirect("/login");
  }

  await requireTeamMembership(teamSlug);

  const settingsUrl = workspacePath(teamSlug, "parametres");
  const password = String(formData.get("password") ?? "");
  const confirmPassword = String(formData.get("confirmPassword") ?? "");

  if (!password || !confirmPassword) {
    redirect(`${settingsUrl}?error=${encodeURIComponent("Veuillez remplir les deux champs mot de passe.")}`);
  }

  if (password.length < MIN_PASSWORD_LENGTH) {
    redirect(
      `${settingsUrl}?error=${encodeURIComponent(`Mot de passe : au moins ${MIN_PASSWORD_LENGTH} caractères.`)}`,
    );
  }

  if (password !== confirmPassword) {
    redirect(`${settingsUrl}?error=${encodeURIComponent("Les mots de passe ne correspondent pas.")}`);
  }

  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.auth.updateUser({ password });

  if (error) {
    redirect(`${settingsUrl}?error=${encodeURIComponent(error.message)}`);
  }

  redirect(`${settingsUrl}?updatedPassword=1`);
}

export async function updateMyPreferences(formData: FormData) {
  const teamSlug = String(formData.get("teamSlug") ?? "").trim();
  if (!teamSlug) {
    redirect("/login");
  }

  await requireTeamMembership(teamSlug);

  const settingsUrl = workspacePath(teamSlug, "parametres");
  const uiTheme = String(formData.get("uiTheme") ?? "");
  const uiDensity = String(formData.get("uiDensity") ?? "");

  if (
    !(ALLOWED_UI_THEMES as readonly string[]).includes(uiTheme) ||
    !(ALLOWED_UI_DENSITIES as readonly string[]).includes(uiDensity)
  ) {
    redirect(`${settingsUrl}?error=${encodeURIComponent("Préférences invalides.")}`);
  }

  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.auth.updateUser({
    data: {
      uiTheme,
      uiDensity,
    },
  });

  if (error) {
    redirect(`${settingsUrl}?error=${encodeURIComponent(error.message)}`);
  }

  redirect(`${settingsUrl}?updatedPreferences=1`);
}
