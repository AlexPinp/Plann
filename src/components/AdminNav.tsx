"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { adminTeamPath } from "@/lib/routes";

const ADMIN_LINKS = [
  { segment: "planning", label: "Planning modifiable" },
  { segment: "demandes", label: "Demandes" },
  { segment: "commentaires-suivis", label: "Commentaires et suivis" },
  { segment: "formations", label: "Formations" },
  { segment: "parametres-admin", label: "Paramètres admin" },
] as const;

export function AdminNav({ teamSlug }: { teamSlug: string }) {
  const pathname = usePathname();

  return (
    <nav
      className="flex justify-center gap-0.5 overflow-x-auto pb-0.5 text-sm md:justify-self-center"
      aria-label="Navigation administration"
    >
      {ADMIN_LINKS.map(({ segment, label }) => {
        const href = adminTeamPath(teamSlug, segment);
        const active = pathname === href || pathname.startsWith(`${href}/`);
        return (
          <Link
            key={segment}
            href={href}
            className={["ui-tab", active ? "ui-admin-tab-active" : "ui-tab-inactive"].join(" ")}
            aria-current={active ? "page" : undefined}
          >
            {label}
          </Link>
        );
      })}
    </nav>
  );
}
