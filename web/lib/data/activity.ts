import "server-only";
import { createServiceRoleClient } from "@/lib/supabase/service-role";
import type {
  ActivityFeedRow,
  ActivityType,
  ActivityChannel,
} from "@/lib/types/activity";

export type { ActivityFeedRow };

export type ActivityFilters = {
  companyId?: string;
  projectId?: string;
  userId?: string;
  type?: ActivityType;
  channel?: ActivityChannel;
  fromDate?: string;
  toDate?: string;
};

export async function getActivityFeed(filters?: ActivityFilters): Promise<{
  activities: ActivityFeedRow[];
  companies: { id: string; name: string }[];
  projects: { id: string; name: string }[];
  users: { id: string; full_name: string }[];
}> {
  const supa = createServiceRoleClient();
  let q = supa
    .from("activities")
    .select(
      "id, type, channel, description, occurred_at, company:companies(id, name), project:projects(id, name), logged_by:users(id, full_name)",
    )
    .order("occurred_at", { ascending: false })
    .limit(200);
  if (filters?.companyId) q = q.eq("company_id", filters.companyId);
  if (filters?.projectId) q = q.eq("project_id", filters.projectId);
  if (filters?.userId) q = q.eq("logged_by_id", filters.userId);
  if (filters?.type) q = q.eq("type", filters.type);
  if (filters?.channel) q = q.eq("channel", filters.channel);
  if (filters?.fromDate) q = q.gte("occurred_at", filters.fromDate);
  if (filters?.toDate) q = q.lte("occurred_at", filters.toDate);

  const [{ data: rows }, { data: companies }, { data: projects }, { data: users }] =
    await Promise.all([
      q,
      supa
        .from("companies")
        .select("id, name")
        .order("name", { ascending: true })
        .limit(500),
      supa
        .from("projects")
        .select("id, name")
        .order("name", { ascending: true })
        .limit(200),
      supa
        .from("users")
        .select("id, full_name")
        .eq("is_active", true)
        .order("full_name", { ascending: true }),
    ]);

  return {
    activities: (rows ?? []) as unknown as ActivityFeedRow[],
    companies: (companies ?? []) as { id: string; name: string }[],
    projects: (projects ?? []) as { id: string; name: string }[],
    users: (users ?? []) as { id: string; full_name: string }[],
  };
}
