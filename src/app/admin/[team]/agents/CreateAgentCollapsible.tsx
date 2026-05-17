"use client";

import { useState } from "react";

type Props = {
  children: React.ReactNode;
};

export function CreateAgentCollapsible({ children }: Props) {
  const [open, setOpen] = useState(false);

  return (
    <section className="mb-6 w-full">
      {!open ? (
        <div className="flex justify-center">
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="inline-flex items-center gap-2 rounded-lg bg-zinc-900 px-4 py-2 text-sm font-medium text-white shadow-sm transition hover:bg-zinc-800"
        >
          <span aria-hidden>+</span>
          Nouvel agent
        </button>
        </div>
      ) : (
        <div className="w-full rounded-xl border border-zinc-200 bg-white p-5 shadow-sm">
          <div className="mb-5 flex flex-wrap items-center justify-between gap-2">
            <h2 className="text-base font-semibold text-zinc-900">Nouvel agent</h2>
            <button
              type="button"
              onClick={() => setOpen(false)}
              className="rounded-lg border border-zinc-300 px-3 py-1.5 text-xs font-medium text-zinc-600 hover:bg-zinc-50"
            >
              Annuler
            </button>
          </div>
          {children}
        </div>
      )}
    </section>
  );
}
