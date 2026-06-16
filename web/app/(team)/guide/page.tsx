import { redirect } from "next/navigation";
import { currentUser } from "@/lib/auth/current-user";
import { MermaidDiagram } from "@/components/pm/mermaid-diagram";

const CHART = `flowchart LR
  Start([Importar leads · npm run import:outreach]) --> A1

  subgraph PhaseA["Fase A · Outreach (perseguir contrato)"]
    direction TB
    A1["/companies · pestaña Outreach"]
    A2["📞 Marcar contactado<br/>(MESSAGE_SENT por WhatsApp)"]
    A3["Generar borrador<br/>de outreach"]
    A4["+ Registrar actividad<br/>llamada / reunión / propuesta"]
    A5["/pipeline · kanban<br/>LEAD → QUALIFIED → PROPOSAL → NEGOTIATION"]
    A1 --> A2
    A1 --> A3
    A2 --> A4
    A3 --> A4
    A4 --> A5
  end

  A5 -->|"Deal WON"| Convert

  Convert["↗ Mover a cliente activo<br/>(en ficha de empresa)"]

  subgraph PhaseB["Fase B · Delivery (entregar el trabajo)"]
    direction TB
    B1["+ Nuevo proyecto<br/>desde la ficha de empresa"]
    B2["/projects/[id]<br/>progreso + bloqueadores + tareas"]
    B3["+ Nueva tarea<br/>TODO → IN_PROGRESS → DONE"]
    B4["/tasks · cola personal"]
    B5["+ Registrar actividad<br/>del proyecto"]
    B1 --> B2
    B2 --> B3
    B2 --> B5
    B3 --> B4
  end

  Convert --> B1

  PhaseA -.-> S["/standup · resumen diario"]
  PhaseB -.-> S
  S -.-> AL["/agent-log · auditoría completa<br/>web + Manu + cron"]
`;

export default async function GuidePage() {
  const user = await currentUser();
  if (!user) redirect("/login");

  return (
    <div className="min-h-screen p-8 lg:p-10 space-y-6 max-w-5xl">
      <header>
        <h1 className="font-display text-4xl tracking-tight">Guía rápida</h1>
        <p className="text-sm text-[var(--brand-fg-muted)] mt-2">
          Una empresa siempre está en una de dos fases: la perseguís para que
          firme (Outreach), o ya firmó y le entregás trabajo (Delivery). Acá
          está el flujo completo de cómo se mueve por la app.
        </p>
      </header>

      <section className="bg-[var(--brand-surface)] border border-[var(--brand-border)] rounded-xl p-6">
        <MermaidDiagram chart={CHART} />
      </section>

      <section className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div className="bg-[var(--brand-surface)] border border-[var(--brand-border)] rounded-xl p-5">
          <h2 className="font-display text-lg tracking-tight mb-3">
            Día típico — Outreach
          </h2>
          <ol className="text-sm text-[var(--brand-fg-muted)] space-y-2 list-decimal list-inside">
            <li>
              Abrir{" "}
              <code className="text-[var(--brand-blue)]">/companies</code> en la
              pestaña Outreach (default).
            </li>
            <li>
              Para cada lead que tocás, hacer click en{" "}
              <strong>📞 Marcar contactado</strong> — queda registrado como
              MESSAGE_SENT por WhatsApp.
            </li>
            <li>
              Si necesitás un texto sugerido, entrar a la ficha y usar{" "}
              <strong>Generar borrador de outreach</strong>.
            </li>
            <li>
              Para llamadas, reuniones o propuestas, usar{" "}
              <strong>+ Registrar actividad</strong> con el tipo correcto.
            </li>
            <li>
              Cuando hay un negocio concreto en juego, crearlo en{" "}
              <code className="text-[var(--brand-blue)]">/pipeline</code> y
              moverlo entre columnas a medida que avanza.
            </li>
          </ol>
        </div>

        <div className="bg-[var(--brand-surface)] border border-[var(--brand-border)] rounded-xl p-5">
          <h2 className="font-display text-lg tracking-tight mb-3">
            Cuando ganás un deal
          </h2>
          <ol className="text-sm text-[var(--brand-fg-muted)] space-y-2 list-decimal list-inside">
            <li>
              En <code className="text-[var(--brand-blue)]">/pipeline</code>,
              arrastrar la card a WON y confirmar.
            </li>
            <li>
              Ir a la ficha de la empresa y apretar{" "}
              <strong>↗ Mover a cliente activo</strong>.
            </li>
            <li>
              Aparece <strong>+ Nuevo proyecto</strong>: crear el primer
              proyecto con nombre, tipo de servicio, valor y fecha objetivo.
            </li>
            <li>
              Te lleva a{" "}
              <code className="text-[var(--brand-blue)]">/projects/[id]</code>:
              cargar tareas y arrancar.
            </li>
          </ol>
        </div>

        <div className="bg-[var(--brand-surface)] border border-[var(--brand-border)] rounded-xl p-5">
          <h2 className="font-display text-lg tracking-tight mb-3">
            Día típico — Delivery
          </h2>
          <ol className="text-sm text-[var(--brand-fg-muted)] space-y-2 list-decimal list-inside">
            <li>
              Abrir{" "}
              <code className="text-[var(--brand-blue)]">/tasks</code> —
              pestaña Abiertas. Mover tareas a IN_PROGRESS al empezar y a
              DONE al terminar.
            </li>
            <li>
              Para detalle, entrar al proyecto en{" "}
              <code className="text-[var(--brand-blue)]">/projects/[id]</code>:
              ahí ves bloqueadores y entregas próximas.
            </li>
            <li>
              Registrar cada llamada / mensaje al cliente desde la ficha de la
              empresa. Mantiene el historial limpio para el próximo standup.
            </li>
          </ol>
        </div>

        <div className="bg-[var(--brand-surface)] border border-[var(--brand-border)] rounded-xl p-5">
          <h2 className="font-display text-lg tracking-tight mb-3">
            Resúmenes y auditoría
          </h2>
          <ul className="text-sm text-[var(--brand-fg-muted)] space-y-2 list-disc list-inside">
            <li>
              <code className="text-[var(--brand-blue)]">/standup</code>:
              ofrece un resumen del día (hoy, vencidas, en curso, bloqueadas) y
              te lo copia listo para pegar en el grupo.
            </li>
            <li>
              <code className="text-[var(--brand-blue)]">/activity</code>:
              feed global filtrable — útil para responder &quot;¿qué pasó con
              X la semana pasada?&quot;.
            </li>
            <li>
              <code className="text-[var(--brand-blue)]">/agent-log</code>:
              cada acción (web, Manu, cron) queda registrada. Si algo se
              comportó raro, empezá acá.
            </li>
            <li>
              <code className="text-[var(--brand-blue)]">/dashboard</code>:
              números clave del día (tareas, pipeline, recordatorios).
            </li>
          </ul>
        </div>
      </section>

      <section className="bg-[var(--brand-bg)] border border-[var(--brand-border)] rounded-xl p-5">
        <h2 className="font-display text-lg tracking-tight mb-2">
          Regla principal
        </h2>
        <p className="text-sm text-[var(--brand-fg)]">
          Toda acción que toques en la web también la hace Manu desde WhatsApp
          y queda en <code className="text-[var(--brand-blue)]">agent_log</code>{" "}
          como{" "}
          <code className="text-[var(--brand-blue)]">source=&apos;WEB&apos;</code>.
          No hay datos paralelos — la app y el agente comparten la misma base.
        </p>
      </section>
    </div>
  );
}
