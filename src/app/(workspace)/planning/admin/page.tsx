import { redirect } from "next/navigation";

type SearchProps = {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

export default async function PlanningAdminPage({ searchParams }: SearchProps) {
  const sp = await searchParams;
  const qp = new URLSearchParams();
  if (typeof sp.year === "string") qp.set("year", sp.year);
  if (typeof sp.month === "string") qp.set("month", sp.month);
  if (typeof sp.rowOrder === "string") qp.set("rowOrder", sp.rowOrder);
  const query = qp.toString();
  redirect(query ? `/admin/planning?${query}` : "/admin/planning");
}
