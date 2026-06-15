import Image from "next/image";
import { ReactNode } from "react";

export function ComingSoon({
  title,
  description,
  crystal = "crystal-cube-blue.png",
}: {
  title: string;
  description: string;
  crystal?: string;
}) {
  return (
    <div className="min-h-screen p-8 lg:p-10">
      <h1 className="font-display text-4xl tracking-tight mb-8">{title}</h1>
      <div className="bg-[var(--brand-surface)] border border-[var(--brand-border)] rounded-xl p-12 flex flex-col items-center justify-center text-center min-h-[420px] relative overflow-hidden">
        <div className="w-40 h-40 mb-6 relative">
          <Image
            src={`/crystals/${crystal}`}
            alt=""
            fill
            sizes="160px"
            style={{ objectFit: "contain" }}
          />
        </div>
        <p className="font-display text-2xl mb-2">Próximamente</p>
        <p className="text-sm text-[var(--brand-fg-muted)] max-w-md">
          {description}
        </p>
      </div>
    </div>
  );
}

export function PageShell({
  title,
  subtitle,
  children,
}: {
  title: string;
  subtitle?: string;
  children: ReactNode;
}) {
  return (
    <div className="min-h-screen p-8 lg:p-10">
      <header className="mb-8">
        <h1 className="font-display text-4xl tracking-tight">{title}</h1>
        {subtitle && (
          <p className="text-sm text-[var(--brand-fg-muted)] mt-2">{subtitle}</p>
        )}
      </header>
      {children}
    </div>
  );
}
