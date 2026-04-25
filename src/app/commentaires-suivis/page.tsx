import { redirectLegacyWorkspaceSegment } from "@/lib/legacy-workspace-redirect";

export default async function LegacyCommentairesSuivisPage() {
  await redirectLegacyWorkspaceSegment("commentaires-suivis", "/commentaires-suivis");
}
