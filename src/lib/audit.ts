import { getSupabaseAdminClient } from "@/lib/supabase";

type AuditAction =
  | "CREATE"
  | "UPDATE"
  | "DELETE"
  | "LOGIN"
  | "LOGOUT"
  | "USER_CREATED"
  | "USER_UPDATED"
  | "USER_DELETED"
  | "TEAM_CREATED"
  | "TEAM_UPDATED"
  | "TEAM_DELETED";

export async function writeAuditLog({
  userId,
  action,
  resourceType,
  resourceId,
  oldValues,
  newValues,
  status = "success",
  errorMessage,
}: {
  userId: string;
  action: AuditAction;
  resourceType: string;
  resourceId?: string | null;
  oldValues?: unknown;
  newValues?: unknown;
  status?: "success" | "error";
  errorMessage?: string;
}) {
  const supabase = getSupabaseAdminClient();
  if (!supabase) {
    return;
  }

  await supabase.from("audit_logs").insert({
    user_id: userId,
    action,
    resource_type: resourceType,
    resource_id: resourceId ?? null,
    old_values: oldValues ?? null,
    new_values: newValues ?? null,
    status,
    error_message: errorMessage ?? null,
  });
}
