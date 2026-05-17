import { TeamJob, TeamRhythm } from "@/generated/prisma/enums";

export function teamAxisShortLabel(team: { job: TeamJob; rhythm: TeamRhythm }): string {
  const job = team.job === TeamJob.IDE ? "IDE" : "AS";
  const rh = team.rhythm === TeamRhythm.JOUR ? "jour" : "nuit";
  return `${job} ${rh}`;
}
