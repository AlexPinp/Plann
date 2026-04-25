import { redirectLegacyWorkspaceSegment } from "@/lib/legacy-workspace-redirect";

export default async function LegacyAgentsPage() {
  await redirectLegacyWorkspaceSegment("agents", "/agents");
}
