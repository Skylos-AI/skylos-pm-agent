export type TaskStatus = "TODO" | "IN_PROGRESS" | "BLOCKED" | "DONE";
export type TaskPriority = "LOW" | "MEDIUM" | "HIGH" | "URGENT";

export type TaskNoteRow = {
  id: string;
  body: string;
  created_at: string;
  author_agent: boolean;
  author: { id: string; full_name: string } | null;
};

export type TaskReminderRow = {
  id: string;
  message: string;
  trigger_at: string;
  status: "PENDING" | "SENT" | "CANCELLED" | "FAILED";
  created_by_agent: boolean;
};

export type MyTaskRow = {
  id: string;
  title: string;
  description: string | null;
  status: TaskStatus;
  priority: TaskPriority;
  due_date: string | null;
  estimated_hours: number | null;
  resources: string | null;
  project: { id: string; name: string } | null;
  assignee: { id: string; full_name: string } | null;
  notes: TaskNoteRow[];
  reminders: TaskReminderRow[];
};
