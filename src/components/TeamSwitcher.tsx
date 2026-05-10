"use client";

import { usePathname, useRouter } from "next/navigation";

export type TeamSwitcherOption = { slug: string; label: string; color: string };

export function TeamSwitcher({ teams, currentSlug }: { teams: TeamSwitcherOption[]; currentSlug: string }) {
  const pathname = usePathname();
  const router = useRouter();

  if (teams.length <= 1) return null;

  function goToTeam(slug: string) {
    const parts = pathname.split("/").filter(Boolean);
    const targetPath =
      parts.length === 0
        ? `/${slug}/planning-moi`
        : `/${[slug, ...parts.slice(1)].join("/")}`;
    const suffix = typeof window !== "undefined" ? `${window.location.search}${window.location.hash}` : "";
    router.push(`${targetPath}${suffix}`);
  }

  return (
    <label className="flex min-w-0 max-w-[min(100%,14rem)] items-center gap-2 sm:max-w-[16rem]">
      <span className="hidden shrink-0 text-xs font-medium text-[var(--text-muted)] sm:inline">Equipe</span>
      <select
        value={currentSlug}
        onChange={(e) => goToTeam(e.target.value)}
        className="min-w-0 flex-1 truncate rounded-full border border-[var(--border)] bg-white py-1.5 pl-3 pr-7 text-xs font-medium text-[var(--text)]"
        aria-label="Changer d'équipe"
      >
        {teams.map((t) => (
          <option key={t.slug} value={t.slug}>
            {t.label}
          </option>
        ))}
      </select>
    </label>
  );
}
