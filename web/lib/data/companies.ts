import "server-only";
import { createServiceRoleClient } from "@/lib/supabase/service-role";
import type {
  CompanyListRow,
  CompanyStatus,
} from "@/lib/types/companies";

export type { CompanyListRow, CompanyStatus };

const OPEN_PROJECT = ["ACTIVE", "ON_HOLD", "PLANNING"] as const;

export type CompanyFilters = {
  q?: string;
  status?: CompanyStatus;
  sector?: string;
  department?: string;
  assignedToId?: string;
};

export async function getCompaniesList(
  filters?: CompanyFilters,
): Promise<{
  companies: CompanyListRow[];
  owners: { id: string; full_name: string }[];
  sectors: string[];
  departments: string[];
}> {
  const supa = createServiceRoleClient();
  let q = supa
    .from("companies")
    .select(
      "id, name, nit, sector, city, department, status, assigned_to:users!companies_assigned_to_id_fkey(id, full_name)",
    )
    .order("name", { ascending: true })
    .limit(500);
  if (filters?.status) q = q.eq("status", filters.status);
  if (filters?.sector) q = q.eq("sector", filters.sector);
  if (filters?.department) q = q.eq("department", filters.department);
  if (filters?.assignedToId) q = q.eq("assigned_to_id", filters.assignedToId);
  if (filters?.q && filters.q.trim()) {
    const term = filters.q.trim().replace(/[%_]/g, "\\$&");
    q = q.or(`name.ilike.%${term}%,nit.ilike.%${term}%`);
  }

  const [{ data: rows }, { data: owners }, { data: sectorRows }, { data: deptRows }] =
    await Promise.all([
      q,
      supa
        .from("users")
        .select("id, full_name")
        .eq("is_active", true)
        .order("full_name", { ascending: true }),
      supa.from("companies").select("sector").not("sector", "is", null),
      supa.from("companies").select("department").not("department", "is", null),
    ]);

  const sectors = Array.from(
    new Set((sectorRows ?? []).map((r) => r.sector as string).filter(Boolean)),
  ).sort();
  const departments = Array.from(
    new Set(
      (deptRows ?? []).map((r) => r.department as string).filter(Boolean),
    ),
  ).sort();

  return {
    companies: (rows ?? []) as unknown as CompanyListRow[],
    owners: (owners ?? []) as { id: string; full_name: string }[],
    sectors,
    departments,
  };
}

export type CompanyContact = {
  id: string;
  full_name: string;
  role: string | null;
  phone: string | null;
  email: string | null;
  whatsapp: string | null;
  is_primary: boolean;
};

export type CompanyProject = {
  id: string;
  name: string;
  status: string;
  value_bob: string | null;
  target_end_date: string | null;
  progress_summary: string;
};

export type CompanyDeal = {
  id: string;
  title: string;
  stage: string;
  value_bob: string | null;
  expected_close_date: string | null;
};

export type CompanyActivity = {
  id: string;
  type: string;
  channel: string;
  description: string;
  occurred_at: string;
};

export type CompanyDetail = {
  id: string;
  name: string;
  nit: string | null;
  sector: string | null;
  city: string | null;
  department: string | null;
  status: CompanyStatus;
  source: string;
  website: string | null;
  notes: string | null;
  tags: string[];
  assigned_to: { id: string; full_name: string; email: string } | null;
  primary_persona: {
    id: string;
    name: string;
    segment: string;
    outreach_template: string;
  } | null;
  contacts: CompanyContact[];
  active_projects: CompanyProject[];
  open_deals: CompanyDeal[];
  recent_activities: CompanyActivity[];
  next_actions_suggested: string[];
};

