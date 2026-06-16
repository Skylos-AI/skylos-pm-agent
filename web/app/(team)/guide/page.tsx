import { redirect } from "next/navigation";
import { currentUser } from "@/lib/auth/current-user";
import { MermaidDiagram } from "@/components/pm/mermaid-diagram";

const TEAM_CHART = `flowchart LR
  classDef person fill:#FFFFFF,stroke:#2D5BFF,stroke-width:1.5px,color:#1A202C
  classDef bot fill:#29D6E5,stroke:#29D6E5,color:#FFFFFF,stroke-width:1px
  classDef phase fill:#F2F4F7,stroke:#E2E8F0,color:#1A202C
  classDef ops fill:#1A202C,stroke:#1A202C,color:#FFFFFF

  Start([Importar 60 leads]):::ops --> A1

  subgraph PhaseA["Fase A · Outreach"]
    direction TB
    A1["/companies · pestaña Outreach"]:::phase
    A2["📞 Marcar contactado<br/>(Eduardo, Manu)"]:::phase
    A3["Generar borrador de outreach<br/>(Eduardo, Manu)"]:::phase
    A4["+ Registrar actividad<br/>(Eduardo)"]:::phase
    A5["/pipeline · kanban<br/>(Eduardo + Jhonny en NEGOTIATION)"]:::phase
    A1 --> A2 --> A4
    A1 --> A3 --> A4
    A4 --> A5
  end

  A5 -->|"Deal WON"| Convert["↗ Mover a cliente activo<br/>(Jhonny aprueba)"]:::phase

  subgraph PhaseB["Fase B · Delivery"]
    direction TB
    B1["+ Nuevo proyecto<br/>(Claudio define alcance)"]:::phase
    B2["/projects/[id]<br/>(Claudio ejecuta)"]:::phase
    B3["+ Nueva tarea<br/>TODO → IN_PROGRESS → DONE"]:::phase
    B4["/tasks · cola personal"]:::phase
    B5["+ Registrar actividad<br/>(Claudio + Manu en seguimientos)"]:::phase
    B1 --> B2 --> B3 --> B4
    B2 --> B5
  end

  Convert --> B1

  E["👤 Eduardo<br/>Ventas + Outreach"]:::person
  C["👤 Claudio<br/>Delivery + Proyectos"]:::person
  J["👤 Jhonny<br/>Founder · supervisión"]:::person
  M["🤖 Manu (OpenClaw)<br/>WhatsApp / Telegram / cron"]:::bot

  E -.-> PhaseA
  C -.-> PhaseB
  J -.-> PhaseA
  J -.-> PhaseB
  M -.->|"crea tareas,<br/>resúmenes diarios"| PhaseA
  M -.->|"recordatorios,<br/>follow-ups"| PhaseB

  PhaseA --> S["/standup<br/>(resumen diario, Manu lo manda 9am)"]:::phase
  PhaseB --> S
  S --> AL["/agent-log · auditoría<br/>(web + Manu + cron)"]:::ops
`;

const AUDIO_CHART = `flowchart LR
  classDef person fill:#FFFFFF,stroke:#2D5BFF,color:#1A202C
  classDef bot fill:#29D6E5,stroke:#29D6E5,color:#FFFFFF
  classDef ext fill:#E536A8,stroke:#E536A8,color:#FFFFFF
  classDef sys fill:#F2F4F7,stroke:#E2E8F0,color:#1A202C

  user["👤 Cualquiera del equipo"]:::person
  user -->|"🎤 voice note<br/>(Telegram / WhatsApp)"| transport["Transporte<br/>Telegram Bot API /<br/>WhatsApp Business API"]:::sys
  transport -->|"OGG opus blob"| transcribe["Whisper API<br/>(OpenAI · es-BO)"]:::ext
  transcribe -->|"texto"| manu["🤖 Manu<br/>OpenClaw runtime + skills"]:::bot
  manu -->|"lee/escribe"| db[("Supabase<br/>agent_log + datos")]:::sys
  manu -->|"respuesta texto"| tts["ElevenLabs TTS<br/>(voz es-419)"]:::ext
  tts -->|"OGG opus"| transport
  transport -->|"🎙 voice reply"| user
`;

