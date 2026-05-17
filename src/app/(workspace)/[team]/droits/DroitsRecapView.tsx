import { format } from "date-fns";
import { fr } from "date-fns/locale";
import { roleLabelsFr } from "@/lib/user-roles";
import type { UserRole } from "@/generated/prisma/enums";

type UserOption = { id: string; lastName: string; firstName: string };
type LeaveStat = {
  code: string;
  yearlyQuota: number;
  toTake: number;
  taken: number;
  usedRatio: number;
  usedPercent: number;
};
type Availability = {
  id: string;
  type: string;
  startsAt: Date;
  endsAt: Date;
  note: string | null;
};

const availabilityLabels: Record<string, string> = {
  CONGE: "Congé",
  ARRET: "Arrêt",
  FORMATION: "Formation",
  AUTRE: "Autre",
};

function progressColor(ratio: number) {
  if (ratio < 0.6) return "var(--success)";
  if (ratio < 0.9) return "var(--warning)";
  return "var(--danger)";
}

function ProgressRing({ percent, ratio, size = 72 }: { percent: number; ratio: number; size?: number }) {
  const stroke = 6;
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const offset = c - (percent / 100) * c;

  return (
    <svg width={size} height={size} className="shrink-0 -rotate-90" aria-hidden>
      <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="var(--surface-soft)" strokeWidth={stroke} />
      <circle
        cx={size / 2}
        cy={size / 2}
        r={r}
        fill="none"
        stroke={progressColor(ratio)}
        strokeWidth={stroke}
        strokeLinecap="round"
        strokeDasharray={c}
        strokeDashoffset={offset}
      />
    </svg>
  );
}

function HoursCard({
  title,
  real,
  theoretical,
  percent,
  ratio,
}: {
  title: string;
  real: number;
  theoretical: number | null;
  percent: number;
  ratio: number;
}) {
  if (theoretical === null) {
    return (
      <article className="ui-card">
        <h2 className="text-xs font-semibold uppercase tracking-wide text-[var(--text-muted)]">{title}</h2>
        <p className="mt-2 text-sm text-[var(--text-muted)]">Forfait jours</p>
      </article>
    );
  }

  return (
    <article className="ui-card">
      <h2 className="text-xs font-semibold uppercase tracking-wide text-[var(--text-muted)]">{title}</h2>
      <div className="mt-3 flex items-center gap-4">
        <div className="relative flex items-center justify-center">
          <ProgressRing percent={percent} ratio={ratio} />
          <span className="absolute text-sm font-bold text-[var(--text)]">{percent}%</span>
        </div>
        <div>
          <p className="font-hours text-2xl font-semibold text-[var(--text)]">
            {real}
            <span className="text-base font-normal text-[var(--text-muted)]"> h</span>
          </p>
          <p className="text-xs text-[var(--text-muted)]">sur {theoretical} h</p>
        </div>
      </div>
      <div className="mt-3 h-1.5 w-full overflow-hidden rounded-full bg-[var(--surface-soft)]">
        <div
          className="h-full rounded-full"
          style={{ width: `${percent}%`, background: progressColor(ratio) }}
        />
      </div>
    </article>
  );
}

function LeaveCard({ stat }: { stat: LeaveStat }) {
  return (
    <article className="rounded-xl border border-[var(--border)] bg-[var(--surface)] p-3 shadow-sm">
      <div className="flex items-center justify-between gap-2">
        <span className="rounded-md bg-[var(--primary-soft)] px-2 py-0.5 text-sm font-bold text-[var(--primary)]">
          {stat.code}
        </span>
        <span className="text-xs font-medium text-[var(--text-muted)]">{stat.usedPercent}%</span>
      </div>
      <div className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-[var(--surface-soft)]">
        <div
          className="h-full rounded-full"
          style={{ width: `${stat.usedPercent}%`, background: progressColor(stat.usedRatio) }}
        />
      </div>
      <p className="mt-2 font-hours text-lg font-semibold text-[var(--text)]">
        {stat.taken}
        <span className="text-sm font-normal text-[var(--text-muted)]"> / {stat.yearlyQuota} j</span>
      </p>
      <p className="text-xs text-[var(--text-muted)]">
        {stat.toTake > 0 ? `${stat.toTake} j restant${stat.toTake > 1 ? "s" : ""}` : "Quota atteint"}
      </p>
    </article>
  );
}

