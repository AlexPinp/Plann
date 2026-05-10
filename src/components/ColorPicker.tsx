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
}: {
  name: string;
  defaultValue?: string | null;
}) {
  const [selected, setSelected] = useState(defaultValue ?? PALETTE[0].hex);

  return (
    <div>
      <p className="text-xs font-medium text-zinc-600">Couleur du bloc</p>
      <input type="hidden" name={name} value={selected} />
      <div className="mt-2 flex flex-wrap gap-3">
        {PALETTE.map(({ hex, label }) => (
          <button
            key={hex}
            type="button"
            onClick={() => setSelected(hex)}
            className={[
              "h-9 w-9 rounded-full border-2 shadow-sm transition-transform hover:scale-110",
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