export async function getCompanyDetail(
  id: string,
): Promise<CompanyDetail | null> {
  const supa = createServiceRoleClient();
  const { data: c } = await supa
    .from("companies")
    .select(
      "id, name, nit, sector, city, department, status, source, website, notes, tags, assigned_to:users!companies_assigned_to_id_fkey(id, full_name, email), primary_persona:personas(id, name, segment, outreach_template)",
    )
    .eq("id", id)
    .maybeSingle();
  if (!c) return null;

  const [
    { data: contacts },
    { data: projects },
    { data: deals },
    { data: activities },
  ] = await Promise.all([
    supa
      .from("contacts")
      .select("id, full_name, role, phone, email, whatsapp, is_primary")
      .eq("company_id", id)
      .order("is_primary", { ascending: false })
      .order("full_name", { ascending: true }),
    supa
      .from("projects")
      .select("id, name, status, value_bob, target_end_date")
      .eq("company_id", id)
      .in("status", OPEN_PROJECT),
    supa
      .from("pipeline_deals")
      .select("id, title, stage, value_bob, expected_close_date")
      .eq("company_id", id)
      .not("stage", "in", "(WON,LOST)"),
    supa
      .from("activities")
      .select("id, type, channel, description, occurred_at")
      .eq("company_id", id)
      .order("occurred_at", { ascending: false })
      .limit(10),
  ]);

  const projectIds = (projects ?? []).map((p) => p.id as string);
  let outstandingTasks: { status: string; title: string; project_id: string }[] = [];
  let projectsEnriched: CompanyProject[] = [];
  if (projectIds.length > 0) {
    const { data: tasks } = await supa
      .from("tasks")
      .select("status, title, project_id")
      .in("project_id", projectIds);
    outstandingTasks = ((tasks ?? []) as unknown as {
      status: string;
      title: string;
      project_id: string;
    }[]).filter((t) => ["TODO", "IN_PROGRESS", "BLOCKED"].includes(t.status));
    projectsEnriched = (projects ?? []).map((p) => {
      const pt = (tasks ?? []).filter((t) => t.project_id === p.id);
      const done = pt.filter((t) => t.status === "DONE").length;
      return {
        id: p.id as string,
        name: p.name as string,
        status: p.status as string,
        value_bob: (p.value_bob as string | null) ?? null,
        target_end_date: (p.target_end_date as string | null) ?? null,
        progress_summary: `${done} de ${pt.length} tareas completadas`,
      };
    });
  } else {
    projectsEnriched = [];
  }

  const today = new Date().toISOString().slice(0, 10);
  const lastActivityAt = activities?.[0]?.occurred_at as string | undefined;
  const daysSince = lastActivityAt
    ? Math.round(
        (Date.parse(today) - Date.parse(lastActivityAt.slice(0, 10))) / 86400000,
      )
    : Infinity;

  const suggestions: string[] = [];
  if (daysSince > 14) {
    suggestions.push("Contactar al cliente — sin interacciones recientes.");
  }
  const blocked = outstandingTasks.filter((t) => t.status === "BLOCKED");
  if (blocked.length > 0) {
    suggestions.push(
      `Desbloquear ${blocked.length} tarea(s): ${blocked
        .map((t) => `"${t.title}"`)
        .join(", ")}.`,
    );
  }
  if ((deals?.length ?? 0) > 0) {
    suggestions.push(
      `Avanzar ${deals!.length} oportunidad(es) abierta(s) en pipeline.`,
    );
  }

  return {
    id: c.id as string,
    name: c.name as string,
    nit: (c.nit as string | null) ?? null,
    sector: (c.sector as string | null) ?? null,
    city: (c.city as string | null) ?? null,
    department: (c.department as string | null) ?? null,
    status: c.status as CompanyStatus,
    source: c.source as string,
    website: (c.website as string | null) ?? null,
    notes: (c.notes as string | null) ?? null,
    tags: ((c.tags ?? []) as string[]) || [],
    assigned_to: (c.assigned_to ?? null) as
      | { id: string; full_name: string; email: string }
      | null,
    primary_persona: (c.primary_persona ?? null) as
      | { id: string; name: string; segment: string; outreach_template: string }
      | null,
    contacts: (contacts ?? []) as CompanyContact[],
    active_projects: projectsEnriched,
    open_deals: (deals ?? []) as unknown as CompanyDeal[],
    recent_activities: (activities ?? []) as unknown as CompanyActivity[],
    next_actions_suggested: suggestions,
  };
}

export function renderOutreachTemplate(
  template: string,
  companyName: string,
  contactName: string | null,
): string {
  const firstName = contactName ? contactName.split(" ")[0] : "Gerente General";
  return template
    .replace(/\{\{contact_name\}\}/g, firstName)
    .replace(/\{\{company_name\}\}/g, companyName);
}
