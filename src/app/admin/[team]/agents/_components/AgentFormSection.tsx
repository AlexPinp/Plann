type Props = {
  title: string;
  description?: string;
  children: React.ReactNode;
  className?: string;
};

export function AgentFormSection({ title, description, children, className = "" }: Props) {
  return (
    <section className={`rounded-xl border border-zinc-200 bg-zinc-50/40 p-4 ${className}`}>
      <h2 className="text-sm font-semibold text-zinc-900">{title}</h2>
      {description ? <p className="mt-0.5 text-xs leading-relaxed text-zinc-600">{description}</p> : null}
      <div className="mt-4 space-y-4">{children}</div>
    </section>
  );
}
