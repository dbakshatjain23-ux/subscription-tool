import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { verifyRequestSession } from "@/lib/auth";
import { getSupabaseAdminClient } from "@/lib/supabase";
import { extractUserIdFromRequest, verifyAdminPermission } from "@/lib/permissions";
import { getSuperAdminId } from "@/lib/super-admin";

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

  const adminCheck = await verifyAdminPermission(userId);
  const isAdmin = adminCheck.ok;

  const { data: currentUser, error: currentError } = await supabase
    .from("profiles")
    .select("id, full_name, email, role, is_active")
    .eq("id", userId)
    .single();

  if (currentError || !currentUser) {
    return NextResponse.json({ error: "Unable to load current user." }, { status: 500 });
  }

  if (!isAdmin) {
    return NextResponse.json({
      isAdmin: false,
      users: [currentUser],
      currentUser,
    });
  }

  const { data, error } = await supabase
    .from("profiles")
    .select("id, full_name, email, role, is_active")
    .order("created_at", { ascending: false });

  if (error) {
    return NextResponse.json({ error: "Unable to load users." }, { status: 500 });
  }

  const superAdminId = await getSuperAdminId();
  const users = (data ?? []).filter((user) => user.id !== superAdminId);

  return NextResponse.json({
    isAdmin: true,
    users,
    currentUser,
  });
}
