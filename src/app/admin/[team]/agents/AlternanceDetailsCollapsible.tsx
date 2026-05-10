"use client";

import { useState } from "react";

type Props = {
  /** Ouvre par défaut si l’agent est déjà configuré en alternant */
  defaultOpen: boolean;
  children: React.ReactNode;
};

export function AlternanceDetailsCollapsible({ defaultOpen, children }: Props) {
  const [open, setOpen] = useState(defaultOpen);

  return (
    <div className="mt-2">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-center justify-between gap-3 rounded-lg border border-zinc-200 bg-white px-3 py-2 text-left text-sm text-zinc-800 shadow-sm transition hover:bg-zinc-50"
      >
        <span className="font-medium text-zinc-900">Configuration alternance (A/B)</span>
        <span className="shrink-0 text-xs font-semibold uppercase tracking-wide text-zinc-500">
          {open ? "Réduire" : "Afficher"}
        </span>
      </button>
      <div className={open ? "mt-3" : "hidden"} aria-hidden={!open}>
        {children}
      </div>
    </div>
  );
}
