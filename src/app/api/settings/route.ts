import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { verifyRequestSession } from "@/lib/auth";
import { getSupabaseAdminClient } from "@/lib/supabase";
import { extractUserIdFromRequest, verifyAdminPermission } from "@/lib/permissions";
import { RENEWAL_GRACE_PERIOD_KEY, parseRenewalGracePeriod, readRenewalGracePeriod } from "@/lib/settings";

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

  return NextResponse.json({ renewalGracePeriod: await readRenewalGracePeriod() });
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

  const body = (await request.json().catch(() => null)) as { renewalGracePeriod?: string | number } | null;
  const parsed = parseRenewalGracePeriod(String(body?.renewalGracePeriod ?? ""));

  const supabase = getSupabaseAdminClient();
  if (!supabase) {
    return NextResponse.json({ error: "Database not configured." }, { status: 503 });
  }

  const { error } = await supabase
    .from("app_settings")
    .upsert({
      key: RENEWAL_GRACE_PERIOD_KEY,
      value: parsed.value,
      updated_by: userId,
    });

  if (error) {
    console.error("Error updating settings:", error);
    return NextResponse.json({ error: "Unable to update settings." }, { status: 500 });
  }

  return NextResponse.json({ renewalGracePeriod: parsed });
}
