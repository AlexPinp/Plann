import { redirectLegacyWorkspaceSegment } from "@/lib/legacy-workspace-redirect";

export default async function LegacyPlanningEquipePage() {
  await redirectLegacyWorkspaceSegment("planning-equipe", "/planning-equipe");
}
