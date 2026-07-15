import "server-only";
import { createServiceRoleClient } from "@/lib/supabase/service-role";

export type AssetKind =
  | "PROPOSAL"
  | "DECK"
  | "ONE_PAGER"
  | "EMAIL_TEMPLATE"
  | "BROCHURE"
  | "CASE_STUDY"
  | "CONTRACT"
  | "OTHER";

export type AssetRow = {
  id: string;
  name: string;
  kind: AssetKind;
  external_url: string | null;
  version: string | null;
  active: boolean;
  notes: string | null;
  usage_count: number;
  last_used_at: string | null;
};

export async function getAssetsList(): Promise<AssetRow[]> {
  const supa = createServiceRoleClient();
  const { data: assets, error } = await supa
    .from("assets")
    .select("id, name, kind, external_url, version, active, notes")
    .order("kind", { ascending: true })
    .order("name", { ascending: true });
  if (error) throw new Error(error.message);
  if (!assets || assets.length === 0) return [];

  const ids = assets.map((a) => a.id);
  const { data: usage } = await supa
    .from("activities")
    .select("asset_id, occurred_at")
    .in("asset_id", ids)
    .order("occurred_at", { ascending: false });

  const stats = new Map<string, { count: number; last: string | null }>();
  for (const row of usage ?? []) {
    if (!row.asset_id) continue;
    const s = stats.get(row.asset_id) ?? { count: 0, last: null };
    s.count += 1;
    if (!s.last) s.last = row.occurred_at;
    stats.set(row.asset_id, s);
  }

  return assets.map((a) => ({
    ...a,
    usage_count: stats.get(a.id)?.count ?? 0,
    last_used_at: stats.get(a.id)?.last ?? null,
  }));
}

export async function getActiveAssetsForPicker(): Promise<
  { id: string; name: string; kind: AssetKind; version: string | null }[]
> {
  const supa = createServiceRoleClient();
  const { data, error } = await supa
    .from("assets")
    .select("id, name, kind, version")
    .eq("active", true)
    .order("kind")
    .order("name");
  if (error) throw new Error(error.message);
  return data ?? [];
}

export async function getAssetsSharedWithCompany(
  companyId: string,
): Promise<
  {
    activity_id: string;
    occurred_at: string;
    asset: { id: string; name: string; kind: AssetKind } | null;
  }[]
> {
  const supa = createServiceRoleClient();
  const { data, error } = await supa
    .from("activities")
    .select("id, occurred_at, asset:assets(id, name, kind)")
    .eq("company_id", companyId)
    .not("asset_id", "is", null)
    .order("occurred_at", { ascending: false })
    .limit(20);
  if (error) throw new Error(error.message);
  return (data ?? []).map((r) => ({
    activity_id: r.id,
    occurred_at: r.occurred_at,
    asset: Array.isArray(r.asset) ? (r.asset[0] ?? null) : r.asset,
  }));
}
