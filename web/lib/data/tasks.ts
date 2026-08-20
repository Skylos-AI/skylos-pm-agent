import "server-only";
import { createServiceRoleClient } from "@/lib/supabase/service-role";
import type { MyTaskRow } from "@/lib/types/tasks";

export type { MyTaskRow };

const TASK_SELECT =
  "id, title, description, status, priority, due_date, estimated_hours, resources, project:projects(id, name), assignee:users!tasks_assignee_id_fkey(id, full_name), notes:task_notes(id, body, created_at, author_agent, author:users(id, full_name)), reminders(id, message, trigger_at, status, created_by_agent), reviewers:task_reviewers(id, user_id, approved_at, rejected_at, comment, user:users(id, full_name))";

// Fetch tasks with the assignee filter switchable — pass a specific userId to
// scope to that person's tasks (the default "mis tareas" view), or null to
// return everyone's (the "todas" view). Sort and includes stay identical so
// the UI is a straight swap.
export async function getTasks(
  assigneeId: string | null,
): Promise<MyTaskRow[]> {
  const supa = createServiceRoleClient();
  let q = supa
    .from("tasks")
    .select(TASK_SELECT)
    .eq("reminders.status", "PENDING")
    .order("due_date", { ascending: true, nullsFirst: false })
    .order("priority", { ascending: false })
    .order("created_at", {
      referencedTable: "task_notes",
      ascending: false,
    })
    .order("trigger_at", {
      referencedTable: "reminders",
      ascending: true,
    })
    .limit(500);
  if (assigneeId) q = q.eq("assignee_id", assigneeId);
  const { data } = await q;
  return (data ?? []) as unknown as MyTaskRow[];
}

// Back-compat wrapper — some pages import getMyTasks by name.
export async function getMyTasks(userId: string): Promise<MyTaskRow[]> {
  return getTasks(userId);
}

// Tasks the given user is a reviewer on and hasn't approved yet. Used to
// build the "pendientes de mi aprobación" queue.
export async function getTasksAwaitingMyReview(
  userId: string,
): Promise<MyTaskRow[]> {
  const supa = createServiceRoleClient();
  const { data: assignments } = await supa
    .from("task_reviewers")
    .select("task_id")
    .eq("user_id", userId)
    .is("approved_at", null);
  const ids = Array.from(
    new Set((assignments ?? []).map((r) => r.task_id as string)),
  );
  if (ids.length === 0) return [];

  const { data } = await supa
    .from("tasks")
    .select(TASK_SELECT)
    .in("id", ids)
    .eq("reminders.status", "PENDING")
    .order("due_date", { ascending: true, nullsFirst: false })
    .order("priority", { ascending: false });
  return (data ?? []) as unknown as MyTaskRow[];
}

export async function getActiveTeamMembers(): Promise<
  { id: string; full_name: string }[]
> {
  const supa = createServiceRoleClient();
  const { data } = await supa
    .from("users")
    .select("id, full_name")
    .eq("is_active", true)
    .order("full_name", { ascending: true });
  return (data ?? []) as { id: string; full_name: string }[];
}

// Lightweight list for the @task autocomplete in chat: open tasks the user
// is likely to reference (not DONE), most recent first.
export async function getOpenTasksForMention(): Promise<
  { id: string; title: string; assignee_full_name: string | null }[]
> {
  const supa = createServiceRoleClient();
  const { data } = await supa
    .from("tasks")
    .select(
      "id, title, assignee:users!tasks_assignee_id_fkey(full_name)",
    )
    .neq("status", "DONE")
    .order("updated_at", { ascending: false })
    .limit(200);
  return ((data ?? []) as unknown as {
    id: string;
    title: string;
    assignee: { full_name: string } | null;
  }[]).map((t) => ({
    id: t.id,
    title: t.title,
    assignee_full_name: t.assignee?.full_name ?? null,
  }));
}
