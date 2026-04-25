import { redirect } from "next/navigation";
import { adminTeamPath } from "@/lib/routes";

type Props = { params: Promise<{ team: string }> };

export default async function WorkspaceCommentairesSuivisRedirect({ params }: Props) {
  const { team } = await params;
  redirect(adminTeamPath(team, "commentaires-suivis"));
}
