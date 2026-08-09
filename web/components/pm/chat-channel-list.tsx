"use client";

import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { MessageSquarePlus, Users, User } from "lucide-react";
import { createChatChannel } from "@/lib/mutations/chat";
import type { ChatChannelListItem } from "@/lib/data/chat";

type TeamMember = { id: string; full_name: string };

export function ChatChannelList({
  channels,
  currentUserId,
  teamMembers,
}: {
  channels: ChatChannelListItem[];
  currentUserId: string;
  teamMembers: TeamMember[];
}) {
  const params = useParams<{ channelId?: string }>();
  const active = params?.channelId;
  const [dialog, setDialog] = useState<"none" | "dm" | "group">("none");

  return (
    <aside className="w-72 shrink-0 border-r border-[var(--brand-border)] bg-[var(--brand-surface)]/85 backdrop-blur-sm flex flex-col sticky top-0 h-screen">
      <div className="px-5 pt-5 pb-3 flex items-center justify-between">
        <h2 className="font-display text-lg tracking-tight">Chat</h2>
        <div className="flex items-center gap-1">
          <button
            type="button"
            title="Nuevo mensaje directo"
            onClick={() => setDialog("dm")}
            className="p-1.5 rounded-md text-[var(--brand-fg-muted)] hover:bg-[var(--brand-fg)]/[0.06] hover:text-[var(--brand-fg)]"
          >
            <User size={16} />
          </button>
          <button
            type="button"
            title="Nuevo canal grupal"
            onClick={() => setDialog("group")}
            className="p-1.5 rounded-md text-[var(--brand-fg-muted)] hover:bg-[var(--brand-fg)]/[0.06] hover:text-[var(--brand-fg)]"
          >
            <MessageSquarePlus size={16} />
          </button>
        </div>
      </div>

      <nav className="flex-1 overflow-y-auto px-2 pb-4 space-y-0.5">
        {channels.length === 0 && (
          <p className="px-3 py-6 text-xs text-[var(--brand-fg-muted)]">
            Sin canales aún. Iniciá uno con los botones de arriba.
          </p>
        )}
        {channels.map((c) => {
          const isActive = active === c.id;
          const label =
            c.kind === "GROUP"
              ? (c.name ?? "Canal")
              : (c.members.find((m) => m.user_id !== currentUserId)?.full_name ??
                "Mensaje directo");
          const preview =
            c.last_message?.deleted_at != null
              ? "Mensaje eliminado"
              : (c.last_message?.body ?? "Sin mensajes");
          return (
            <Link
              key={c.id}
              href={`/chat/${c.id}`}
              className={`block px-3 py-2 rounded-lg text-sm transition-colors ${
                isActive
                  ? "bg-[var(--brand-blue)]/[0.08] text-[var(--brand-blue)]"
                  : "text-[var(--brand-fg)] hover:bg-[var(--brand-fg)]/[0.04]"
              }`}
            >
              <div className="flex items-center gap-2 min-w-0">
                {c.kind === "GROUP" ? (
                  <Users size={14} className="shrink-0 opacity-60" />
                ) : (
                  <User size={14} className="shrink-0 opacity-60" />
                )}
                <span className="truncate font-medium">{label}</span>
                {c.unread_count > 0 && (
                  <span className="ml-auto text-[10px] bg-[var(--brand-blue)] text-white rounded-full px-1.5 py-0.5 min-w-[18px] text-center">
                    {c.unread_count}
                  </span>
                )}
              </div>
              <div className="mt-0.5 pl-6 text-xs text-[var(--brand-fg-muted)] truncate">
                {preview}
              </div>
            </Link>
          );
        })}
      </nav>

      {dialog !== "none" && (
        <NewChannelDialog
          mode={dialog}
          teamMembers={teamMembers}
          onClose={() => setDialog("none")}
        />
      )}
    </aside>
  );
}

function NewChannelDialog({
  mode,
  teamMembers,
  onClose,
}: {
  mode: "dm" | "group";
  teamMembers: TeamMember[];
  onClose: () => void;
}) {
  const router = useRouter();
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [name, setName] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function toggle(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (mode === "dm") {
        next.clear();
        next.add(id);
      } else {
        if (next.has(id)) next.delete(id);
        else next.add(id);
      }
      return next;
    });
  }

  function submit() {
    setError(null);
    const memberIds = Array.from(selected);
    if (memberIds.length === 0) {
      setError("Elegí al menos un miembro.");
      return;
    }
    if (mode === "group" && name.trim().length === 0) {
      setError("Poné un nombre al canal.");
      return;
    }
    startTransition(async () => {
      const res = await createChatChannel({
        kind: mode === "dm" ? "DIRECT" : "GROUP",
        name: mode === "group" ? name.trim() : undefined,
        memberIds,
      });
      if (!res.ok) {
        setError(res.error.message);
        return;
      }
      onClose();
      router.push(`/chat/${res.data.id}`);
      router.refresh();
    });
  }

  return (
    <div
      className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center px-4"
      onClick={onClose}
    >
      <div
        className="bg-[var(--brand-surface)] border border-[var(--brand-border)] rounded-xl w-full max-w-md p-6 shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <h3 className="font-display text-xl tracking-tight mb-1">
          {mode === "dm" ? "Nuevo mensaje directo" : "Nuevo canal grupal"}
        </h3>
        <p className="text-xs text-[var(--brand-fg-muted)] mb-4">
          {mode === "dm"
            ? "Elegí una persona del equipo."
            : "Elegí los miembros y ponéle un nombre."}
        </p>

        {mode === "group" && (
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Nombre del canal, ej: proyecto-alpha"
            className="w-full mb-3 px-3 py-2 rounded-md border border-[var(--brand-border)] bg-transparent text-sm focus:outline-none focus:ring-2 focus:ring-[var(--brand-blue)]/30"
          />
        )}

        <div className="space-y-1 max-h-60 overflow-y-auto border border-[var(--brand-border)] rounded-md p-2">
          {teamMembers.length === 0 && (
            <p className="text-xs text-[var(--brand-fg-muted)] px-2 py-3">
              No hay otros miembros del equipo.
            </p>
          )}
          {teamMembers.map((m) => (
            <label
              key={m.id}
              className="flex items-center gap-2 px-2 py-1.5 rounded hover:bg-[var(--brand-fg)]/[0.04] cursor-pointer"
            >
              <input
                type={mode === "dm" ? "radio" : "checkbox"}
                name="member"
                checked={selected.has(m.id)}
                onChange={() => toggle(m.id)}
              />
              <span className="text-sm">{m.full_name}</span>
            </label>
          ))}
        </div>

        {error && <p className="mt-3 text-xs text-red-500">{error}</p>}

        <div className="mt-5 flex justify-end gap-2">
          <button
            type="button"
            onClick={onClose}
            className="px-3 py-1.5 text-sm rounded-md text-[var(--brand-fg-muted)] hover:text-[var(--brand-fg)]"
          >
            Cancelar
          </button>
          <button
            type="button"
            onClick={submit}
            disabled={isPending}
            className="px-3 py-1.5 text-sm rounded-md bg-[var(--brand-blue)] text-white hover:opacity-90 disabled:opacity-50"
          >
            {isPending ? "Creando…" : "Crear"}
          </button>
        </div>
      </div>
    </div>
  );
}
