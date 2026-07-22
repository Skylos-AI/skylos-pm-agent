import "server-only";
import { createServiceRoleClient } from "@/lib/supabase/service-role";

export type WaTemplate = {
  id: string;
  channel: "WHATSAPP" | "EMAIL";
  stage_trigger: string;
  vertical: string | null;
  body: string;
  variables_required: string[];
  send_delay_hours: number;
  send_window: { days?: number[]; start?: string; end?: string } | null;
  next_template_id: string | null;
  active: boolean;
  updated_at: string;
};

export type WaApproval = {
  id: string;
  company_id: string;
  template_id: string;
  rendered_body: string;
  status: string;
  created_at: string;
  companies: { name: string; sector: string | null; wa_jid: string | null } | null;
};

export type WaDueCompany = {
  id: string;
  name: string;
  next_action: string;
  next_action_at: string | null;
  sequence_position: number;
  wa_jid: string | null;
};

export type WaSendRow = {
  id: string;
  template_id: string;
  wa_message_id: string;
  sent_at: string;
  companies: { name: string } | null;
};

export type WaInboundRow = {
  wa_message_id: string;
  jid: string;
  company_id: string | null;
  text: string | null;
  received_at: string;
  company_name: string | null;
};

export type WaOverview = {
  enabled: boolean;
  approvals: WaApproval[];
  due: WaDueCompany[];
  errored: WaDueCompany[];
  recentSends: WaSendRow[];
  recentInbound: WaInboundRow[];
};

export async function getWaOverview(): Promise<WaOverview> {
  const supa = createServiceRoleClient();

  const [setting, approvals, queue, sends, inbound] = await Promise.all([
    supa.from("app_settings").select("value").eq("key", "outreach_enabled").maybeSingle(),
    supa
      .from("pending_approvals")
      .select(
        "id, company_id, template_id, rendered_body, status, created_at, companies(name, sector, wa_jid)",
      )
      .eq("status", "PENDING")
      .order("created_at", { ascending: true }),
    supa
      .from("companies")
      .select("id, name, next_action, next_action_at, sequence_position, wa_jid")
      .not("next_action", "is", null)
      .order("next_action_at", { ascending: true, nullsFirst: false }),
    supa
      .from("wa_sends")
      .select("id, template_id, wa_message_id, sent_at, companies(name)")
      .order("sent_at", { ascending: false })
      .limit(20),
    supa
      .from("wa_inbound")
      .select("wa_message_id, jid, company_id, text, received_at")
      .order("received_at", { ascending: false })
      .limit(20),
  ]);

  for (const r of [setting, approvals, queue, sends, inbound]) {
    if (r.error) throw new Error(r.error.message);
  }

  const all = (queue.data ?? []) as WaDueCompany[];
  const errored = all.filter((c) => c.next_action.startsWith("error_"));
  const due = all.filter((c) => !c.next_action.startsWith("error_"));

  // Resolve company names for inbound rows that matched a company.
  const inboundRows = (inbound.data ?? []) as Omit<WaInboundRow, "company_name">[];
  const companyIds = [...new Set(inboundRows.map((r) => r.company_id).filter(Boolean))] as string[];
  const nameById = new Map<string, string>();
  if (companyIds.length) {
    const { data: named } = await supa.from("companies").select("id, name").in("id", companyIds);
    for (const c of named ?? []) nameById.set(c.id, c.name);
  }

  return {
    enabled: setting.data?.value === true,
    approvals: (approvals.data ?? []) as unknown as WaApproval[],
    due,
    errored,
    recentSends: (sends.data ?? []) as unknown as WaSendRow[],
    recentInbound: inboundRows.map((r) => ({
      ...r,
      company_name: r.company_id ? (nameById.get(r.company_id) ?? null) : null,
    })),
  };
}

export async function getWaTemplates(): Promise<WaTemplate[]> {
  const supa = createServiceRoleClient();
  const { data, error } = await supa
    .from("message_templates")
    .select("*")
    .order("id", { ascending: true });
  if (error) throw new Error(error.message);
  return (data ?? []) as WaTemplate[];
}
