import type { ReactNode } from "react";

/** Groupe de routes : le shell (header, onglets) est dans `[team]/layout.tsx`. */
export default function WorkspaceGroupLayout({ children }: { children: ReactNode }) {
  return <>{children}</>;
}