export type DroitsRecapViewProps = {
  canSelectAgent: boolean;
  users: UserOption[];
  selectedUser: {
    id: string;
    lastName: string;
    firstName: string;
    role: string;
    skills: { skill: { name: string } }[];
  };
  selectedMonthInputValue: string;
  monthLabel: string;
  referenceYear: number;
  profileShort: string;
  selectedMonthWorkPct: number;
  annualAvgWorkPct: number;
  hasWorkRateSegments: boolean;
  weeklyHours: number;
  annualRestDays: number;
  annualPublicHolidays: number;
  monthlyTheoreticalHours: number | null;
  monthlyRealHours: number;
  hoursPercent: number;
  hoursRatio: number;
  annualTheoreticalHours: number | null;
  annualRealHours: number;
  annualHoursPercent: number;
  annualHoursRatio: number;
  leaveStats: LeaveStat[];
  availabilities: Availability[];
};

export function DroitsRecapView({
  canSelectAgent,
  users,
  selectedUser,
  selectedMonthInputValue,
  monthLabel,
  referenceYear,
  profileShort,
  selectedMonthWorkPct,
  annualAvgWorkPct,
  hasWorkRateSegments,
  weeklyHours,
  annualRestDays,
  annualPublicHolidays,
  monthlyTheoreticalHours,
  monthlyRealHours,
  hoursPercent,
  hoursRatio,
  annualTheoreticalHours,
  annualRealHours,
  annualHoursPercent,
  annualHoursRatio,
  leaveStats,
  availabilities,
}: DroitsRecapViewProps) {
  const roleLabel = roleLabelsFr[selectedUser.role as UserRole] ?? selectedUser.role;
  const skills =
    selectedUser.skills.length > 0
      ? selectedUser.skills
          .map((s) => s.skill.name)
          .slice(0, 3)
          .join(" · ")
      : null;

  return (
    <main className="mx-auto w-full max-w-5xl flex-1 p-4 sm:p-6 md:p-8">
      <header className="mb-6">
        <h1 className="ui-page-title">Droits & récap</h1>
        <p className="ui-page-subtitle capitalize">{monthLabel}</p>
      </header>

      <form method="get" className="ui-card mb-6">
        <div className="flex flex-wrap items-end gap-3">
          {canSelectAgent ? (
            <div className="min-w-[200px] flex-1">
              <label htmlFor="agentId" className="ui-label">
                Agent
              </label>
              <select id="agentId" name="agentId" defaultValue={selectedUser.id} className="ui-select w-full">
                {users.map((u) => (
                  <option key={u.id} value={u.id}>
                    {u.lastName.toUpperCase()} {u.firstName}
                  </option>
                ))}
              </select>
            </div>
          ) : null}
          <div className="w-full min-w-[140px] sm:w-auto">
            <label htmlFor="month" className="ui-label">
              Mois
            </label>
            <input id="month" name="month" type="month" defaultValue={selectedMonthInputValue} className="ui-input" />
          </div>
          {!canSelectAgent ? <input type="hidden" name="agentId" value={selectedUser.id} /> : null}
          <button type="submit" className="ui-btn-primary w-full shrink-0 sm:w-auto">
            Actualiser
          </button>
        </div>
      </form>

      <section className="mb-6 flex flex-wrap items-center gap-2">
        <div className="flex min-w-0 flex-1 items-center gap-3 rounded-xl border border-[var(--border)] bg-[var(--surface)] px-4 py-3 shadow-sm">
          <span
            className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-sm font-bold text-white"
            style={{ background: "var(--header-gradient)" }}
            aria-hidden
          >
            {selectedUser.firstName.charAt(0)}
            {selectedUser.lastName.charAt(0)}
          </span>
          <div className="min-w-0">
            <p className="truncate font-semibold text-[var(--text)]">
              {selectedUser.lastName.toUpperCase()} {selectedUser.firstName}
            </p>
            <p className="truncate text-xs text-[var(--text-muted)]">
              {roleLabel}
              {skills ? ` · ${skills}` : ""}
            </p>
          </div>
        </div>
        <span className="rounded-full bg-[var(--accent-soft)] px-3 py-1 text-xs font-medium text-[var(--accent)]">
          {profileShort}
        </span>
        <span className="rounded-full bg-[var(--primary-soft)] px-3 py-1 text-xs font-medium text-[var(--primary)]">
          {selectedMonthWorkPct} % · ~{weeklyHours.toFixed(1)} h/sem.
        </span>
        {hasWorkRateSegments ? (
          <span className="rounded-full bg-[var(--surface-soft)] px-3 py-1 text-xs text-[var(--text-muted)]">
            Moy. {referenceYear} : {annualAvgWorkPct} %
          </span>
        ) : null}
      </section>

      <div className="mb-6 grid gap-4 sm:grid-cols-2">
        <HoursCard
          title="Heures — mois"
          real={monthlyRealHours}
          theoretical={monthlyTheoreticalHours}
          percent={hoursPercent}
          ratio={hoursRatio}
        />
        <HoursCard
          title={`Heures — ${referenceYear}`}
          real={annualRealHours}
          theoretical={annualTheoreticalHours}
          percent={annualHoursPercent}
          ratio={annualHoursRatio}
        />
      </div>

      <section className="mb-6">
        <h2 className="mb-3 text-xs font-semibold uppercase tracking-wide text-[var(--text-muted)]">Soldes congés</h2>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {leaveStats.map((s) => (
            <LeaveCard key={s.code} stat={s} />
          ))}
        </div>
        <div className="mx-auto mt-3 grid w-full max-w-md grid-cols-2 gap-3">
          <div className="rounded-xl border border-[var(--border)] bg-[var(--surface-soft)] px-3 py-2.5 text-center">
            <p className="text-[10px] font-semibold uppercase tracking-wide text-[var(--text-muted)]">Repos annuel</p>
            <p className="font-hours mt-0.5 text-lg font-semibold text-[var(--text)]">{annualRestDays} j</p>
          </div>
          <div className="rounded-xl border border-[var(--border)] bg-[var(--surface-soft)] px-3 py-2.5 text-center">
            <p className="text-[10px] font-semibold uppercase tracking-wide text-[var(--text-muted)]">JF</p>
            <p className="font-hours mt-0.5 text-lg font-semibold text-[var(--text)]">{annualPublicHolidays} j</p>
          </div>
        </div>
      </section>

      <section className="ui-card">
        <h2 className="text-xs font-semibold uppercase tracking-wide text-[var(--text-muted)]">Absences à venir</h2>
        {availabilities.length === 0 ? (
          <p className="mt-3 text-sm text-[var(--text-muted)]">Aucune absence planifiée.</p>
        ) : (
          <ul className="mt-3 flex flex-col gap-2">
            {availabilities.map((a) => (
              <li
                key={a.id}
                className="flex flex-wrap items-center gap-x-3 gap-y-1 rounded-lg border border-[var(--border)] bg-[var(--surface-soft)] px-3 py-2 text-sm"
              >
                <span className="rounded-md bg-[var(--warning-soft)] px-2 py-0.5 text-xs font-semibold text-[var(--warning)]">
                  {availabilityLabels[a.type] ?? a.type}
                </span>
                <span className="font-hours text-[var(--text)]">
                  {format(a.startsAt, "dd/MM/yy", { locale: fr })} → {format(a.endsAt, "dd/MM/yy", { locale: fr })}
                </span>
                {a.note ? <span className="w-full text-xs text-[var(--text-muted)]">{a.note}</span> : null}
              </li>
            ))}
          </ul>
        )}
      </section>
    </main>
  );
}
