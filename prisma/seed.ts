/**
 * Seed for Skylos PM Agent — Phase 1.
 *
 * Idempotent: keyed on natural unique fields (email, nit, etc.) so re-running
 * does not duplicate rows. Real team contacts, persona content, and Base
 * Unificada data get swapped in later — these placeholders exist purely so
 * scripts/validate-schema.ts passes against a fresh database.
 *
 * Order:
 *   1. Users (3)
 *   2. Personas (6)
 *   3. Companies (120 placeholders — swap with Base Unificada import later)
 *   4. Contacts (1-2 per top 30 companies)
 *   5. Projects (6)
 *   6. Pipeline deals (12 across 4 stages)
 *   7. Tasks (8 per user)
 *   8. Activities (24)
 */

import {
  PrismaClient,
  UserRole,
  CompanySource,
  CompanyStatus,
  ProjectStatus,
  ServiceType,
  TaskStatus,
  TaskPriority,
  ActivityType,
  ActivityChannel,
  PipelineStage,
} from "@prisma/client";

const prisma = new PrismaClient();

// ---------- Users ----------
// Placeholders. Replace emails / WhatsApp numbers with real Skylos team data
// before any demo. WhatsApp numbers must stay E.164 to pass validation.
const USER_SEED = [
  {
    email: "jhonny@skylos.io",
    fullName: "Jhonny Placeholder",
    role: UserRole.FOUNDER,
    whatsappNumber: "+59170000001",
  },
  {
    email: "eduardo@skylos.io",
    fullName: "Eduardo Placeholder",
    role: UserRole.SALES,
    whatsappNumber: "+59170000002",
  },
  {
    email: "claudio@skylos.io",
    fullName: "Claudio Placeholder",
    role: UserRole.DELIVERY,
    whatsappNumber: "+59170000003",
  },
];

// ---------- Personas ----------
// Skeleton content. Replace `description`, `painPoints`, and `outreachTemplate`
// with real Skylos persona-doc content before demo. `language` must stay "es".
const PERSONA_SEED = [
  {
    name: "Gerente de Logística",
    segment: "logistics",
    description:
      "Responsable de operaciones logísticas en una mediana empresa boliviana. Coordina flotas, rutas y proveedores. (Placeholder — reemplazar con contenido real del documento de personas.)",
    painPoints: [
      "Planificación manual de rutas",
      "Falta de visibilidad sobre entregas",
      "Reportes en Excel desactualizados",
    ],
    outreachTemplate:
      "Hola {{contact_name}}, vi que en {{company_name}} manejan logística diaria. Trabajamos con empresas como la suya automatizando rutas y reportes. ¿Le interesa ver un caso de 10 minutos?",
  },
  {
    name: "Socio de Estudio Jurídico-Contable",
    segment: "legal_accounting",
    description:
      "Socio o gerente de un estudio jurídico-contable mediano. Maneja carteras de clientes y obligaciones tributarias. (Placeholder — reemplazar con contenido real.)",
    painPoints: [
      "Cumplimiento tributario manual",
      "Pérdida de tiempo buscando documentos",
      "Comunicación dispersa con clientes",
    ],
    outreachTemplate:
      "Hola {{contact_name}}, en {{company_name}} ayudamos a estudios como el suyo a automatizar cumplimiento y reducir 30% de tiempo administrativo. ¿Tiene 10 minutos esta semana?",
  },
  {
    name: "Dueño de Cadena Retail",
    segment: "retail",
    description:
      "Dueño o gerente general de una cadena retail con 2-10 puntos de venta. Necesita visibilidad de inventario y ventas. (Placeholder.)",
    painPoints: [
      "Inventarios descuadrados entre sucursales",
      "Reportes de ventas semanales manuales",
      "Pronóstico de demanda intuitivo",
    ],
    outreachTemplate:
      "Hola {{contact_name}}, en {{company_name}} ayudamos a cadenas retail con dashboards de inventario en tiempo real. ¿Le interesa una demo de 10 min?",
  },
  {
    name: "Director Clínico",
    segment: "healthcare",
    description:
      "Director o administrador de clínica o consultorio. Maneja agendas, historiales y facturación. (Placeholder.)",
    painPoints: [
      "Agenda fragmentada entre médicos",
      "Historiales clínicos en papel",
      "Facturación lenta",
    ],
    outreachTemplate:
      "Hola {{contact_name}}, en {{company_name}} ayudamos a clínicas a digitalizar agendas e historiales clínicos. ¿Le interesa una demo de 10 min?",
  },
  {
    name: "Gerente de Construcción / Inmobiliaria",
    segment: "construction_real_estate",
    description:
      "Gerente de proyecto o director comercial en constructora o inmobiliaria mediana. Maneja obras, leads y ventas. (Placeholder — el segmento prioritario para el seed de Base Unificada.)",
    painPoints: [
      "Seguimiento de leads disperso",
      "Cronogramas de obra en Excel",
      "Reportes de avance manuales",
    ],
    outreachTemplate:
      "Hola {{contact_name}}, en {{company_name}} ayudamos a constructoras e inmobiliarias a centralizar leads y avance de obra. ¿Le interesa una demo de 10 min?",
  },
  {
    name: "Gerente Agroindustrial",
    segment: "agribusiness",
    description:
      "Gerente o dueño de operación agroindustrial. Maneja cultivos, cosecha y comercialización. (Placeholder.)",
    painPoints: [
      "Decisiones agronómicas sin datos",
      "Trazabilidad manual",
      "Comercialización reactiva",
    ],
    outreachTemplate:
      "Hola {{contact_name}}, en {{company_name}} ayudamos a operaciones agroindustriales a tomar decisiones con datos. ¿Le interesa una demo de 10 min?",
  },
];

