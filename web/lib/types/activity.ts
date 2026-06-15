export type ActivityType =
  | "CALL"
  | "MEETING"
  | "MESSAGE_SENT"
  | "MESSAGE_RECEIVED"
  | "EMAIL"
  | "NOTE"
  | "MILESTONE"
  | "PROPOSAL_SENT"
  | "CONTRACT_SIGNED";

export type ActivityChannel =
  | "WHATSAPP"
  | "PHONE"
  | "IN_PERSON"
  | "EMAIL"
  | "VIDEO_CALL"
  | "OTHER";

export type ActivityFeedRow = {
  id: string;
  type: ActivityType;
  channel: ActivityChannel;
  description: string;
  occurred_at: string;
  company: { id: string; name: string } | null;
  project: { id: string; name: string } | null;
  logged_by: { id: string; full_name: string } | null;
};

export type AgentSource = "WHATSAPP" | "CRON" | "WEB" | "MANUAL_TEST";
export type AgentActionStatus = "SUCCESS" | "ERROR" | "PARTIAL";

export type AgentLogRow = {
  id: string;
  source: AgentSource;
  tool_called: string;
  action_type: string;
  request_summary: string;
  response_summary: string;
  entities_affected: unknown;
  status: AgentActionStatus;
  error_message: string | null;
  duration_ms: number | null;
  created_at: string;
  requested_by: { id: string; full_name: string } | null;
};
