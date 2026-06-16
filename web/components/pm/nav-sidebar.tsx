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
} from "lucide-react";
import { t } from "@/lib/i18n/es";

const nav = [
  { href: "/dashboard", label: t.nav.dashboard, icon: LayoutDashboard },
  { href: "/pipeline", label: t.nav.pipeline, icon: KanbanSquare },
  { href: "/projects", label: t.nav.projects, icon: FolderKanban },
  { href: "/companies", label: t.nav.companies, icon: Building2 },
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
  return (
    <aside className="w-60 shrink-0 border-r border-[var(--brand-border)] bg-[var(--brand-surface)] flex flex-col">
      <div className="px-6 pt-6 pb-8">
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
        <p className="mt-2 text-xs text-[var(--brand-fg-muted)] tracking-wide uppercase">
          {t.app.tagline}
        </p>
      </div>
      <nav className="flex-1 px-3 space-y-1">
        {nav.map((item) => {
          const active =
            pathname === item.href || pathname.startsWith(item.href + "/");
          return (
            <Link
              key={item.href}
              href={item.href}
              className={`flex items-center gap-3 px-3 py-2 rounded-lg text-sm transition ${
                active
                  ? "bg-[var(--brand-blue)] text-white shadow-sm"
                  : "text-[var(--brand-fg-muted)] hover:bg-[var(--brand-bg)] hover:text-[var(--brand-fg)]"
              }`}
            >
              <item.icon size={16} />
              {item.label}
            </Link>
          );
        })}
      </nav>
      <div className="border-t border-[var(--brand-border)] px-4 py-4">
        <div className="text-sm font-medium truncate">{userFullName}</div>
        <div className="text-xs text-[var(--brand-fg-muted)] truncate">
          {userEmail}
        </div>
        <form action="/auth/sign-out" method="post" className="mt-3">
          <button
            type="submit"
            className="flex items-center gap-2 text-xs text-[var(--brand-fg-muted)] hover:text-[var(--brand-fg)]"
          >
            <LogOut size={14} />
            {t.nav.signOut}
          </button>
        </form>
      </div>
    </aside>
  );
}
