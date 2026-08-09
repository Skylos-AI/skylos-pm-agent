import { MessageSquare } from "lucide-react";

export default function ChatIndexPage() {
  return (
    <div className="flex-1 flex flex-col items-center justify-center text-center px-8 text-[var(--brand-fg-muted)]">
      <MessageSquare size={40} className="mb-4 opacity-40" />
      <p className="text-sm">
        Elegí un canal o iniciá un mensaje directo para empezar.
      </p>
    </div>
  );
}
