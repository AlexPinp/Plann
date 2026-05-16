type Variant = "default" | "calendar" | "table" | "cards";

type Props = {
  variant?: Variant;
};

function Bone({ className }: { className: string }) {
  return <div className={`animate-pulse rounded-md bg-[var(--border)] ${className}`} />;
}

function TableSkeleton() {
  return (
    <div className="overflow-hidden rounded-xl border border-[var(--border)] bg-white shadow-sm">
      <div className="border-b border-[var(--border)] px-3 py-3">
        <Bone className="mx-auto h-4 w-40" />
      </div>
      <div className="space-y-0 p-2">
        {Array.from({ length: 8 }, (_, row) => (
          <div key={row} className="flex gap-1 border-b border-[var(--border)] py-2 last:border-0">
            <Bone className="h-8 w-28 shrink-0" />
            {Array.from({ length: 12 }, (_, col) => (
              <Bone key={col} className="h-8 min-w-8 flex-1" />
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}

function CardsSkeleton() {
  return (
    <div className="grid gap-4 md:grid-cols-3">
      {Array.from({ length: 3 }, (_, i) => (
        <div key={i} className="rounded-xl border border-[var(--border)] bg-white p-4 shadow-sm">
          <Bone className="mb-3 h-4 w-24" />
          <Bone className="mb-2 h-5 w-full" />
          <Bone className="mb-2 h-4 w-3/4" />
          <Bone className="h-3 w-1/2" />
        </div>
      ))}
    </div>
  );
}

function CalendarSkeleton() {
  return (
    <div className="rounded-xl border border-[var(--border)] bg-white p-4 shadow-sm">
      <div className="mb-4 grid grid-cols-7 gap-2">
        {Array.from({ length: 7 }, (_, i) => (
          <Bone key={i} className="h-4 w-full" />
        ))}
      </div>
      <div className="grid grid-cols-7 gap-2">
        {Array.from({ length: 35 }, (_, i) => (
          <Bone key={i} className="aspect-square w-full" />
        ))}
      </div>
    </div>
  );
}

export function PageLoadingSkeleton({ variant = "default" }: Props) {
  return (
    <main
      className="mx-auto w-full flex-1 p-4 sm:p-6 md:p-10"
      aria-busy="true"
      aria-label="Chargement en cours"
    >
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <div className="space-y-2">
          <Bone className="h-7 w-48 sm:w-64" />
          <Bone className="h-4 w-72 max-w-full" />
        </div>
        <Bone className="h-9 w-40" />
      </div>

      {variant === "table" ? (
        <TableSkeleton />
      ) : variant === "cards" ? (
        <>
          <Bone className="mb-6 h-24 w-full rounded-xl" />
          <CardsSkeleton />
        </>
      ) : variant === "calendar" ? (
        <CalendarSkeleton />
      ) : (
        <div className="space-y-4">
          <Bone className="h-32 w-full rounded-xl" />
          <Bone className="h-48 w-full rounded-xl" />
        </div>
      )}
    </main>
  );
}
