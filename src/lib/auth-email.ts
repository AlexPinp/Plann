/**
 * Domaines autorisés pour l’inscription et la connexion (emails professionnels).
 * `ALLOWED_EMAIL_DOMAINS` : liste séparée par des virgules, sans @ (ex. ght85.fr,hopital.fr).
 * Si vide ou absente, toute adresse est acceptée (pratique en développement).
 */
export function isAllowedProfessionalEmail(email: string): boolean {
  const raw = process.env.ALLOWED_EMAIL_DOMAINS?.trim() ?? "";
  const domains = raw
    .split(",")
    .map((d) => d.trim().toLowerCase())
    .filter(Boolean);

  if (domains.length === 0) return true;

  const at = email.lastIndexOf("@");
  if (at === -1) return false;
  const domain = email.slice(at + 1).toLowerCase();
  return domains.some((d) => domain === d);
}

/** Évite les redirections ouvertes : chemins internes uniquement. */
export function getSafeInternalPath(nextParam: unknown): string {
  const next = typeof nextParam === "string" ? nextParam.trim() : "/";
  if (!next.startsWith("/") || next.startsWith("//") || next.includes("..")) return "/";
  return next;
}
