export type CompanyStatus =
  | "LEAD"
  | "PROSPECT"
  | "ACTIVE_CLIENT"
  | "PAST_CLIENT"
  | "DISQUALIFIED";

export type CompanyListRow = {
  id: string;
  name: string;
  nit: string | null;
  sector: string | null;
  city: string | null;
  department: string | null;
  status: CompanyStatus;
  assigned_to: { id: string; full_name: string } | null;
};
