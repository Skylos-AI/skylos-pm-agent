export const STAGES = [
  "LEAD",
  "QUALIFIED",
  "PROPOSAL",
  "NEGOTIATION",
  "WON",
  "LOST",
] as const;
export type Stage = (typeof STAGES)[number];

export type PipelineDealRow = {
  id: string;
  title: string;
  stage: Stage;
  value_bob: string | null;
  probability: number | null;
  expected_close_date: string | null;
  actual_close_date: string | null;
  lost_reason: string | null;
  owner_id: string;
  company_id: string;
  created_at: string;
  updated_at: string;
  company: { id: string; name: string } | null;
  owner: { id: string; full_name: string } | null;
};

export type PipelineOwner = { id: string; full_name: string };
