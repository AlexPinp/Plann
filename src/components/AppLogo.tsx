import Link from "next/link";

type AppLogoProps = {
  href?: string;
  className?: string;
};

export function AppLogo({ href, className }: AppLogoProps) {
  const content = (
    <span className={["inline-flex items-center gap-2.5", className].filter(Boolean).join(" ")}>
      <span
        className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-sm font-bold text-white shadow-sm"
        style={{ background: "var(--header-gradient)" }}
        aria-hidden
      >
        P
      </span>
      <span className="text-base font-semibold tracking-tight text-[var(--text)]">Plann</span>
    </span>
  );

  if (href) {
    return (
      <Link href={href} className="rounded-md transition-opacity hover:opacity-85">
        {content}
      </Link>
    );
  }

  return content;
}
