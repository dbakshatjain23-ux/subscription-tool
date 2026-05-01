import { NextResponse } from "next/server";
import { createSessionCookieValue, getSessionCookieName } from "@/lib/auth";
import { getSupabaseAdminClient, getSupabaseAuthClient } from "@/lib/supabase";
import { writeAuditLog } from "@/lib/audit";

export async function POST(request: Request) {
  const body = (await request.json().catch(() => null)) as { email?: string; password?: string } | null;
  const email = String(body?.email ?? "").trim();
  const password = String(body?.password ?? "");
  const supabase = getSupabaseAuthClient();

  if (!supabase) {
    const missing = ["SUPABASE_URL", "SUPABASE_ANON_KEY"].filter(
      (key) => !process.env[key as "SUPABASE_URL" | "SUPABASE_ANON_KEY"]?.trim()
    );

    return NextResponse.json(
      {
        error: "Supabase auth is not configured.",
        missing,
      },
      { status: 503 }
    );
  }

  const { data, error } = await supabase.auth.signInWithPassword({ email, password });

  if (error || !data.user) {
    return NextResponse.json({ error: "Invalid credentials." }, { status: 401 });
  }

  const adminSupabase = getSupabaseAdminClient();
  const { data: profile } = adminSupabase
    ? await adminSupabase.from("profiles").select("is_active").eq("id", data.user.id).single()
    : { data: null };

  if (profile?.is_active === false) {
    return NextResponse.json({ error: "This account is inactive." }, { status: 403 });
  }

  await writeAuditLog({
    userId: data.user.id,
    action: "LOGIN",
    resourceType: "auth",
    resourceId: data.user.id,
    newValues: { email: data.user.email ?? email },
  });

  const response = NextResponse.json({ ok: true });
  response.cookies.set({
    name: getSessionCookieName(),
    value: createSessionCookieValue({ userId: data.user.id, email: data.user.email ?? email }),
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 60 * 60 * 24 * 7,
  });

  return response;
}