// ---------- Companies (placeholders) ----------
// Generated to satisfy validation thresholds (>=100 with nit + department).
// Real data lands later via scripts/import-base-unificada.ts.
const DEPARTMENTS = ["Cochabamba", "La Paz", "Santa Cruz"];
const CITIES_BY_DEPT: Record<string, string[]> = {
  Cochabamba: ["Cochabamba", "Quillacollo", "Sacaba"],
  "La Paz": ["La Paz", "El Alto", "Viacha"],
  "Santa Cruz": ["Santa Cruz de la Sierra", "Warnes", "Montero"],
};
const SECTORS = ["construction", "real_estate"];

function generateCompanyRows() {
  const rows: Array<{
    name: string;
    nit: string;
    sector: string;
    city: string;
    department: string;
    externalId: string;
  }> = [];
  for (let i = 1; i <= 120; i++) {
    const sector = SECTORS[i % SECTORS.length];
    const dept = DEPARTMENTS[i % DEPARTMENTS.length];
    const cities = CITIES_BY_DEPT[dept];
    const city = cities[i % cities.length];
    const sectorLabel = sector === "construction" ? "Constructora" : "Inmobiliaria";
    rows.push({
      name: `${sectorLabel} Placeholder ${String(i).padStart(3, "0")}`,
      nit: `9000${String(100000 + i).padStart(7, "0")}`,
      sector,
      city,
      department: dept,
      externalId: `base-unif-${i}`,
    });
  }
  return rows;
}

