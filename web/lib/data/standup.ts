import "server-only";
import { createServiceRoleClient } from "@/lib/supabase/service-role";

const OPEN = ["TODO", "IN_PROGRESS", "BLOCKED"] as const;

export type StandupTask = {
  id: string;
  title: string;
  status: string;
  priority: string;
  due_date: string | null;
  project: { id: string; name: string } | null;
};

export type StandupActivity = {
  id: string;
  type: string;
  description: string;
  occurred_at: string;
  company: { id: string; name: string } | null;
};

export type StandupDeal = {
  id: string;
  title: string;
  stage: string;
  value_bob: string | null;
  updated_at: string;
  company: { id: string; name: string } | null;
};

export type StandupData = {
  user_name: string;
  date_iso: string;
  due_today: StandupTask[];
  overdue: StandupTask[];
  in_progress: StandupTask[];
  blocked: StandupTask[];
  completed_yesterday: StandupTask[];
  pipeline_moves_yesterday: StandupDeal[];
  recent_activity: StandupActivity[];
  summary_text: string;
};

export async function getStandupData(
  userId: string,
  userName: string,
): Promise<StandupData> {
  const supa = createServiceRoleClient();
  const now = new Date();
  const startOfDay = new Date(now);
  startOfDay.setUTCHours(4, 0, 0, 0); // La Paz midnight
  const endOfDay = new Date(startOfDay.getTime() + 86400000);
  const startOfYesterday = new Date(startOfDay.getTime() - 86400000);

  const [
    dueTodayRes,
    overdueRes,
    inProgressRes,
    blockedRes,
    completedYesterdayRes,
    pipelineMovesRes,
    ownedCompaniesRes,
  ] = await Promise.all([
    supa
      .from("tasks")
      .select(
        "id, title, status, priority, due_date, project:projects(id, name)",
      )
      .eq("assignee_id", userId)
      .in("status", OPEN)
      .gte("due_date", startOfDay.toISOString())
      .lt("due_date", endOfDay.toISOString())
      .order("due_date", { ascending: true }),
    supa
      .from("tasks")
      .select(
        "id, title, status, priority, due_date, project:projects(id, name)",
      )
      .eq("assignee_id", userId)
      .in("status", OPEN)
      .lt("due_date", startOfDay.toISOString())
      .order("due_date", { ascending: true }),
    supa
      .from("tasks")
      .select(
        "id, title, status, priority, due_date, project:projects(id, name)",
      )
      .eq("assignee_id", userId)
      .eq("status", "IN_PROGRESS")
      .order("updated_at", { ascending: false })
      .limit(8),
    supa
      .from("tasks")
      .select(
        "id, title, status, priority, due_date, project:projects(id, name)",
      )
      .eq("assignee_id", userId)
      .eq("status", "BLOCKED")
      .order("updated_at", { ascending: false }),
    supa
      .from("tasks")
      .select(
        "id, title, status, priority, due_date, project:projects(id, name)",
      )
      .eq("assignee_id", userId)
      .eq("status", "DONE")
      .gte("completed_at", startOfYesterday.toISOString())
      .lt("completed_at", startOfDay.toISOString())
      .order("completed_at", { ascending: false }),
    supa
      .from("pipeline_deals")
      .select(
        "id, title, stage, value_bob, updated_at, company:companies(id, name)",
      )
      .gte("updated_at", startOfYesterday.toISOString())
      .order("updated_at", { ascending: false })
      .limit(8),
    supa.from("companies").select("id").eq("assigned_to_id", userId),
  ]);

  let recent_activity: StandupActivity[] = [];
  const companyIds = (ownedCompaniesRes.data ?? []).map((c) => c.id);
  if (companyIds.length > 0) {
    const { data } = await supa
      .from("activities")
      .select(
        "id, type, description, occurred_at, company:companies(id, name)",
      )
      .in("company_id", companyIds)
      .gte("occurred_at", startOfYesterday.toISOString())
      .order("occurred_at", { ascending: false })
      .limit(8);
    recent_activity = (data ?? []) as unknown as StandupActivity[];
  }

  const due_today = (dueTodayRes.data ?? []) as unknown as StandupTask[];
  const overdue = (overdueRes.data ?? []) as unknown as StandupTask[];
  const in_progress = (inProgressRes.data ?? []) as unknown as StandupTask[];
  const blocked = (blockedRes.data ?? []) as unknown as StandupTask[];
  const completed_yesterday = (completedYesterdayRes.data ??
    []) as unknown as StandupTask[];
  const pipeline_moves_yesterday = (pipelineMovesRes.data ??
    []) as unknown as StandupDeal[];

  const summary_text = buildSummary(userName, {
    due_today,
    overdue,
    in_progress,
    blocked,
    completed_yesterday,
    pipeline_moves_yesterday,
  });

  return {
    user_name: userName,
    date_iso: now.toISOString().slice(0, 10),
    due_today,
    overdue,
    in_progress,
    blocked,
    completed_yesterday,
    pipeline_moves_yesterday,
    recent_activity,
    summary_text,
  };
}

function buildSummary(
  name: string,
  d: {
    due_today: StandupTask[];
    overdue: StandupTask[];
    in_progress: StandupTask[];
    blocked: StandupTask[];
    completed_yesterday: StandupTask[];
    pipeline_moves_yesterday: StandupDeal[];
  },
): string {
  const lines: string[] = [];
  lines.push(`*Standup ${name} — ${new Date().toLocaleDateString("es-BO")}*`);
  if (d.completed_yesterday.length > 0) {
    lines.push(
      `Ayer cerré: ${d.completed_yesterday.map((t) => t.title).join(", ")}.`,
    );
  }
  if (d.due_today.length > 0) {
    lines.push(`Hoy: ${d.due_today.map((t) => t.title).join(", ")}.`);
  } else if (d.in_progress.length > 0) {
    lines.push(`Hoy sigo con: ${d.in_progress.map((t) => t.title).join(", ")}.`);
  }
  if (d.overdue.length > 0) {
    lines.push(`Vencidas (${d.overdue.length}): ${d.overdue.map((t) => t.title).join(", ")}.`);
  }
  if (d.blocked.length > 0) {
    lines.push(
      `Bloqueadas (${d.blocked.length}): ${d.blocked.map((t) => t.title).join(", ")}.`,
    );
  }
  if (d.pipeline_moves_yesterday.length > 0) {
    lines.push(
      `Pipeline ayer: ${d.pipeline_moves_yesterday.length} negocio(s) actualizado(s).`,
    );
  }
  if (lines.length === 1) lines.push("Sin actividad nueva.");
  return lines.join("\n");
}
