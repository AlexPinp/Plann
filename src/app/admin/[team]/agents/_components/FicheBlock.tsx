type Props = {
  title: string;
  children: React.ReactNode;
  aside?: React.ReactNode;
};

/** Section interne d'une fiche (sans carte imbriquée). */
export function FicheBlock({ title, children, aside }: Props) {
  return (
    <section className="px-4 py-3">
      <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-[11px] font-semibold uppercase tracking-wide text-zinc-500">{title}</h2>
        {aside}
      </div>
      {children}
    </section>
  );
}
