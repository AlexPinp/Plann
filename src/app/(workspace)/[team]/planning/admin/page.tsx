import { redirect } from "next/navigation";
import { adminTeamPath } from "@/lib/routes";

type SearchProps = {
  params: Promise<{ team: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

export default async function PlanningAdminPage({ params, searchParams }: SearchProps) {
  const { team } = await params;
  const sp = await searchParams;
  const qp = new URLSearchParams();
  if (typeof sp.year === "string") qp.set("year", sp.year);
  if (typeof sp.month === "string") qp.set("month", sp.month);
  if (typeof sp.rowOrder === "string") qp.set("rowOrder", sp.rowOrder);
  const query = qp.toString();
  const base = adminTeamPath(team, "planning");
  redirect(query ? `${base}?${query}` : base);
}
