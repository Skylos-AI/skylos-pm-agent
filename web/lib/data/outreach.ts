import "server-only";
import { createServiceRoleClient } from "@/lib/supabase/service-role";

export type OutreachRow = {
  id: string;
  name: string;
  city: string | null;
  department: string | null;
  status: string;
  preferred_channel:
    | "WHATSAPP"
    | "PHONE"
    | "EMAIL"
    | "IN_PERSON"
    | "MIXED"
    | null;
  next_touch_at: string;
  last_touch: {
    occurred_at: string;
    type: string;
    channel: string;
    outcome: string | null;
  } | null;
};

export async function getOutreachQueue(): Promise<OutreachRow[]> {
  const supa = createServiceRoleClient();
  const endOfDay = new Date();
  endOfDay.setUTCHours(23, 59, 59, 999);

  const { data, error } = await supa
    .from("companies")
    .select(
      "id, name, city, department, status, preferred_channel, next_touch_at",
    )
    .not("next_touch_at", "is", null)
    .lte("next_touch_at", endOfDay.toISOString())
    .in("status", ["LEAD", "PROSPECT", "ACTIVE_CLIENT"])
    .order("next_touch_at", { ascending: true });
  if (error) throw new Error(error.message);
  if (!data || data.length === 0) return [];

  const companyIds = data.map((c) => c.id);
  const { data: touches } = await supa
    .from("activities")
    .select("company_id, occurred_at, type, channel, outcome")
    .in("company_id", companyIds)
    .order("occurred_at", { ascending: false });

  const lastByCompany = new Map<string, OutreachRow["last_touch"]>();
  for (const t of touches ?? []) {
    if (lastByCompany.has(t.company_id)) continue;
    lastByCompany.set(t.company_id, {
      occurred_at: t.occurred_at,
      type: t.type,
      channel: t.channel,
      outcome: t.outcome,
    });
  }

  return data.map((c) => ({
    ...c,
    last_touch: lastByCompany.get(c.id) ?? null,
  }));
}
