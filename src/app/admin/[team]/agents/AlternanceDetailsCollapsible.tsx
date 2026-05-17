"use client";

import { useState } from "react";

type Props = {
  defaultOpen: boolean;
  children: React.ReactNode;
};

export function AlternanceDetailsCollapsible({ defaultOpen, children }: Props) {
  const [open, setOpen] = useState(defaultOpen);

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="text-[11px] font-medium text-zinc-600 underline hover:text-zinc-900"
      >
        Afficher la configuration A/B
      </button>
    );
  }

  return (
    <div className="mt-2 border-t border-zinc-200 pt-2">
      <button
        type="button"
        onClick={() => setOpen(false)}
        className="mb-2 text-[11px] font-medium text-zinc-500 hover:text-zinc-800"
      >
        Masquer la configuration A/B
      </button>
      {children}
    </div>
  );
}