export default async function GuidePage() {
  const user = await currentUser();
  if (!user) redirect("/login");

  return (
    <div className="min-h-screen p-8 lg:p-10 space-y-8 max-w-5xl">
      <header>
        <h1 className="font-display text-5xl tracking-tight leading-tight">
          Guía
        </h1>
        <p className="text-base text-[var(--brand-fg-muted)] mt-3 max-w-2xl">
          Una empresa siempre está en una de dos fases: la perseguís para que
          firme (Outreach), o ya firmó y le entregás trabajo (Delivery). Acá
          está quién hace qué, cuándo entra Manu, y a dónde apunta todo esto.
        </p>
      </header>

      <section className="bg-[var(--brand-surface)] border border-[var(--brand-border)] rounded-2xl p-6 shadow-sm">
        <h2 className="font-display text-xl tracking-tight mb-4">
          El flujo + quién hace qué
        </h2>
        <MermaidDiagram chart={TEAM_CHART} />
      </section>

      <section className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <Card title="Día típico — Outreach (Eduardo)">
          <ol className="text-sm text-[var(--brand-fg-muted)] space-y-2 list-decimal list-inside">
            <li>
              Abrir{" "}
              <code className="text-[var(--brand-blue)]">/companies</code> en
              la pestaña Outreach (default).
            </li>
            <li>
              Para cada lead que tocás, <strong>📞 Marcar contactado</strong>{" "}
              registra un MESSAGE_SENT por WhatsApp.
            </li>
            <li>
              Si necesitás un texto, entrar a la ficha y{" "}
              <strong>Generar borrador de outreach</strong> (usa la persona del
              sector).
            </li>
            <li>
              Para llamadas / reuniones / propuestas, usar{" "}
              <strong>+ Registrar actividad</strong> con el tipo correcto.
            </li>
            <li>
              Cuando hay deal concreto, crearlo en{" "}
              <code className="text-[var(--brand-blue)]">/pipeline</code> y
              moverlo entre columnas a medida que avanza.
            </li>
          </ol>
        </Card>

        <Card title="Cuando ganás un deal (Jhonny + Claudio)">
          <ol className="text-sm text-[var(--brand-fg-muted)] space-y-2 list-decimal list-inside">
            <li>
              En <code className="text-[var(--brand-blue)]">/pipeline</code>,
              arrastrar la card a WON y confirmar.
            </li>
            <li>
              Jhonny entra a la ficha y aprieta{" "}
              <strong>↗ Mover a cliente activo</strong>.
            </li>
            <li>
              Claudio aprieta <strong>+ Nuevo proyecto</strong>, define
              alcance, tipo de servicio, valor y fecha objetivo.
            </li>
            <li>
              Te lleva a{" "}
              <code className="text-[var(--brand-blue)]">/projects/[id]</code>{" "}
              — Claudio carga tareas y arranca delivery.
            </li>
          </ol>
        </Card>

        <Card title="Día típico — Delivery (Claudio)">
          <ol className="text-sm text-[var(--brand-fg-muted)] space-y-2 list-decimal list-inside">
            <li>
              Abrir <code className="text-[var(--brand-blue)]">/tasks</code> —
              pestaña Abiertas. Mover a IN_PROGRESS al empezar, DONE al
              terminar.
            </li>
            <li>
              Para detalle, entrar al proyecto en{" "}
              <code className="text-[var(--brand-blue)]">/projects/[id]</code>:
              bloqueadores y entregas próximas a la vista.
            </li>
            <li>
              Registrar cada llamada / mensaje al cliente desde la ficha de la
              empresa. Mantiene el historial limpio para el próximo standup.
            </li>
          </ol>
        </Card>

        <Card title="Resúmenes y auditoría (Jhonny)">
          <ul className="text-sm text-[var(--brand-fg-muted)] space-y-2 list-disc list-inside">
            <li>
              <code className="text-[var(--brand-blue)]">/standup</code>:
              resumen del día (hoy, vencidas, en curso, bloqueadas). Manu lo
              manda al grupo a las 9am.
            </li>
            <li>
              <code className="text-[var(--brand-blue)]">/activity</code>:
              feed global filtrable.
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
        </Card>
      </section>

      <section className="bg-[var(--brand-bg)] border border-[var(--brand-border)] rounded-2xl p-5">
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

      <section className="bg-[var(--brand-surface)] border border-[var(--brand-border)] rounded-2xl p-6 shadow-sm">
        <div className="mb-4">
          <p className="text-xs uppercase tracking-wide text-[var(--brand-fg-muted)] mb-1">
            Objetivo final
          </p>
          <h2 className="font-display text-2xl tracking-tight">
            Manu hablado: audio de ida y vuelta
          </h2>
          <p className="text-sm text-[var(--brand-fg-muted)] mt-2 max-w-2xl">
            Manu ya entiende texto. Para que también escuche y responda en
            audio (lo natural en WhatsApp boliviano), el pipeline se ve así:
          </p>
        </div>
        <MermaidDiagram chart={AUDIO_CHART} />
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-6 text-sm">
          <div>
            <h3 className="font-medium mb-2">Lo que hay que sumar</h3>
            <ul className="text-[var(--brand-fg-muted)] space-y-1.5 list-disc list-inside">
              <li>
                <strong>STT</strong>: Whisper API (OpenAI) — voz a texto, soporta
                español rioplatense / boliviano sin entrenamiento extra.
              </li>
              <li>
                <strong>TTS</strong>: ElevenLabs (calidad alta, voz es-419) o
                OpenAI TTS si querés el stack más barato.
              </li>
              <li>
                <strong>Transporte</strong>: ya está en Telegram. Para WhatsApp,
                Twilio o 360dialog como BSP (Phase 4 del roadmap).
              </li>
              <li>
                <strong>Skill nueva en Manu</strong>:{" "}
                <code>transcribe-audio</code> +{" "}
                <code>synthesize-reply</code> envueltas con el runner
                existente.
              </li>
            </ul>
          </div>
          <div>
            <h3 className="font-medium mb-2">Costo estimado (3 personas)</h3>
            <ul className="text-[var(--brand-fg-muted)] space-y-1.5 list-disc list-inside">
              <li>
                Whisper: ~$0.006 / minuto. 50 horas/mes ≈{" "}
                <strong>$18/mes</strong>.
              </li>
              <li>
                ElevenLabs Starter: <strong>$5/mes</strong> (30k chars ≈ 30 min
                de respuesta).
              </li>
              <li>
                LLM ya cuenta (parte de Manu).
              </li>
              <li>
                Total típico de inicio:{" "}
                <strong>$25–40/mes</strong> según volumen real.
              </li>
            </ul>
          </div>
        </div>
      </section>
    </div>
  );
}

function Card({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div className="bg-[var(--brand-surface)] border border-[var(--brand-border)] rounded-2xl p-5 shadow-sm hover:shadow-md transition">
      <h2 className="font-display text-lg tracking-tight mb-3">{title}</h2>
      {children}
    </div>
  );
}
