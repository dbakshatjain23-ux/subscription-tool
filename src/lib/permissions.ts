import type { NextRequest } from "next/server";
import { getCacheKey, withCache } from "@/lib/cache";
import { getSupabaseAdminClient } from "@/lib/supabase";

export async function getUserRole(userId: string): Promise<"admin" | "user" | null> {
  return withCache(getCacheKey("user", userId, "role"), async () => {
  const supabase = getSupabaseAdminClient();
  if (!supabase) return null;

  const { data, error } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", userId)
    .single();

  if (error || !data) return null;

  return data.role as "admin" | "user";
  }, 60);
}

export async function isAdmin(userId: string): Promise<boolean> {
  const role = await getUserRole(userId);
  return role === "admin";
}

export async function verifyAdminPermission(userId: string): Promise<{ ok: boolean; error?: string }> {
  const admin = await isAdmin(userId);
  if (!admin) {
    return { ok: false, error: "Unauthorized: Admin access required." };
  }
  return { ok: true };
}

export async function verifySubscriptionOwnership(userId: string, subscriptionId: string): Promise<boolean> {
  const supabase = getSupabaseAdminClient();
  if (!supabase) return false;

  const { data } = await supabase
    .from("subscriptions")
    .select("user_id")
    .eq("id", subscriptionId)
    .single();

  return data?.user_id === userId;
}

export async function canAccessSubscription(
  userId: string,
  subscriptionId: string
): Promise<boolean> {
  const isOwner = await verifySubscriptionOwnership(userId, subscriptionId);
  const admin = await isAdmin(userId);

  return isOwner || admin;
}

export function extractUserIdFromRequest(request: NextRequest): string | null {
  // Decode the session cookie and extract user ID
  const sessionCookie = request.cookies.get("smt_session")?.value;
  if (!sessionCookie) return null;

  try {
    const [encodedPayload] = sessionCookie.split(".");
    const payload = Buffer.from(encodedPayload, "base64url").toString("utf8");
    const session = JSON.parse(payload) as { userId: string };
    return session.userId || null;
  } catch {
    return null;
  }
}
