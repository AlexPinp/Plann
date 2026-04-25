import { redirectLegacyWorkspaceSegment } from "@/lib/legacy-workspace-redirect";

export default async function LegacyPlanningPage() {
  await redirectLegacyWorkspaceSegment("planning-equipe", "/planning");
}
