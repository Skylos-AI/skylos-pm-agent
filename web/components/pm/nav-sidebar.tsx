"use client";

import Link from "next/link";
import Image from "next/image";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard,
  KanbanSquare,
  FolderKanban,
  Building2,
  ListTodo,
  Activity,
  Sun,
  ScrollText,
  BookOpen,
  LogOut,
  Target,
  Package,
  MessageCircle,
} from "lucide-react";
import { t } from "@/lib/i18n/es";

const nav = [
  { href: "/dashboard", label: t.nav.dashboard, icon: LayoutDashboard },
  { href: "/pipeline", label: t.nav.pipeline, icon: KanbanSquare },
  { href: "/projects", label: t.nav.projects, icon: FolderKanban },
  { href: "/companies", label: t.nav.companies, icon: Building2 },
  { href: "/outreach", label: "Outreach", icon: Target },
  { href: "/wa", label: "WA Auto", icon: MessageCircle },
  { href: "/assets", label: "Assets", icon: Package },
  { href: "/tasks", label: t.nav.tasks, icon: ListTodo },
  { href: "/activity", label: t.nav.activity, icon: Activity },
  { href: "/standup", label: t.nav.standup, icon: Sun },
  { href: "/agent-log", label: t.nav.agentLog, icon: ScrollText },
  { href: "/guide", label: "Guía", icon: BookOpen },
];

export function NavSidebar({
  userFullName,
  userEmail,
}: {
  userFullName: string;
  userEmail: string;
}) {
  const pathname = usePathname();
  const initials = userFullName
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0]?.toUpperCase())
    .join("");
  return (
    <aside className="w-60 shrink-0 border-r border-[var(--brand-border)] bg-[var(--brand-surface)]/85 backdrop-blur-sm flex flex-col sticky top-0 h-screen">
      <div className="px-6 pt-6 pb-6">
        <Link href="/dashboard" className="block">
          <Image
            src="/logo-skylos.svg"
            alt="Skylos"
            width={108}
            height={26}
            style={{ height: "auto" }}
            priority
          />
        </Link>
        <p className="mt-2 text-[11px] text-[var(--brand-fg-muted)] tracking-[0.14em] uppercase">
          {t.app.tagline}
        </p>
      </div>
      <nav className="flex-1 px-3 space-y-0.5 overflow-y-auto pb-4">
        {nav.map((item) => {
          const active =
            pathname === item.href || pathname.startsWith(item.href + "/");
          return (
            <Link
              key={item.href}
              href={item.href}
              className={`group relative flex items-center gap-3 px-3 py-2 rounded-lg text-sm transition-colors duration-150 ${
                active
                  ? "bg-[var(--brand-blue)]/[0.08] text-[var(--brand-blue)] font-medium"
                  : "text-[var(--brand-fg-muted)] hover:bg-[var(--brand-fg)]/[0.04] hover:text-[var(--brand-fg)]"
              }`}
            >
              {active && (
                <span
                  className="absolute left-0 top-1/2 -translate-y-1/2 h-5 w-[3px] rounded-full brand-gradient"
                  aria-hidden
                />
              )}
              <item.icon
                size={16}
                className={
                  active
                    ? ""
                    : "text-[var(--brand-fg-muted)]/70 group-hover:text-[var(--brand-fg-muted)] transition-colors duration-150"
                }
              />
              {item.label}
            </Link>
          );
        })}
      </nav>
      <div className="border-t border-[var(--brand-border)] px-4 py-4">
        <div className="flex items-center gap-3 min-w-0">
          <span
            className="brand-gradient text-white text-xs font-semibold h-8 w-8 rounded-full flex items-center justify-center shrink-0 shadow-sm"
            aria-hidden
          >
            {initials}
          </span>
          <div className="min-w-0">
            <div className="text-sm font-medium truncate">{userFullName}</div>
            <div className="text-xs text-[var(--brand-fg-muted)] truncate">
              {userEmail}
            </div>
          </div>
        </div>
        <form action="/auth/sign-out" method="post" className="mt-3">
          <button
            type="submit"
            className="flex items-center gap-2 text-xs text-[var(--brand-fg-muted)] hover:text-[var(--brand-fg)] transition-colors"
          >
            <LogOut size={14} />
            {t.nav.signOut}
          </button>
        </form>
      </div>
    </aside>
  );
}
