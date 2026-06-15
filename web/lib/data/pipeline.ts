import "server-only";
import { createServiceRoleClient } from "@/lib/supabase/service-role";
import { STAGES, type Stage, type PipelineDealRow, type PipelineOwner } from "@/lib/types/pipeline";

export { STAGES };
export type { Stage, PipelineDealRow, PipelineOwner };

export type PipelineFilters = {
  ownerId?: string;
  stages?: Stage[];
  minValue?: number;
  maxValue?: number;
};

export type PipelineBoard = {
  deals: PipelineDealRow[];
  owners: PipelineOwner[];
};

export async function getPipelineBoard(
  filters?: PipelineFilters,
): Promise<PipelineBoard> {
  const supa = createServiceRoleClient();

  let q = supa
    .from("pipeline_deals")
    .select(
      "id, title, stage, value_bob, probability, expected_close_date, actual_close_date, lost_reason, owner_id, company_id, created_at, updated_at, company:companies(id, name), owner:users!pipeline_deals_owner_id_fkey(id, full_name)",
    )
    .order("updated_at", { ascending: false });

  if (filters?.ownerId) q = q.eq("owner_id", filters.ownerId);
  if (filters?.stages && filters.stages.length > 0)
    q = q.in("stage", filters.stages);
  if (typeof filters?.minValue === "number")
    q = q.gte("value_bob", filters.minValue);
  if (typeof filters?.maxValue === "number")
    q = q.lte("value_bob", filters.maxValue);

  const { data: dealsData } = await q;
  const { data: ownersData } = await supa
    .from("users")
    .select("id, full_name")
    .eq("is_active", true)
    .order("full_name", { ascending: true });

  return {
    deals: (dealsData ?? []) as unknown as PipelineDealRow[],
    owners: (ownersData ?? []) as PipelineOwner[],
  };
}

export function groupByStage(
  deals: PipelineDealRow[],
): Record<Stage, PipelineDealRow[]> {
  const out = Object.fromEntries(STAGES.map((s) => [s, []])) as Record<
    Stage,
    PipelineDealRow[]
  >;
  for (const d of deals) out[d.stage].push(d);
  return out;
}

export function totalValue(deals: PipelineDealRow[]): number {
  return deals.reduce((acc, d) => acc + Number(d.value_bob ?? 0), 0);
}
