import {
  PrismaClientKnownRequestError,
  PrismaClientValidationError,
} from "@prisma/client/runtime/client";

const META_DETAIL_MAX = 450;

function prismaMetaDetail(meta: unknown): string | undefined {
  if (!meta || typeof meta !== "object") return undefined;
  const m = meta as Record<string, unknown>;
  for (const key of ["database_error", "details", "message", "field_name", "cause"]) {
    const v = m[key];
    if (typeof v === "string" && v.trim()) return v.trim();
  }
  try {
    const s = JSON.stringify(meta);
    return s.length <= META_DETAIL_MAX ? s : `${s.slice(0, META_DETAIL_MAX)}…`;
  } catch {
    return undefined;
  }
}

/** Messages utilisateur pour create/update ShiftType (Prisma / Postgres). */
export function getShiftMutationErrorMessage(error: unknown): string {
  console.error("[codes-horaires] enregistrement ShiftType:", error);

  const msg = error instanceof Error ? error.message : "";

  if (/permission denied|42501|violates row-level security/i.test(msg)) {
    return "Ecriture refusee par la base (droits). Utilisez une URL Postgres avec un role qui contourne le RLS (ex. direct Supabase + role service / postgres), pas un role sans privilege.";
  }

  if (error instanceof PrismaClientValidationError) {
    return "Donnees invalides (validation Prisma). Verifiez le formulaire.";
  }

  if (error instanceof PrismaClientKnownRequestError) {
    if (error.code === "P2002") {
      const targets = (error.meta?.target as string[] | undefined)?.join(", ") ?? "code";
      if (String(targets).includes("code")) {
        return "Ce code existe deja pour cette equipe. Choisissez un autre code.";
      }
      return "Contrainte d'unicite violee (" + targets + ").";
    }
    if (error.code === "P2000") {
      return "Valeur trop longue: raccourcissez le code ou le nom.";
    }
    /** Validation PostgreSQL refusant une valeur (souvent enum / type). */
    if (error.code === "P2007") {
      const blob = `${msg}${JSON.stringify(error.meta ?? {})}`;
      /** Postgres n’a pas JOUR dans l’enum mais l’app envoie JOUR (schéma désynchronisé). */
      if (/invalid input value for enum ["']ShiftCategory["']: ["']JOUR["']/i.test(blob)) {
        return (
          "La base utilise encore un ancien enum ShiftCategory (sans la valeur JOUR). " +
          "Appliquez les migrations sur cette base : `npx prisma migrate deploy`, " +
          "ou exécutez le script `scripts/sql/normalize-shift-category-jour-nuit.sql` dans Supabase (SQL Editor)."
        );
      }
      const detail = prismaMetaDetail(error.meta);
      const suffix = detail ? ` Detail : ${detail}` : "";
      return (
        "PostgreSQL refuse les donnees envoyees (validation)." +
        suffix +
        " Souvent : enum ou contraintes pas a jour — `npx prisma migrate deploy` sur la meme base que DATABASE_URL."
      );
    }
    if (error.code === "P2006") {
      const detail = prismaMetaDetail(error.meta);
      return (
        "Valeur invalide pour un champ Prisma." +
        (detail ? ` (${detail})` : "") +
        " Verifiez categorie JOUR/NUIT et horaires HH:MM."
      );
    }
    if (error.code === "P2020" || error.code === "P2022") {
      return "Donnees invalides detectees. Verifiez categorie et horaires.";
    }
    const fallbackDetail = prismaMetaDetail(error.meta);
    return (
      "Erreur base de donnees (" +
      error.code +
      ")." +
      (fallbackDetail ? ` Detail : ${fallbackDetail}` : "") +
      " Consultez aussi les logs serveur."
    );
  }

  if (/Unique constraint failed/i.test(msg)) {
    return "Ce code existe deja pour cette equipe. Choisissez un autre code.";
  }

  return (
    "Impossible d'enregistrer ce code (erreur technique). Consultez le terminal / logs du serveur Next.js pour le detail."
  );
}
