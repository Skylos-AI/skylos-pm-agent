import "server-only";
import { createServiceRoleClient } from "@/lib/supabase/service-role";

const OPEN = ["TODO", "IN_PROGRESS", "BLOCKED"];

export type DashboardStats = {
  open_tasks: number;
  overdue_tasks: number;
  pipeline_value_bob: number;
  deals_in_motion: number;
};

export type DashboardTask = {
  id: string;
  title: string;
  status: string;
  priority: string;
  due_date: string | null;
  project: { id: string; name: string } | null;
};

export type DashboardDeal = {
  id: string;
  title: string;
  stage: string;
  value_bob: string | null;
  updated_at: string;
  company: { id: string; name: string } | null;
};

export type DashboardActivity = {
  id: string;
  type: string;
  channel: string;
  description: string;
  occurred_at: string;
  company: { id: string; name: string } | null;
};

export type DashboardReminder = {
  id: string;
  message: string;
  trigger_at: string;
  status: string;
};

export async function getDashboardData(userId: string) {
  const supa = createServiceRoleClient();
  const now = new Date();
  const startOfDay = new Date(now);
  startOfDay.setUTCHours(4, 0, 0, 0); // ~midnight La Paz (UTC-4)
  const endOfDay = new Date(startOfDay.getTime() + 86400000);
  const yesterday = new Date(startOfDay.getTime() - 86400000);

  const [
    openTasksRes,
    overdueTasksRes,
    pipelineRes,
    dueTodayRes,
    pipelineMovesRes,
    remindersTodayRes,
    ownedCompaniesRes,
  ] = await Promise.all([
    supa
      .from("tasks")
      .select("id", { count: "exact", head: true })
      .eq("assignee_id", userId)
      .in("status", OPEN),
    supa
      .from("tasks")
      .select("id", { count: "exact", head: true })
      .eq("assignee_id", userId)
      .in("status", OPEN)
      .lt("due_date", startOfDay.toISOString()),
    supa
      .from("pipeline_deals")
      .select("value_bob, stage")
      .not("stage", "in", "(WON,LOST)"),
    supa
      .from("tasks")
      .select(
        "id, title, status, priority, due_date, project:projects(id, name)",
      )
      .eq("assignee_id", userId)
      .in("status", OPEN)
      .gte("due_date", startOfDay.toISOString())
      .lt("due_date", endOfDay.toISOString())
      .order("due_date", { ascending: true })
      .limit(8),
    supa
      .from("pipeline_deals")
      .select(
        "id, title, stage, value_bob, updated_at, company:companies(id, name)",
      )
      .gte("updated_at", yesterday.toISOString())
      .order("updated_at", { ascending: false })
      .limit(6),
    supa
      .from("reminders")
      .select("id, message, trigger_at, status")
      .eq("target_user_id", userId)
      .gte("trigger_at", startOfDay.toISOString())
      .lt("trigger_at", endOfDay.toISOString())
      .order("trigger_at", { ascending: true }),
    supa.from("companies").select("id").eq("assigned_to_id", userId),
  ]);

  let recentActivity: DashboardActivity[] = [];
  const companyIds = (ownedCompaniesRes.data ?? []).map((c) => c.id);
  if (companyIds.length > 0) {
    const { data } = await supa
      .from("activities")
      .select(
        "id, type, channel, description, occurred_at, company:companies(id, name)",
      )
      .in("company_id", companyIds)
      .gte("occurred_at", yesterday.toISOString())
      .order("occurred_at", { ascending: false })
      .limit(8);
    recentActivity = (data ?? []) as unknown as DashboardActivity[];
  }

  const pipelineValue = (pipelineRes.data ?? []).reduce(
    (acc, d) => acc + Number(d.value_bob ?? 0),
    0,
  );

  const stats: DashboardStats = {
    open_tasks: openTasksRes.count ?? 0,
    overdue_tasks: overdueTasksRes.count ?? 0,
    pipeline_value_bob: pipelineValue,
    deals_in_motion: pipelineRes.data?.length ?? 0,
  };

  return {
    stats,
    due_today: (dueTodayRes.data ?? []) as unknown as DashboardTask[],
    pipeline_moves: (pipelineMovesRes.data ?? []) as unknown as DashboardDeal[],
    reminders_today: (remindersTodayRes.data ??
      []) as unknown as DashboardReminder[],
    recent_activity: recentActivity,
  };
}
