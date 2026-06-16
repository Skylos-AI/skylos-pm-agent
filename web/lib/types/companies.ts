export type CompanyStatus =
  | "LEAD"
  | "PROSPECT"
  | "ACTIVE_CLIENT"
  | "PAST_CLIENT"
  | "DISQUALIFIED";

export type CompanyListContact = {
  phone: string | null;
  whatsapp: string | null;
  email: string | null;
};

export type CompanyListRow = {
  id: string;
  name: string;
  nit: string | null;
  sector: string | null;
  city: string | null;
  department: string | null;
  status: CompanyStatus;
  assigned_to: { id: string; full_name: string } | null;
  primary_contact: CompanyListContact | null;
};

export type CompanyPhase = "outreach" | "clientes" | "todos";

export const PHASE_STATUSES: Record<CompanyPhase, CompanyStatus[]> = {
  outreach: ["LEAD", "PROSPECT"],
  clientes: ["ACTIVE_CLIENT"],
  todos: [],
};
