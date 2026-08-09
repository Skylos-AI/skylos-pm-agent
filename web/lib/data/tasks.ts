import "server-only";
import { createServiceRoleClient } from "@/lib/supabase/service-role";
import type { MyTaskRow } from "@/lib/types/tasks";

export type { MyTaskRow };

export async function getMyTasks(userId: string): Promise<MyTaskRow[]> {
  const supa = createServiceRoleClient();
  const { data } = await supa
    .from("tasks")
    .select(
      "id, title, description, status, priority, due_date, estimated_hours, resources, project:projects(id, name), assignee:users!tasks_assignee_id_fkey(id, full_name), notes:task_notes(id, body, created_at, author_agent, author:users(id, full_name)), reminders(id, message, trigger_at, status, created_by_agent)",
    )
    .eq("assignee_id", userId)
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
