"use client";

import { useState } from "react";

/** Pastels lisibles sur les grilles planning : orange, vert, jaune, rose, bleu */
const PALETTE: { hex: string; label: string }[] = [
  { hex: "#fdba74", label: "Orange" },
  { hex: "#86efac", label: "Vert" },
  { hex: "#fde047", label: "Jaune" },
  { hex: "#f9a8d4", label: "Rose" },
  { hex: "#93c5fd", label: "Bleu" },
];

export function ColorPicker({
  name,
  defaultValue,
  compact,
}: {
  name: string;
  defaultValue?: string | null;
  compact?: boolean;
}) {
  const [selected, setSelected] = useState(defaultValue ?? PALETTE[0].hex);
  const dot = compact ? "h-6 w-6" : "h-9 w-9";

  return (
    <div>
      <p className={compact ? "text-[11px] font-medium text-zinc-600" : "text-xs font-medium text-zinc-600"}>
        {compact ? "Couleur" : "Couleur du bloc"}
      </p>
      <input type="hidden" name={name} value={selected} />
      <div className={`flex flex-wrap ${compact ? "mt-1 gap-1.5" : "mt-2 gap-3"}`}>
        {PALETTE.map(({ hex, label }) => (
          <button
            key={hex}
            type="button"
            onClick={() => setSelected(hex)}
            className={[
              `${dot} rounded-full border-2 shadow-sm transition-transform hover:scale-110`,
              selected === hex ? "border-zinc-900 ring-2 ring-zinc-400 ring-offset-1" : "border-white",
            ].join(" ")}
            style={{ backgroundColor: hex }}
            title={label}
            aria-label={`Couleur ${label}`}
          />
        ))}
      </div>
    </div>
  );
}
