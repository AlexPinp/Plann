import type { ReactNode } from "react";
import { requireStaffAdmin } from "@/lib/require-staff-admin";

/** Shell minimal : l’en-tête détaillé et le périmètre équipe sont dans `admin/[team]/layout.tsx`.
 *  Les codes horaires sont par équipe (`/admin/[slug]/codes-horaires`) ; `/admin/codes-horaires` redirige. */
export default async function AdminLayout({ children }: { children: ReactNode }) {
  await requireStaffAdmin();
  return <div className="flex min-h-full flex-col">{children}</div>;
}
