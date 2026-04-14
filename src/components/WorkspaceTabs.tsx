"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

type Tab = { href: string; label: string; match: (p: string) => boolean };

const agentTabs: Tab[] = [
  { href: "/planning-moi", label: "Mon planning", match: (p) => p === "/" || p.startsWith("/planning-moi") },
  { href: "/planning-equipe", label: "Planning equipe", match: (p) => p.startsWith("/planning-equipe") },
  { href: "/demandes", label: "Demandes", match: (p) => p.startsWith("/demandes") },
  { href: "/droits", label: "Droits & recap", match: (p) => p.startsWith("/droits") },
];

export function WorkspaceTabs() {
  const pathname = usePathname();

  return (
    <nav className="flex items-center gap-1 border-b border-zinc-200 bg-zinc-50/80 px-4 md:px-6" aria-label="Navigation principale">
      {agentTabs.map((tab) => (
        <TabLink key={tab.href} tab={tab} pathname={pathname} />
      ))}
    </nav>
  );
}

function TabLink({ tab, pathname, accent }: { tab: Tab; pathname: string; accent?: boolean }) {
  const active = tab.match(pathname);
  return (
    <Link
      href={tab.href}
      className={[
        "-mb-px border-b-2 px-3 py-3 text-sm font-medium transition-colors md:px-4",
        active
          ? accent
            ? "border-emerald-600 text-emerald-700"
            : "border-zinc-900 text-zinc-900"
          : accent
            ? "border-transparent text-emerald-600 hover:border-emerald-300 hover:text-emerald-700"
            : "border-transparent text-zinc-500 hover:border-zinc-300 hover:text-zinc-800",
      ].join(" ")}
    >
      {tab.label}
    </Link>
  );
}
