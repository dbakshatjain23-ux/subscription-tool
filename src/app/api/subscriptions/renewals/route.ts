import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { verifyRequestSession } from "@/lib/auth";
import { invalidateCache } from "@/lib/cache";
import { getSupabaseAdminClient } from "@/lib/supabase";
import { extractUserIdFromRequest, verifyAdminPermission } from "@/lib/permissions";
import { getNextRenewalAfter } from "@/lib/subscription-helpers";
import { validateRenewalDate } from "@/lib/data";
import { canChangeCurrentRenewalCycle, readRenewalGracePeriod } from "@/lib/settings";
import type { BillingCycle, PaymentStatus } from "@/lib/types";

type RenewalAction = "mark_paid" | "mark_unpaid" | "skip" | "cancel" | "move_next" | "move_date";

type DbSubscription = {
  id: string;
  cost: number | string;
  billingcycle: BillingCycle;
  renewaldate: string;
  status: "active" | "cancelled";
  payment_status: PaymentStatus;
};

const actionEventStatus: Partial<Record<RenewalAction, PaymentStatus | "cancelled">> = {
  mark_paid: "paid",
  mark_unpaid: "unpaid",
  skip: "skipped",
  cancel: "cancelled",
  move_next: "skipped",
};

function getActionNote(action: RenewalAction, notes: string) {
  if (notes) {
    return notes;
  }

  if (action === "mark_paid") return "Marked paid by admin.";
  if (action === "mark_unpaid") return "Marked unpaid by admin.";
  if (action === "skip") return "Skipped by admin.";
  if (action === "cancel") return "Cancelled by admin.";
  if (action === "move_next") return "Moved to next renewal by admin.";
  return "Renewal date moved by admin.";
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

  const body = (await request.json().catch(() => null)) as {
    subscriptionId?: string;
    action?: RenewalAction;
    renewalDate?: string;
    notes?: string;
  } | null;

  if (!body?.subscriptionId || !body.action) {
    return NextResponse.json({ error: "Subscription ID and action are required." }, { status: 400 });
  }

  if (!["mark_paid", "mark_unpaid", "skip", "cancel", "move_next", "move_date"].includes(body.action)) {
    return NextResponse.json({ error: "Unsupported renewal action." }, { status: 400 });
  }

  const supabase = getSupabaseAdminClient();
  if (!supabase) {
    return NextResponse.json({ error: "Database not configured." }, { status: 503 });
  }

  const { data: subscription, error: subscriptionError } = await supabase
    .from("subscriptions")
    .select("id, cost, billingcycle, renewaldate, status, payment_status")
    .eq("id", body.subscriptionId)
    .single<DbSubscription>();

  if (subscriptionError || !subscription) {
    return NextResponse.json({ error: "Subscription not found." }, { status: 404 });
  }

  if (subscription.status === "cancelled" && body.action !== "move_date") {
    return NextResponse.json({ error: "Cancelled subscriptions cannot be renewed." }, { status: 400 });
  }

  const cycleActions: RenewalAction[] = ["mark_paid", "mark_unpaid", "skip", "move_next"];
  if (cycleActions.includes(body.action)) {
    const gracePeriod = await readRenewalGracePeriod();
    if (!canChangeCurrentRenewalCycle(subscription.renewaldate, gracePeriod)) {
      return NextResponse.json(
        { error: "Payment status changes are only available during the current renewal grace period." },
        { status: 400 }
      );
    }
  }

  const notes = getActionNote(body.action, String(body.notes ?? "").trim());
  const eventStatus = actionEventStatus[body.action];

  if (eventStatus) {
    const { error: eventError } = await supabase
      .from("subscription_renewal_events")
      .upsert(
        {
          subscription_id: subscription.id,
          billingcycle: subscription.billingcycle,
          amount: Number(subscription.cost),
          due_date: subscription.renewaldate,
          status: eventStatus,
          processed_at: new Date().toISOString(),
          processed_by: userId,
          notes,
        },
        { onConflict: "subscription_id,due_date" }
      );

    if (eventError) {
      console.error("Error recording renewal action:", eventError);
      return NextResponse.json({ error: "Unable to record renewal action." }, { status: 500 });
    }
  }

  const updates: Record<string, unknown> = {};

  if (body.action === "mark_paid") {
    updates.payment_status = "paid";
    updates.last_paid_at = new Date().toISOString();
    updates.last_renewed_at = new Date().toISOString();
    updates.renewaldate = getNextRenewalAfter(subscription.renewaldate, subscription.billingcycle);
  }

  if (body.action === "mark_unpaid") {
    updates.payment_status = "unpaid";
    updates.last_renewed_at = new Date().toISOString();
    updates.renewaldate = getNextRenewalAfter(subscription.renewaldate, subscription.billingcycle);
  }

  if (body.action === "skip" || body.action === "move_next") {
    updates.payment_status = "skipped";
    updates.last_renewed_at = new Date().toISOString();
    updates.renewaldate = getNextRenewalAfter(subscription.renewaldate, subscription.billingcycle);
  }

  if (body.action === "cancel") {
    updates.status = "cancelled";
    updates.payment_status = "skipped";
  }

  if (body.action === "move_date") {
    const renewalDateCheck = validateRenewalDate(String(body.renewalDate ?? ""));
    if (!renewalDateCheck.ok) {
      return NextResponse.json({ error: renewalDateCheck.error }, { status: 400 });
    }
    updates.renewaldate = renewalDateCheck.value;
  }

  const { error: updateError } = await supabase
    .from("subscriptions")
    .update(updates)
    .eq("id", subscription.id);

  if (updateError) {
    console.error("Error updating subscription renewal state:", updateError);
    return NextResponse.json({ error: "Unable to update subscription renewal state." }, { status: 500 });
  }

  invalidateCache(/^subscriptions:/);

  return NextResponse.json({ ok: true });
}
