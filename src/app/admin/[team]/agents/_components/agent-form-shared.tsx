import { normalizeTemplateCycleWeeks } from "@/lib/planning-template";

export const WORK_PERCENTAGES = [100, 90, 80, 75, 70, 60, 50] as const;

export const inputClass = "mt-0.5 w-full rounded-md border border-zinc-300 px-2.5 py-1.5 text-sm";
export const labelClass = "text-[11px] font-medium text-zinc-600";
export const selectClass = `${inputClass} appearance-none bg-none`;

export function WorkPercentageSelect({
  id,
  name,
  defaultValue,
  required,
}: {
  id: string;
  name: string;
  defaultValue: number;
  required?: boolean;
}) {
  return (
    <select id={id} name={name} defaultValue={defaultValue} required={required} className={selectClass}>
      {WORK_PERCENTAGES.map((p) => (
        <option key={p} value={p}>
          {p} %
        </option>
      ))}
    </select>
  );
}

export function TemplateNumberSelect({
  id,
  name,
  defaultValue,
  availableTemplateNumbers,
  templateMetaByNumber,
  emptyLabel = "Aucune",
}: {
  id: string;
  name: string;
  defaultValue: number | null;
  availableTemplateNumbers: number[];
  templateMetaByNumber: Map<number, { cycleWeeks: number }>;
  emptyLabel?: string;
}) {
  return (
    <select id={id} name={name} defaultValue={defaultValue ?? ""} className={selectClass}>
      <option value="">{emptyLabel}</option>
      {availableTemplateNumbers.map((n) => {
        const meta = templateMetaByNumber.get(n);
        return (
          <option key={n} value={n}>
            Trame {n}
            {meta ? ` (${normalizeTemplateCycleWeeks(meta.cycleWeeks)} sem.)` : ""}
          </option>
        );
      })}
    </select>
  );
}
