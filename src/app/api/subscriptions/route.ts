import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { verifyRequestSession } from "@/lib/auth";
import { getSupabaseAdminClient } from "@/lib/supabase";
import { extractUserIdFromRequest, canAccessSubscription, verifyAdminPermission } from "@/lib/permissions";
import type { BillingCycle, PaymentStatus } from "@/lib/types";
import { isPaymentStatus } from "@/lib/payment-statuses";
import { sortSubscriptionsByRenewalDate } from "@/lib/subscription-helpers";
import { mapDbSubscription, toDbSubscriptionInput, validateRenewalDate, validateSubscriptionInput } from "@/lib/data";
import { withCache, invalidateCache, getCacheKey } from "@/lib/cache";

function getSubscriptionDbErrorMessage(
  action: "create" | "update" | "delete",
  error: { code?: string; message?: string; details?: string | null }
) {
  const rawMessage = `${error.message ?? ""} ${error.details ?? ""}`.toLowerCase();

  if (error.code === "23514" && rawMessage.includes("valid_renewal_date")) {
    return "Renewal date cannot be in the past. Choose today or a future date.";
  }

  if (error.code === "23514" && rawMessage.includes("cost")) {
    return "Cost cannot be negative. Enter zero or a positive amount.";
  }

  if (error.code === "23514" && rawMessage.includes("billingcycle")) {
    return "Billing cycle must be monthly, quarterly, or yearly.";
  }

  if (error.code === "23514" && rawMessage.includes("status")) {
    return "Status must be active or cancelled.";
  }

  if (error.code === "23514" && rawMessage.includes("payment_status")) {
    return "Payment status must be paid, due, unpaid, or skipped.";
  }

  if (error.code === "23503") {
    return "Selected owner could not be found. Refresh the page and select an active user.";
  }

  return `Unable to ${action} subscription. Please review the fields and try again.`;
}

