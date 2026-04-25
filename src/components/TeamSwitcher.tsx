"use client";

import { usePathname, useRouter } from "next/navigation";

export type TeamSwitcherOption = { slug: string; label: string; color: string };

export function TeamSwitcher({ teams, currentSlug }: { teams: TeamSwitcherOption[]; currentSlug: string }) {
  const pathname = usePathname();
  const router = useRouter();

  if (teams.length <= 1) return null;

  function goToTeam(slug: string) {
    const parts = pathname.split("/").filter(Boolean);
    if (parts.length === 0) {
      router.push(`/${slug}/planning-moi`);
      return;
    }
    parts[0] = slug;
    router.push(`/${parts.join("/")}`);
  }

  return (
    <label className="flex min-w-0 max-w-[min(100%,14rem)] items-center gap-2 sm:max-w-[16rem]">
      <span className="hidden shrink-0 text-xs font-medium text-zinc-500 sm:inline">Équipe</span>
      <select
        value={currentSlug}
        onChange={(e) => goToTeam(e.target.value)}
        className="min-w-0 flex-1 truncate rounded-md border border-zinc-300 bg-white py-1.5 pl-2 pr-7 text-xs font-medium text-zinc-900"
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
