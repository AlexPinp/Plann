import { redirect } from "next/navigation";
import { workspacePath } from "@/lib/routes";

type Props = { params: Promise<{ team: string }> };

export default async function PlanningLegacyRedirect({ params }: Props) {
  const { team } = await params;
  redirect(workspacePath(team, "planning-equipe"));
}
