export type ProjectStatus =
  | "PLANNING"
  | "ACTIVE"
  | "ON_HOLD"
  | "COMPLETED"
  | "CANCELLED";

export type Pace = "on_track" | "behind" | "ahead" | "unknown";

export type ProjectTask = {
  id: string;
  title: string;
  status: "TODO" | "IN_PROGRESS" | "BLOCKED" | "DONE";
  priority: "LOW" | "MEDIUM" | "HIGH" | "URGENT";
  due_date: string | null;
  updated_at: string;
  assignee: { id: string; full_name: string } | null;
};
