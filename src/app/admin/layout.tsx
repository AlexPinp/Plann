import type { ReactNode } from "react";
import { requireStaffAdmin } from "@/lib/require-staff-admin";

/** Shell minimal : l’en-tête détaillé et le périmètre équipe sont dans `admin/[team]/layout.tsx`.
 *  `codes-horaires` reste global sous `/admin/codes-horaires`. */
export default async function AdminLayout({ children }: { children: ReactNode }) {
  await requireStaffAdmin();
  return <>{children}</>;
}
