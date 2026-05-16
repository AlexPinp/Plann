import Link from "next/link";
import type { ReactNode } from "react";

type MonthOption = {
  value: number;
  label: string;
};

type MonthNavigatorProps = {
  basePath: string;
  monthLabel: string;
  currentMonth: number;
  currentYear: number;
  prev: { y: number; m: number };
  next: { y: number; m: number };
  monthOptions: MonthOption[];
  yearOptions: number[];
  extraQueryParams?: Record<string, string>;
  actions?: ReactNode;
};

function withQuery(path: string, params: Record<string, string | number>) {
  const qp = new URLSearchParams();
  Object.entries(params).forEach(([k, v]) => qp.set(k, String(v)));
  const q = qp.toString();
  return q ? `${path}?${q}` : path;
}

export function MonthNavigator({
  basePath,
  monthLabel,
  currentMonth,
  currentYear,
  prev,
  next,
  monthOptions,
  yearOptions,
  extraQueryParams,
  actions,
}: MonthNavigatorProps) {
  const commonParams = extraQueryParams ?? {};
  const prevHref = withQuery(basePath, { ...commonParams, year: prev.y, month: prev.m });
  const nextHref = withQuery(basePath, { ...commonParams, year: next.y, month: next.m });

  return (
    <div className="flex w-full flex-wrap items-center gap-1.5 sm:w-auto">
      <Link
        href={prevHref}
        className="rounded-md border border-[var(--border)] bg-white px-2 py-1.5 text-sm font-medium text-[var(--text-muted)] hover:bg-[var(--surface-soft)]"
      >
        &larr;
      </Link>
      <span className="min-w-[120px] text-center text-sm font-semibold capitalize text-[var(--text)]">
        {monthLabel}
      </span>
      <Link
        href={nextHref}
        className="rounded-md border border-[var(--border)] bg-white px-2 py-1.5 text-sm font-medium text-[var(--text-muted)] hover:bg-[var(--surface-soft)]"
      >
        &rarr;
      </Link>

      <form action={basePath} method="get" className="ml-0.5 flex w-full flex-wrap items-center gap-1 sm:w-auto">
        <select
          name="month"
          defaultValue={String(currentMonth)}
          className="w-full rounded-md border border-[var(--border)] bg-white px-2 py-1.5 text-sm text-[var(--text)] sm:w-auto"
        >
          {monthOptions.map((opt) => (
            <option key={opt.value} value={opt.value}>
              {opt.label}
            </option>
          ))}
        </select>
        <select
          name="year"
          defaultValue={String(currentYear)}
          className="w-full rounded-md border border-[var(--border)] bg-white px-2 py-1.5 text-sm text-[var(--text)] sm:w-auto"
        >
          {yearOptions.map((yy) => (
            <option key={yy} value={yy}>
              {yy}
            </option>
          ))}
        </select>
        {Object.entries(commonParams).map(([key, value]) => (
          <input key={key} type="hidden" name={key} value={value} />
        ))}
        <button
          type="submit"
          className="w-full rounded-md border border-[var(--border)] bg-white px-2 py-1.5 text-sm font-medium text-[var(--text-muted)] hover:bg-[var(--surface-soft)] sm:w-auto"
        >
          Aller
        </button>
      </form>

      {actions}
    </div>
  );
}
