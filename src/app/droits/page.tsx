import { redirectLegacyWorkspaceSegment } from "@/lib/legacy-workspace-redirect";

export default async function LegacyDroitsPage() {
  await redirectLegacyWorkspaceSegment("droits", "/droits");
}
