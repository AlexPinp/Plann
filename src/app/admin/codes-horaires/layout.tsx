import type { ReactNode } from "react";

export default function AdminCodesHorairesLayout({ children }: { children: ReactNode }) {
  return <div className="mx-auto w-full max-w-6xl px-4 py-6 md:px-6">{children}</div>;
}