async function main() {
  console.log("→ seeding users");
  for (const u of USER_SEED) {
    await prisma.user.upsert({
      where: { email: u.email },
      update: {
        fullName: u.fullName,
        role: u.role,
        whatsappNumber: u.whatsappNumber,
      },
      create: u,
    });
  }
  const users = await prisma.user.findMany({ orderBy: { email: "asc" } });
  const founder = users.find((u) => u.role === UserRole.FOUNDER)!;
  const sales = users.find((u) => u.role === UserRole.SALES)!;
  const delivery = users.find((u) => u.role === UserRole.DELIVERY)!;

  console.log("→ seeding personas");
  for (const p of PERSONA_SEED) {
    const existing = await prisma.persona.findFirst({
      where: { name: p.name },
    });
    if (existing) {
      await prisma.persona.update({
        where: { id: existing.id },
        data: { ...p, language: "es" },
      });
    } else {
      await prisma.persona.create({ data: { ...p, language: "es" } });
    }
  }
  const personas = await prisma.persona.findMany();
  const realEstatePersona = personas.find(
    (p) => p.segment === "construction_real_estate",
  )!;

  console.log("→ seeding companies");
  const companyRows = generateCompanyRows();
  for (const c of companyRows) {
    await prisma.company.upsert({
      where: { nit: c.nit },
      update: {
        name: c.name,
        sector: c.sector,
        city: c.city,
        department: c.department,
        source: CompanySource.BASE_UNIFICADA,
        primaryPersonaId: realEstatePersona.id,
        externalId: c.externalId,
      },
      create: {
        name: c.name,
        nit: c.nit,
        sector: c.sector,
        city: c.city,
        department: c.department,
        source: CompanySource.BASE_UNIFICADA,
        status: CompanyStatus.LEAD,
        primaryPersonaId: realEstatePersona.id,
        assignedToId: sales.id,
        externalId: c.externalId,
      },
    });
  }
  const companies = await prisma.company.findMany({
    orderBy: { createdAt: "asc" },
    take: 30,
  });

  console.log("→ seeding contacts");
  for (const [i, company] of companies.entries()) {
    const primaryNit = `${company.nit}-c1`;
    const existing = await prisma.contact.findFirst({
      where: { companyId: company.id, isPrimary: true },
    });
    if (!existing) {
      await prisma.contact.create({
        data: {
          companyId: company.id,
          fullName: `Contacto Principal ${i + 1}`,
          role: i % 2 === 0 ? "Gerente General" : "Director Comercial",
          phone: `+5917000${String(1000 + i).padStart(4, "0")}`,
          whatsapp: `+5917000${String(1000 + i).padStart(4, "0")}`,
          email: `contacto${i + 1}@${company.nit?.slice(-5)}.example`,
          isPrimary: true,
          notes: primaryNit,
        },
      });
    }
  }

  console.log("→ seeding projects");
  const projectSeed = [
    {
      name: "Nexum — Plataforma Web3",
      serviceType: ServiceType.BLOCKCHAIN_WEB3,
      status: ProjectStatus.ACTIVE,
      ownerId: delivery.id,
      companyIndex: 0,
      valueBob: "350000.00",
    },
    {
      name: "ATT — Auditoría IA",
      serviceType: ServiceType.AI_AUDIT,
      status: ProjectStatus.ACTIVE,
      ownerId: founder.id,
      companyIndex: 1,
      valueBob: "85000.00",
    },
    {
      name: "Retainer Constructora Andes",
      serviceType: ServiceType.RETAINER,
      status: ProjectStatus.ACTIVE,
      ownerId: delivery.id,
      companyIndex: 2,
      valueBob: "120000.00",
    },
    {
      name: "Automatización CRM Inmobiliaria Sur",
      serviceType: ServiceType.AUTOMATION,
      status: ProjectStatus.PLANNING,
      ownerId: founder.id,
      companyIndex: 3,
      valueBob: "65000.00",
    },
    {
      name: "Capacitación IA — Estudio Jurídico",
      serviceType: ServiceType.TRAINING,
      status: ProjectStatus.COMPLETED,
      ownerId: founder.id,
      companyIndex: 4,
      valueBob: "28000.00",
    },
    {
      name: "Software a medida — Logística CBBA",
      serviceType: ServiceType.CUSTOM_SOFTWARE,
      status: ProjectStatus.ON_HOLD,
      ownerId: delivery.id,
      companyIndex: 5,
      valueBob: "180000.00",
    },
  ];

  const projectIds: string[] = [];
  for (const p of projectSeed) {
    const company = companies[p.companyIndex];
    const existing = await prisma.project.findFirst({
      where: { name: p.name, companyId: company.id },
    });
    const project = existing
      ? await prisma.project.update({
          where: { id: existing.id },
          data: {
            status: p.status,
            serviceType: p.serviceType,
            ownerId: p.ownerId,
            valueBob: p.valueBob,
          },
        })
      : await prisma.project.create({
          data: {
            name: p.name,
            companyId: company.id,
            status: p.status,
            serviceType: p.serviceType,
            ownerId: p.ownerId,
            valueBob: p.valueBob,
            startDate: new Date("2026-01-15"),
            targetEndDate: new Date("2026-09-30"),
          },
        });
    projectIds.push(project.id);
  }

  console.log("→ seeding pipeline deals");
  const dealStages = [
    PipelineStage.LEAD,
    PipelineStage.QUALIFIED,
    PipelineStage.PROPOSAL,
    PipelineStage.NEGOTIATION,
  ];
  for (let i = 0; i < 12; i++) {
    const company = companies[(i + 6) % companies.length];
    const stage = dealStages[i % dealStages.length];
    const title = `Oportunidad ${i + 1} — ${company.name}`;
    const existing = await prisma.pipelineDeal.findFirst({
      where: { title, companyId: company.id },
    });
    const data = {
      title,
      companyId: company.id,
      stage,
      valueBob: (50000 + i * 15000).toFixed(2),
      probability:
        stage === PipelineStage.LEAD
          ? 20
          : stage === PipelineStage.QUALIFIED
            ? 40
            : stage === PipelineStage.PROPOSAL
              ? 60
              : 75,
      ownerId: sales.id,
      expectedCloseDate: new Date(`2026-${String(7 + (i % 3)).padStart(2, "0")}-15`),
    };
    if (existing) {
      await prisma.pipelineDeal.update({ where: { id: existing.id }, data });
    } else {
      await prisma.pipelineDeal.create({ data });
    }
  }

  console.log("→ seeding tasks");
  const taskTitles = [
    "Revisar propuesta",
    "Llamar a contacto principal",
    "Preparar demo",
    "Enviar contrato",
    "Reunión de kickoff",
    "Auditar pipeline",
    "Actualizar CRM",
    "Confirmar pago",
  ];
  const taskStatuses = [
    TaskStatus.TODO,
    TaskStatus.IN_PROGRESS,
    TaskStatus.BLOCKED,
    TaskStatus.TODO,
    TaskStatus.IN_PROGRESS,
    TaskStatus.TODO,
    TaskStatus.TODO,
    TaskStatus.DONE,
  ];
  for (const user of users) {
    for (let i = 0; i < taskTitles.length; i++) {
      const title = `${taskTitles[i]} (${user.fullName.split(" ")[0]})`;
      const existing = await prisma.task.findFirst({
        where: { title, assigneeId: user.id },
      });
      const data = {
        title,
        assigneeId: user.id,
        status: taskStatuses[i],
        priority: i % 4 === 0 ? TaskPriority.HIGH : TaskPriority.MEDIUM,
        projectId: projectIds[i % projectIds.length],
        dueDate: new Date(`2026-07-${String((i % 28) + 1).padStart(2, "0")}`),
        createdById: founder.id,
      };
      if (existing) {
        await prisma.task.update({ where: { id: existing.id }, data });
      } else {
        await prisma.task.create({ data });
      }
    }
  }

  console.log("→ seeding activities");
  const activityCompanies = companies.slice(0, 12);
  const activityTypes = [
    ActivityType.CALL,
    ActivityType.MEETING,
    ActivityType.MESSAGE_SENT,
    ActivityType.PROPOSAL_SENT,
  ];
  const activityChannels = [
    ActivityChannel.WHATSAPP,
    ActivityChannel.VIDEO_CALL,
    ActivityChannel.PHONE,
    ActivityChannel.IN_PERSON,
  ];
  for (let i = 0; i < 24; i++) {
    const company = activityCompanies[i % activityCompanies.length];
    const description = `Interacción seed ${i + 1} con ${company.name}`;
    const existing = await prisma.activity.findFirst({
      where: { companyId: company.id, description },
    });
    if (existing) continue;
    await prisma.activity.create({
      data: {
        companyId: company.id,
        type: activityTypes[i % activityTypes.length],
        channel: activityChannels[i % activityChannels.length],
        description,
        loggedById: i % 2 === 0 ? sales.id : founder.id,
        occurredAt: new Date(`2026-05-${String((i % 28) + 1).padStart(2, "0")}`),
        projectId: i % 4 === 0 ? projectIds[i % projectIds.length] : null,
      },
    });
  }

  console.log("✓ seed complete");
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
