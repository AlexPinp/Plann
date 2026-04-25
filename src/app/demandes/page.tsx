import { redirectLegacyWorkspaceSegment } from "@/lib/legacy-workspace-redirect";

export default async function LegacyDemandesPage() {
  await redirectLegacyWorkspaceSegment("demandes", "/demandes");
}
