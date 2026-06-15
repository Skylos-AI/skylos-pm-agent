export type TaskStatus = "TODO" | "IN_PROGRESS" | "BLOCKED" | "DONE";
export type TaskPriority = "LOW" | "MEDIUM" | "HIGH" | "URGENT";

export type MyTaskRow = {
  id: string;
  title: string;
  status: TaskStatus;
  priority: TaskPriority;
  due_date: string | null;
  project: { id: string; name: string } | null;
};
