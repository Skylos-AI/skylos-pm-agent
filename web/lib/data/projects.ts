import "server-only";
import { createServiceRoleClient } from "@/lib/supabase/service-role";
import type { Pace, ProjectStatus, ProjectTask } from "@/lib/types/projects";

export type { Pace, ProjectStatus, ProjectTask };

const OPEN = ["TODO", "IN_PROGRESS", "BLOCKED"] as const;

export type ProjectListRow = {
  id: string;
  name: string;
  status: ProjectStatus;
  service_type: string;
  value_bob: string | null;
  target_end_date: string | null;
  company: { id: string; name: string } | null;
  owner: { id: string; full_name: string } | null;
  progress_pct: number;
  pace: Pace;
};

export type ProjectFilters = {
  status?: ProjectStatus;
  ownerId?: string;
  serviceType?: string;
};

export async function getProjectsList(
  filters?: ProjectFilters,
): Promise<{ projects: ProjectListRow[]; owners: { id: string; full_name: string }[] }> {
  const supa = createServiceRoleClient();
  let q = supa
    .from("projects")
    .select(
      "id, name, status, service_type, value_bob, start_date, target_end_date, company:companies(id, name), owner:users!projects_owner_id_fkey(id, full_name), tasks(status)",
    )
    .order("updated_at", { ascending: false });
  if (filters?.status) q = q.eq("status", filters.status);
  if (filters?.ownerId) q = q.eq("owner_id", filters.ownerId);
  if (filters?.serviceType) q = q.eq("service_type", filters.serviceType);

  const { data: raw } = await q;
  const { data: ownersData } = await supa
    .from("users")
    .select("id, full_name")
    .eq("is_active", true)
    .order("full_name", { ascending: true });

  const projects: ProjectListRow[] = (raw ?? []).map((p) => {
    const tasks = ((p.tasks ?? []) as { status: string }[]) || [];
    const total = tasks.length;
    const done = tasks.filter((t) => t.status === "DONE").length;
    const progress_pct = total === 0 ? 0 : Math.round((done / total) * 100);
    return {
      id: p.id as string,
      name: p.name as string,
      status: p.status as ProjectStatus,
      service_type: p.service_type as string,
      value_bob: (p.value_bob as string | null) ?? null,
      target_end_date: (p.target_end_date as string | null) ?? null,
      company: (p.company ?? null) as { id: string; name: string } | null,
      owner: (p.owner ?? null) as { id: string; full_name: string } | null,
      progress_pct,
      pace: computePace(
        p.start_date as string | null,
        p.target_end_date as string | null,
        progress_pct,
      ),
    };
  });

  return {
    projects,
    owners: (ownersData ?? []) as { id: string; full_name: string }[],
  };
}

export type ProjectActivity = {
  id: string;
  type: string;
  channel: string;
  description: string;
  occurred_at: string;
};

export type ProjectDetail = {
  id: string;
  name: string;
  description: string | null;
  status: ProjectStatus;
  service_type: string;
  value_bob: string | null;
  start_date: string | null;
  target_end_date: string | null;
  actual_end_date: string | null;
  created_at: string;
  company: { id: string; name: string } | null;
  owner: { id: string; full_name: string } | null;
  progress_pct: number;
  pace: Pace;
  days_to_target_end: number | null;
  blockers: { id: string; title: string }[];
  upcoming_milestones: {
    id: string;
    title: string;
    due_date: string;
    days_until: number;
  }[];
  tasks_open: ProjectTask[];
  tasks_done: ProjectTask[];
  recent_activities: ProjectActivity[];
};

export async function getProjectDetail(
  id: string,
): Promise<ProjectDetail | null> {
  const supa = createServiceRoleClient();
  const { data: p } = await supa
    .from("projects")
    .select(
      "id, name, description, status, service_type, value_bob, start_date, target_end_date, actual_end_date, created_at, company:companies(id, name), owner:users!projects_owner_id_fkey(id, full_name)",
    )
    .eq("id", id)
    .maybeSingle();
  if (!p) return null;

  const [{ data: tasksData }, { data: actData }] = await Promise.all([
    supa
      .from("tasks")
      .select(
        "id, title, status, priority, due_date, updated_at, assignee:users!tasks_assignee_id_fkey(id, full_name)",
      )
      .eq("project_id", id)
      .order("due_date", { ascending: true, nullsFirst: false }),
    supa
      .from("activities")
      .select("id, type, channel, description, occurred_at")
      .eq("project_id", id)
      .order("occurred_at", { ascending: false })
      .limit(10),
  ]);

  const tasks = (tasksData ?? []) as unknown as ProjectTask[];
  const total = tasks.length;
  const done = tasks.filter((t) => t.status === "DONE").length;
  const progress_pct = total === 0 ? 0 : Math.round((done / total) * 100);
  const pace = computePace(
    p.start_date as string | null,
    p.target_end_date as string | null,
    progress_pct,
  );

  const today = new Date();
  const todayIso = today.toISOString().slice(0, 10);
  const days_to_target_end = p.target_end_date
    ? daysBetween(todayIso, (p.target_end_date as string).slice(0, 10))
    : null;

  const blockers = tasks
    .filter((t) => t.status === "BLOCKED")
    .map((t) => ({ id: t.id, title: t.title }));

  const upcoming_milestones = tasks
    .filter((t) => OPEN.includes(t.status as (typeof OPEN)[number]) && t.due_date)
    .map((t) => ({
      id: t.id,
      title: t.title,
      due_date: t.due_date as string,
      days_until: daysBetween(todayIso, (t.due_date as string).slice(0, 10)),
    }))
    .filter((m) => m.days_until >= 0 && m.days_until <= 7)
    .sort((a, b) => a.days_until - b.days_until);

  return {
    id: p.id as string,
    name: p.name as string,
    description: (p.description as string | null) ?? null,
    status: p.status as ProjectStatus,
    service_type: p.service_type as string,
    value_bob: (p.value_bob as string | null) ?? null,
    start_date: (p.start_date as string | null) ?? null,
    target_end_date: (p.target_end_date as string | null) ?? null,
    actual_end_date: (p.actual_end_date as string | null) ?? null,
    created_at: p.created_at as string,
    company: (p.company ?? null) as { id: string; name: string } | null,
    owner: (p.owner ?? null) as { id: string; full_name: string } | null,
    progress_pct,
    pace,
    days_to_target_end,
    blockers,
    upcoming_milestones,
    tasks_open: tasks.filter((t) =>
      OPEN.includes(t.status as (typeof OPEN)[number]),
    ),
    tasks_done: tasks.filter((t) => t.status === "DONE"),
    recent_activities: (actData ?? []) as unknown as ProjectActivity[],
  };
}

function daysBetween(fromIsoDate: string, toIsoDate: string): number {
  const a = Date.parse(fromIsoDate);
  const b = Date.parse(toIsoDate);
  return Math.round((b - a) / 86400000);
}

function computePace(
  startDate: string | null,
  targetEndDate: string | null,
  progressPct: number,
): Pace {
  if (!startDate || !targetEndDate) return "unknown";
  const today = new Date().toISOString().slice(0, 10);
  const totalSpan = daysBetween(startDate.slice(0, 10), targetEndDate.slice(0, 10));
  if (totalSpan <= 0) return "unknown";
  const elapsed = daysBetween(startDate.slice(0, 10), today);
  const expected = Math.max(0, Math.min(100, (elapsed / totalSpan) * 100));
  if (progressPct > expected + 10) return "ahead";
  if (progressPct < expected - 10) return "behind";
  return "on_track";
}
