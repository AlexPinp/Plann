"use client";

import { usePathname, useRouter } from "next/navigation";

export type TeamSwitcherOption = { slug: string; label: string; color: string };

export function TeamSwitcher({
  teams,
  currentSlug,
  mode = "workspace",
}: {
  teams: TeamSwitcherOption[];
  currentSlug: string;
  /** workspace: /{team}/… — admin: /admin/{team}/… */
  mode?: "workspace" | "admin";
}) {
  const pathname = usePathname();
  const router = useRouter();

  if (teams.length <= 1) return null;

  function goToTeam(slug: string) {
    const parts = pathname.split("/").filter(Boolean);
    let targetPath: string;

    if (mode === "admin") {
      const rest = parts[0] === "admin" ? parts.slice(2) : parts;
      targetPath = rest.length > 0 ? `/admin/${slug}/${rest.join("/")}` : `/admin/${slug}/planning`;
    } else if (parts.length === 0) {
      targetPath = `/${slug}/planning-moi`;
    } else {
      targetPath = `/${slug}/${parts.slice(1).join("/")}`;
    }

    const suffix = typeof window !== "undefined" ? `${window.location.search}${window.location.hash}` : "";
    router.push(`${targetPath}${suffix}`);
  }

  return (
    <label className="flex min-w-0 max-w-[min(100%,14rem)] items-center gap-2 sm:max-w-[16rem]">
      <span className="hidden shrink-0 text-xs font-medium text-[var(--text-muted)] sm:inline">Equipe</span>
      <select
        value={currentSlug}
        onChange={(e) => goToTeam(e.target.value)}
        className="ui-select min-w-0 max-w-full flex-1 py-1.5 pl-3 pr-8 text-xs font-medium"
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
