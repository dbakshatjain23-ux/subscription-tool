import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { writeAuditLog } from "@/lib/audit";
import { getCacheKey, invalidateCache, withCache } from "@/lib/cache";
import { verifyRequestSession } from "@/lib/auth";
import { extractUserIdFromRequest, verifyAdminPermission } from "@/lib/permissions";
import { getSupabaseAdminClient } from "@/lib/supabase";

function normalizeTeamName(value: unknown) {
  return String(value ?? "").trim();
}

function teamErrorMessage(error: { code?: string; message?: string }) {
  if (error.code === "23505") {
    return "A team with this name already exists.";
  }

  return error.message || "Unable to save team.";
}

export async function GET(request: NextRequest) {
  if (!(await verifyRequestSession(request))) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }

  const userId = extractUserIdFromRequest(request);
  if (!userId) {
    return NextResponse.json({ error: "Invalid session." }, { status: 401 });
  }

  const supabase = getSupabaseAdminClient();
  if (!supabase) {
    return NextResponse.json({ error: "Database not configured." }, { status: 503 });
  }

  const isAdmin = (await verifyAdminPermission(userId)).ok;
  const cacheKey = getCacheKey("teams", isAdmin ? "all" : "active");

  try {
    const teams = await withCache(cacheKey, async () => {
      let query = supabase.from("teams").select("*").order("name", { ascending: true });

      if (!isAdmin) {
        query = query.eq("is_active", true);
      }

      const { data, error } = await query;

      if (error) {
        throw new Error("Unable to load teams. Make sure the teams migration has been applied.");
      }

      return data ?? [];
    }, 120);

    return NextResponse.json({ teams, isAdmin });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unable to load teams.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
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

  const body = (await request.json().catch(() => null)) as { name?: string; description?: string } | null;
  const name = normalizeTeamName(body?.name);
  const description = String(body?.description ?? "").trim();

  if (!name) {
    return NextResponse.json({ error: "Team name is required." }, { status: 400 });
  }

  const supabase = getSupabaseAdminClient();
  if (!supabase) {
    return NextResponse.json({ error: "Database not configured." }, { status: 503 });
  }

  const { data, error } = await supabase
    .from("teams")
    .insert({ name, description, created_by: userId })
    .select()
    .single();

  if (error) {
    return NextResponse.json({ error: teamErrorMessage(error) }, { status: 400 });
  }

  invalidateCache(/^teams:/);
  await writeAuditLog({
    userId,
    action: "TEAM_CREATED",
    resourceType: "team",
    resourceId: data.id,
    newValues: data,
  });

  return NextResponse.json({ team: data }, { status: 201 });
}

export async function PATCH(request: NextRequest) {
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

  const body = (await request.json().catch(() => null)) as {
    id?: string;
    name?: string;
    description?: string;
    is_active?: boolean;
  } | null;

  if (!body?.id) {
    return NextResponse.json({ error: "Team ID is required." }, { status: 400 });
  }

  const updates: Record<string, unknown> = {};
  if (body.name !== undefined) {
    const name = normalizeTeamName(body.name);
    if (!name) {
      return NextResponse.json({ error: "Team name cannot be empty." }, { status: 400 });
    }
    updates.name = name;
  }
  if (body.description !== undefined) {
    updates.description = String(body.description).trim();
  }
  if (body.is_active !== undefined) {
    updates.is_active = body.is_active;
  }

  if (Object.keys(updates).length === 0) {
    return NextResponse.json({ error: "No updates provided." }, { status: 400 });
  }

  const supabase = getSupabaseAdminClient();
  if (!supabase) {
    return NextResponse.json({ error: "Database not configured." }, { status: 503 });
  }

  const { data: previousTeam } = await supabase.from("teams").select("*").eq("id", body.id).single();
  const { data, error } = await supabase.from("teams").update(updates).eq("id", body.id).select().single();

  if (error) {
    return NextResponse.json({ error: teamErrorMessage(error) }, { status: 400 });
  }

  invalidateCache(/^teams:/);
  await writeAuditLog({
    userId,
    action: "TEAM_UPDATED",
    resourceType: "team",
    resourceId: body.id,
    oldValues: previousTeam ?? null,
    newValues: data,
  });

  return NextResponse.json({ team: data });
}

export async function DELETE(request: NextRequest) {
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

  const body = (await request.json().catch(() => null)) as { id?: string } | null;
  if (!body?.id) {
    return NextResponse.json({ error: "Team ID is required." }, { status: 400 });
  }

  const supabase = getSupabaseAdminClient();
  if (!supabase) {
    return NextResponse.json({ error: "Database not configured." }, { status: 503 });
  }

  const { data: previousTeam } = await supabase.from("teams").select("*").eq("id", body.id).single();
  const { error } = await supabase.from("teams").delete().eq("id", body.id);

  if (error) {
    return NextResponse.json({ error: "Unable to delete team." }, { status: 400 });
  }

  invalidateCache(/^teams:/);
  await writeAuditLog({
    userId,
    action: "TEAM_DELETED",
    resourceType: "team",
    resourceId: body.id,
    oldValues: previousTeam ?? null,
  });

  return NextResponse.json({ ok: true });
}
