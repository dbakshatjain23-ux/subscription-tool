import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { verifyRequestSession } from "@/lib/auth";
import { getSupabaseAdminClient } from "@/lib/supabase";
import { extractUserIdFromRequest, verifyAdminPermission } from "@/lib/permissions";

type AuditRow = {
  id: string;
  user_id: string;
  action: string;
  resource_type: string;
  resource_id: string | null;
  created_at: string;
  new_values: Record<string, unknown> | null;
};

function actionLabel(action: string) {
  return action
    .toLowerCase()
    .split("_")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

export async function GET(request: NextRequest) {
  if (!(await verifyRequestSession(request))) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }

  const userId = extractUserIdFromRequest(request);
  if (!userId) {
    return NextResponse.json({ error: "Invalid session." }, { status: 401 });
  }

  const adminCheck = await verifyAdminPermission(userId);
  if (!adminCheck.ok) {
    return NextResponse.json({ error: adminCheck.error }, { status: 403 });
  }

  const supabase = getSupabaseAdminClient();
  if (!supabase) {
    return NextResponse.json({ error: "Database not configured." }, { status: 503 });
  }

  const { data, error } = await supabase
    .from("audit_logs")
    .select("id, user_id, action, resource_type, resource_id, created_at, new_values")
    .order("created_at", { ascending: false })
    .limit(20);

  if (error) {
    return NextResponse.json({ error: "Unable to load notifications." }, { status: 500 });
  }

  const rows = (data ?? []) as AuditRow[];
  const actorIds = Array.from(new Set(rows.map((row) => row.user_id)));
  const { data: profiles } = actorIds.length
    ? await supabase.from("profiles").select("id, full_name, email").in("id", actorIds)
    : { data: [] };
  const actors = new Map((profiles ?? []).map((profile) => [profile.id, profile]));

  const notifications = rows.map((row) => {
    const actor = actors.get(row.user_id);
    const actorName = actor?.full_name?.trim() || actor?.email || "Unknown user";
    const target =
      typeof row.new_values?.name === "string"
        ? row.new_values.name
        : typeof row.new_values?.email === "string"
          ? row.new_values.email
          : row.resource_type;

    return {
      id: row.id,
      title: actionLabel(row.action),
      message: `${actorName} performed ${actionLabel(row.action).toLowerCase()} on ${target}.`,
      action: row.action,
      resourceType: row.resource_type,
      createdAt: row.created_at,
      actorName,
    };
  });

  return NextResponse.json({ notifications });
}
