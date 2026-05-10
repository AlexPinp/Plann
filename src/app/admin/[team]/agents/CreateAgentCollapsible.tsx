"use client";

import { useState } from "react";

type Props = {
  children: React.ReactNode;
};

export function CreateAgentCollapsible({ children }: Props) {
  const [open, setOpen] = useState(false);

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="mt-8 flex w-full items-center justify-between gap-3 rounded-xl border border-dashed border-zinc-300 bg-zinc-50/80 px-4 py-3 text-left text-sm text-zinc-700 shadow-sm transition hover:border-zinc-400 hover:bg-zinc-100"
      >
        <span className="font-medium text-zinc-900">Nouvel agent</span>
        <span className="shrink-0 text-xs font-semibold uppercase tracking-wide text-zinc-500">Afficher le formulaire</span>
      </button>
    );
  }

  return (
    <section className="mt-8 rounded-xl border border-zinc-200 bg-white p-5 shadow-sm">
      <div className="mb-4 flex flex-wrap items-start justify-between gap-2">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-zinc-500">Nouvel agent</h2>
        <button
          type="button"
          onClick={() => setOpen(false)}
          className="rounded-lg border border-zinc-300 bg-white px-3 py-1 text-xs font-medium text-zinc-600 hover:bg-zinc-50"
        >
          Réduire
        </button>
      </div>
      {children}
    </section>
  );
}
