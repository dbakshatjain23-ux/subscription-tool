import crypto from "node:crypto";
import { getCacheKey, withCache } from "@/lib/cache";
import { getSupabaseAdminClient } from "@/lib/supabase";
import { getNextRenewalDate } from "@/lib/subscription-helpers";
import type { Subscription, SubscriptionInput } from "@/lib/types";

export async function readSubscriptions() {
  const supabase = getSupabaseAdminClient();

  if (!supabase) {
    console.warn("Supabase not initialized; returning empty subscriptions.");
    return [];
  }

  const { data, error } = await supabase.from("subscriptions").select("*").order("renewaldate", { ascending: true });

  if (error) {
    console.error("Error reading subscriptions:", error);
    return [];
  }

  return ((data as any[]) || []).map(mapDbSubscription);
}

export async function readSubscriptionsForUser(userId: string, includeAll = false) {
  return withCache(getCacheKey("subscriptions", includeAll ? "all" : userId), async () => {
  const supabase = getSupabaseAdminClient();

  if (!supabase) {
    console.warn("Supabase not initialized; returning empty subscriptions.");
    return [];
  }

  let query = supabase.from("subscriptions").select("*");

  if (!includeAll) {
    query = query.eq("user_id", userId);
  }

  const { data, error } = await query.order("renewaldate", { ascending: true });

  if (error) {
    console.error("Error reading subscriptions for user:", error);
    return [];
  }

  return ((data as any[]) || []).map(mapDbSubscription);
  }, 45);
}

export async function readSubscriptionById(subscriptionId: string, userId: string, includeAll = false) {
  const supabase = getSupabaseAdminClient();

  if (!supabase) {
    return null;
  }

  let query = supabase.from("subscriptions").select("*").eq("id", subscriptionId);

  if (!includeAll) {
    query = query.eq("user_id", userId);
  }

  const { data, error } = await query.single();

  if (error || !data) {
    return null;
  }

  return mapDbSubscription(data as any);
}

export type UsersSummary = {
  total: number;
  active: number;
  inactive: number;
  admins: number;
};

export async function readUsersSummary(): Promise<UsersSummary | null> {
  return withCache(getCacheKey("users", "summary"), async () => {
  const supabase = getSupabaseAdminClient();

  if (!supabase) {
    return null;
  }

  const { data, error } = await supabase.from("profiles").select("role, is_active");

  if (error || !data) {
    console.error("Error reading users summary:", error);
    return null;
  }

  const total = data.length;
  const active = data.filter((row) => row.is_active !== false).length;
  const inactive = data.filter((row) => row.is_active === false).length;
  const admins = data.filter((row) => row.role === "admin").length;

  return { total, active, inactive, admins };
  }, 60);
}

export function mapDbSubscription(row: any): Subscription {
  const subscription = {
    id: row.id,
    name: row.name,
    cost: Number(row.cost),
    billingCycle: (row.billingcycle ?? row.billingCycle) as Subscription["billingCycle"],
    renewalDate: row.renewaldate ?? row.renewalDate,
    team: row.team,
    owner: row.owner,
    ownerUserId: row.user_id,
    status: (row.status ?? "active") as Subscription["status"],
    notes: row.notes ?? "",
  };

  return {
    ...subscription,
    renewalDate: getNextRenewalDate(subscription),
  };
}

export function toDbSubscriptionInput(input: SubscriptionInput) {
  return {
    name: input.name,
    cost: input.cost,
    billingcycle: input.billingCycle,
    renewaldate: input.renewalDate,
    team: input.team,
    owner: input.owner,
    status: input.status,
    notes: input.notes,
  };
}

export async function writeSubscriptions(subscriptions: Subscription[]) {
  // Not used directly with Supabase; individual operations use insert/update/delete
  // Kept for compatibility with existing code patterns
  console.warn("writeSubscriptions() is deprecated with Supabase; use individual operations instead.");
}

function getTodayDateString() {
  const today = new Date();
  const year = today.getFullYear();
  const month = String(today.getMonth() + 1).padStart(2, "0");
  const day = String(today.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function isValidDate(value: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    return false;
  }

  const parsed = new Date(`${value}T00:00:00`);
  if (Number.isNaN(parsed.getTime())) {
    return false;
  }

  const year = parsed.getFullYear();
  const month = String(parsed.getMonth() + 1).padStart(2, "0");
  const day = String(parsed.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}` === value;
}

export function validateRenewalDate(value: string) {
  const renewalDate = String(value ?? "").trim();

  if (!renewalDate) {
    return { ok: false as const, error: "Renewal date is required." };
  }

  if (!isValidDate(renewalDate)) {
    return { ok: false as const, error: "Renewal date must be a valid date in YYYY-MM-DD format." };
  }

  const today = getTodayDateString();
  if (renewalDate < today) {
    return {
      ok: false as const,
      error: `Renewal date cannot be in the past. You entered ${renewalDate}, but the earliest allowed date is ${today}.`,
    };
  }

  return { ok: true as const, value: renewalDate };
}

export function validateSubscriptionInput(input: Partial<SubscriptionInput>) {
  const name = String(input.name ?? "").trim();
  const cost = Number(input.cost);
  const billingCycle = String(input.billingCycle ?? "").trim().toLowerCase();
  const renewalDate = String(input.renewalDate ?? "").trim();
  const team = String(input.team ?? "").trim();
  const owner = String(input.owner ?? "").trim();
  const status = String(input.status ?? "").trim().toLowerCase();
  const notes = String(input.notes ?? "").trim();

  if (!name || !team || !owner || !billingCycle || !status || !renewalDate) {
    return { ok: false as const, error: "All required fields must be filled in." };
  }

  if (!Number.isFinite(cost)) {
    return { ok: false as const, error: "Cost must be numeric. Enter a valid amount such as 999 or 999.99." };
  }

  if (cost < 0) {
    return { ok: false as const, error: "Cost cannot be negative. Enter zero or a positive amount." };
  }

  if (billingCycle !== "monthly" && billingCycle !== "yearly") {
    return { ok: false as const, error: "Billing cycle must be monthly or yearly." };
  }

  if (status !== "active" && status !== "cancelled") {
    return { ok: false as const, error: "Status must be active or cancelled." };
  }

  const renewalDateCheck = validateRenewalDate(renewalDate);
  if (!renewalDateCheck.ok) {
    return renewalDateCheck;
  }

  return {
    ok: true as const,
    value: {
      id: crypto.randomUUID(),
      name,
      cost,
      billingCycle: billingCycle as Subscription["billingCycle"],
      renewalDate: renewalDateCheck.value,
      team,
      owner,
      status: status as Subscription["status"],
      notes,
    },
  };
}

