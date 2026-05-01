import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { verifyRequestSession } from "@/lib/auth";
import { getSupabaseAdminClient } from "@/lib/supabase";
import { extractUserIdFromRequest, verifyAdminPermission } from "@/lib/permissions";
import { invalidateCache, getCacheKey } from "@/lib/cache";
import { writeAuditLog } from "@/lib/audit";

// Create a new user (admin only)
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

  const body = (await request.json().catch(() => null)) as {
    email?: string;
    password?: string;
    full_name?: string;
    username?: string;
    role?: string;
  } | null;

  const fullName = String(body?.full_name ?? body?.username ?? "").trim();

  if (!body?.email || !body?.password || !fullName) {
    return NextResponse.json({ error: "Username, email, and password are required." }, { status: 400 });
  }

  const supabase = getSupabaseAdminClient();
  if (!supabase) {
    return NextResponse.json({ error: "Auth service not configured." }, { status: 503 });
  }

  // Create user in Supabase Auth using admin API
  const { data, error } = await supabase.auth.admin.createUser({
    email: body.email,
    password: body.password,
    email_confirm: true,
    user_metadata: {
      full_name: fullName,
    },
  });

  if (error || !data.user) {
    return NextResponse.json(
      { error: error?.message || "Failed to create user." },
      { status: 400 }
    );
  }

  // Invalidate users cache
  invalidateCache(/^users:/);

  if (body.role && ["admin", "user"].includes(body.role)) {
    await supabase
      .from("profiles")
      .update({ role: body.role })
      .eq("id", data.user.id);
  }

  await writeAuditLog({
    userId,
    action: "USER_CREATED",
    resourceType: "user",
    resourceId: data.user.id,
    newValues: {
      email: data.user.email,
      full_name: fullName,
      role: body.role ?? "user",
    },
  });

  return NextResponse.json(
    {
      user: {
        id: data.user.id,
        email: data.user.email,
        full_name: fullName,
        role: body.role ?? "user",
      },
    },
    { status: 201 }
  );
}

// Get all users (admin only)
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

  const { data, error } = await supabase.from("profiles").select("*").order("created_at", { ascending: false });

  if (error) {
    console.error("Error fetching users:", error);
    return NextResponse.json({ error: "Failed to fetch users." }, { status: 500 });
  }

  return NextResponse.json({ users: data || [] });
}

// Update user role (admin only)
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
    user_id?: string;
    role?: string;
    is_active?: boolean;
    full_name?: string;
    email?: string;
  } | null;

  if (!body?.user_id) {
    return NextResponse.json({ error: "User ID is required." }, { status: 400 });
  }

  const supabase = getSupabaseAdminClient();
  if (!supabase) {
    return NextResponse.json({ error: "Database not configured." }, { status: 503 });
  }

  const { data: previousUser } = await supabase
    .from("profiles")
    .select("*")
    .eq("id", body.user_id)
    .single();

  const updates: Record<string, unknown> = {};
  if (body.role && ["admin", "user"].includes(body.role)) {
    updates.role = body.role;
  }
  if (body.is_active !== undefined) {
    updates.is_active = body.is_active;
  }
  if (body.full_name !== undefined) {
    updates.full_name = String(body.full_name).trim();
  }
  if (body.email !== undefined) {
    updates.email = String(body.email).trim();
  }

  if (Object.keys(updates).length === 0) {
    return NextResponse.json({ error: "No updates provided." }, { status: 400 });
  }

  const { data, error } = await supabase
    .from("profiles")
    .update(updates)
    .eq("id", body.user_id)
    .select()
    .single();

  if (error) {
    console.error("Error updating user:", error);
    return NextResponse.json({ error: "Failed to update user." }, { status: 500 });
  }

  invalidateCache(/^users:/);
  invalidateCache(getCacheKey("user", body.user_id, "role"));

  if (body.full_name !== undefined) {
    await supabase.auth.admin.updateUserById(body.user_id, {
      user_metadata: { full_name: String(body.full_name).trim() },
    });
  }

  if (body.email !== undefined) {
    const email = String(body.email).trim();
    if (!email) {
      return NextResponse.json({ error: "Email cannot be empty." }, { status: 400 });
    }
    await supabase.auth.admin.updateUserById(body.user_id, {
      email,
      email_confirm: true,
    });
  }

  await writeAuditLog({
    userId,
    action: "USER_UPDATED",
    resourceType: "user",
    resourceId: body.user_id,
    oldValues: previousUser ?? null,
    newValues: data,
  });

  return NextResponse.json({ user: data });
}

// Delete user (admin only)
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

  const body = (await request.json().catch(() => null)) as { user_id?: string } | null;
  if (!body?.user_id) {
    return NextResponse.json({ error: "User ID is required." }, { status: 400 });
  }

  if (body.user_id === userId) {
    return NextResponse.json({ error: "You cannot delete your own account." }, { status: 400 });
  }

  const supabase = getSupabaseAdminClient();
  if (!supabase) {
    return NextResponse.json({ error: "Auth service not configured." }, { status: 503 });
  }

  const { data: previousUser } = await supabase
    .from("profiles")
    .select("*")
    .eq("id", body.user_id)
    .single();

  const { error } = await supabase.auth.admin.deleteUser(body.user_id);
  if (error) {
    console.error("Error deleting user:", error);
    return NextResponse.json({ error: "Failed to delete user." }, { status: 500 });
  }

  invalidateCache(/^users:/);
  invalidateCache(getCacheKey("user", body.user_id, "role"));

  await writeAuditLog({
    userId,
    action: "USER_DELETED",
    resourceType: "user",
    resourceId: body.user_id,
    oldValues: previousUser ?? null,
  });

  return NextResponse.json({ ok: true });
}
