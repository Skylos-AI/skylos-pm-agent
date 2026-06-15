import "server-only";
import { createServiceRoleClient } from "@/lib/supabase/service-role";
import type { MyTaskRow } from "@/lib/types/tasks";

export type { MyTaskRow };

export async function getMyTasks(userId: string): Promise<MyTaskRow[]> {
  const supa = createServiceRoleClient();
  const { data } = await supa
    .from("tasks")
    .select(
      "id, title, status, priority, due_date, project:projects(id, name)",
    )
    .eq("assignee_id", userId)
    .order("due_date", { ascending: true, nullsFirst: false })
    .order("priority", { ascending: false })
    .limit(500);
  return (data ?? []) as unknown as MyTaskRow[];
}
