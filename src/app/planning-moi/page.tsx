import { redirectLegacyWorkspaceSegment } from "@/lib/legacy-workspace-redirect";

export default async function LegacyPlanningMoiPage() {
  await redirectLegacyWorkspaceSegment("planning-moi", "/planning-moi");
}