async function resolveSubscriptionOwner({
  requestedOwnerUserId,
  fallbackUserId,
  fallbackOwner,
  requesterIsAdmin,
}: {
  requestedOwnerUserId?: string;
  fallbackUserId: string;
  fallbackOwner: string;
  requesterIsAdmin: boolean;
}) {
  const supabase = getSupabaseAdminClient();
  if (!supabase) {
    return null;
  }

  if (requesterIsAdmin && !requestedOwnerUserId && fallbackOwner.trim() === "Organization") {
    return {
      userId: fallbackUserId,
      owner: "Organization",
    };
  }

  const targetUserId = requesterIsAdmin && requestedOwnerUserId ? requestedOwnerUserId : fallbackUserId;
  const { data, error } = await supabase
    .from("profiles")
    .select("id, full_name, email, is_active")
    .eq("id", targetUserId)
    .single();

  if (error || !data || data.is_active === false) {
    return null;
  }

  return {
    userId: data.id as string,
    owner: String(data.full_name || data.email || fallbackOwner).trim(),
  };
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

  const fetchSubscriptions = async () => {
    const adminCheck = await verifyAdminPermission(userId);
    let query = supabase.from("subscriptions").select("*");

    if (!adminCheck.ok) {
      query = query.eq("user_id", userId);
    }

    const { data, error } = await query.order("renewaldate", { ascending: true });

    if (error) {
      console.error("Error fetching subscriptions:", error);
      throw new Error("Failed to fetch subscriptions.");
    }

    return ((data as any[]) || []).map(mapDbSubscription);
  };

  try {
    const cacheKey = getCacheKey("subscriptions", userId);
    const subscriptions = await withCache(cacheKey, fetchSubscriptions);
    const sorted = sortSubscriptionsByRenewalDate(subscriptions);

    return NextResponse.json({ subscriptions: sorted });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to fetch subscriptions.";
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

  const supabase = getSupabaseAdminClient();
  if (!supabase) {
    return NextResponse.json({ error: "Database not configured." }, { status: 503 });
  }

  const body = (await request.json().catch(() => null)) as Record<string, unknown> | null;
  const notes = String(body?.notes ?? "").trim();
  const adminCheck = await verifyAdminPermission(userId);
  const ownerAssignment = await resolveSubscriptionOwner({
    requestedOwnerUserId: String(body?.ownerUserId ?? ""),
    fallbackUserId: userId,
    fallbackOwner: String(body?.owner ?? ""),
    requesterIsAdmin: adminCheck.ok,
  });

  if (!ownerAssignment) {
    return NextResponse.json({ error: "Selected owner is not available." }, { status: 400 });
  }

  const validation = validateSubscriptionInput({
    name: String(body?.name ?? ""),
    cost: Number(body?.cost),
    billingCycle: String(body?.billingCycle ?? "") as BillingCycle,
    renewalDate: String(body?.renewalDate ?? ""),
    team: String(body?.team ?? ""),
    owner: ownerAssignment.owner,
    status: String(body?.status ?? "") as "active" | "cancelled",
    paymentStatus: adminCheck.ok && isPaymentStatus(String(body?.paymentStatus ?? ""))
      ? String(body?.paymentStatus) as PaymentStatus
      : "paid",
    autoRenew: adminCheck.ok && body?.autoRenew !== undefined ? Boolean(body.autoRenew) : true,
    notes,
  });

  if (!validation.ok) {
    return NextResponse.json({ error: validation.error }, { status: 400 });
  }

  const { data, error } = await supabase
    .from("subscriptions")
    .insert([{ ...toDbSubscriptionInput(validation.value), user_id: ownerAssignment.userId }])
    .select()
    .single();

  if (error) {
    console.error("Error creating subscription:", error);
    return NextResponse.json({ error: getSubscriptionDbErrorMessage("create", error) }, { status: 400 });
  }

  invalidateCache(/^subscriptions:/);

  return NextResponse.json({ subscription: mapDbSubscription(data) }, { status: 201 });
}

export async function PUT(request: NextRequest) {
  if (!(await verifyRequestSession(request))) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }

  const userId = extractUserIdFromRequest(request);
  if (!userId) {
    return NextResponse.json({ error: "Invalid session." }, { status: 401 });
  }

  const body = (await request.json().catch(() => null)) as {
    id?: string;
    name?: string;
    cost?: number;
    billingCycle?: string;
    renewalDate?: string;
    team?: string;
    owner?: string;
    status?: string;
    paymentStatus?: string;
    autoRenew?: boolean;
    notes?: string;
    ownerUserId?: string;
  } | null;

  if (!body?.id) {
    return NextResponse.json({ error: "Subscription ID is required." }, { status: 400 });
  }

  const canAccess = await canAccessSubscription(userId, body.id);
  if (!canAccess) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 403 });
  }

  const supabase = getSupabaseAdminClient();
  if (!supabase) {
    return NextResponse.json({ error: "Database not configured." }, { status: 503 });
  }

  const adminCheck = await verifyAdminPermission(userId);

  const updates: Record<string, unknown> = {};
  if (body.name) updates.name = body.name;
  if (body.cost !== undefined) updates.cost = body.cost;
  if (body.billingCycle) updates.billingcycle = body.billingCycle;
  if (body.renewalDate) {
    const renewalDateCheck = validateRenewalDate(body.renewalDate);
    if (!renewalDateCheck.ok) {
      return NextResponse.json({ error: renewalDateCheck.error }, { status: 400 });
    }
    updates.renewaldate = renewalDateCheck.value;
  }
  if (body.team) updates.team = body.team;
  if (body.ownerUserId) {
    if (!adminCheck.ok) {
      return NextResponse.json({ error: "Only admins can transfer subscription ownership." }, { status: 403 });
    }

    const ownerAssignment = await resolveSubscriptionOwner({
      requestedOwnerUserId: body.ownerUserId,
      fallbackUserId: userId,
      fallbackOwner: body.owner ?? "",
      requesterIsAdmin: true,
    });

    if (!ownerAssignment) {
      return NextResponse.json({ error: "Selected owner is not available." }, { status: 400 });
    }

    updates.user_id = ownerAssignment.userId;
    updates.owner = ownerAssignment.owner;
  } else if (body.owner) {
    updates.owner = body.owner;
  }
  if (body.status) updates.status = body.status;
  if (body.paymentStatus !== undefined || body.autoRenew !== undefined) {
    if (!adminCheck.ok) {
      return NextResponse.json({ error: "Only admins can update renewal payment settings." }, { status: 403 });
    }
  }
  if (body.paymentStatus !== undefined) {
    const paymentStatus = String(body.paymentStatus).trim().toLowerCase();
    if (!isPaymentStatus(paymentStatus)) {
      return NextResponse.json({ error: "Payment status must be paid, due, unpaid, or skipped." }, { status: 400 });
    }
    updates.payment_status = paymentStatus;
  }
  if (body.autoRenew !== undefined) updates.auto_renew = Boolean(body.autoRenew);
  if (body.notes !== undefined) {
    updates.notes = String(body.notes ?? "").trim();
  }

  if (Object.keys(updates).length === 0) {
    return NextResponse.json({ error: "No updates provided." }, { status: 400 });
  }

  const { data, error } = await supabase
    .from("subscriptions")
    .update(updates)
    .eq("id", body.id)
    .select()
    .single();

  if (error) {
    console.error("Error updating subscription:", error);
    return NextResponse.json({ error: getSubscriptionDbErrorMessage("update", error) }, { status: 400 });
  }

  invalidateCache(/^subscriptions:/);

  return NextResponse.json({ subscription: mapDbSubscription(data) });
}

export async function DELETE(request: NextRequest) {
  if (!(await verifyRequestSession(request))) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }

  const userId = extractUserIdFromRequest(request);
  if (!userId) {
    return NextResponse.json({ error: "Invalid session." }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const id = searchParams.get("id");

  if (!id) {
    return NextResponse.json({ error: "Subscription ID is required." }, { status: 400 });
  }

  const canAccess = await canAccessSubscription(userId, id);
  if (!canAccess) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 403 });
  }

  const supabase = getSupabaseAdminClient();
  if (!supabase) {
    return NextResponse.json({ error: "Database not configured." }, { status: 503 });
  }

  const { error } = await supabase.from("subscriptions").delete().eq("id", id);

  if (error) {
    console.error("Error deleting subscription:", error);
    return NextResponse.json({ error: getSubscriptionDbErrorMessage("delete", error) }, { status: 400 });
  }

  invalidateCache(/^subscriptions:/);

  return NextResponse.json({ ok: true });
}
