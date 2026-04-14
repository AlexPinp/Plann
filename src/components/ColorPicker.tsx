"use client";

import { useState } from "react";

const PALETTE = [
  "#d1fae5", // emerald-100
  "#a7f3d0", // emerald-200
  "#bbf7d0", // green-200
  "#fce7f3", // pink-100
  "#fbcfe8", // pink-200
  "#fef3c7", // amber-100
  "#fde68a", // amber-200
  "#ffedd5", // orange-100
  "#fed7aa", // orange-200
  "#dbeafe", // blue-100
  "#bfdbfe", // blue-200
  "#e0e7ff", // indigo-100
  "#ddd6fe", // violet-200
  "#f5f5f4", // stone-100
  "#e5e7eb", // gray-200
];

export function ColorPicker({
  name,
  defaultValue,
}: {
  name: string;
  defaultValue?: string | null;
}) {
  const [selected, setSelected] = useState(defaultValue ?? PALETTE[0]);

  return (
    <div>
      <p className="text-xs font-medium text-zinc-600">Couleur du bloc</p>
      <input type="hidden" name={name} value={selected} />
      <div className="mt-2 flex flex-wrap gap-2">
        {PALETTE.map((color) => (
          <button
            key={color}
            type="button"
            onClick={() => setSelected(color)}
            className={[
              "h-7 w-7 rounded-full border-2 transition-transform hover:scale-110",
              selected === color ? "border-zinc-900 ring-2 ring-zinc-400 ring-offset-1" : "border-zinc-300",
            ].join(" ")}
            style={{ backgroundColor: color }}
            title={color}
            aria-label={`Couleur ${color}`}
          />
        ))}
      </div>
    </div>
  );
}
