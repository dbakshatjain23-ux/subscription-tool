import { getSupabaseAdminClient } from "@/lib/supabase";

export const RENEWAL_GRACE_PERIOD_KEY = "renewal_grace_period_days";
export const DEFAULT_RENEWAL_GRACE_PERIOD_DAYS = 7;

export type RenewalGracePeriod = {
  mode: "days" | "never";
  days: number;
  value: string;
};

export function parseRenewalGracePeriod(value?: string | null): RenewalGracePeriod {
  const normalized = String(value ?? DEFAULT_RENEWAL_GRACE_PERIOD_DAYS).trim().toLowerCase();

  if (normalized === "never") {
    return { mode: "never", days: DEFAULT_RENEWAL_GRACE_PERIOD_DAYS, value: "never" };
  }

  const days = Math.max(0, Number.parseInt(normalized, 10));
  const safeDays = Number.isFinite(days) ? days : DEFAULT_RENEWAL_GRACE_PERIOD_DAYS;

  return { mode: "days", days: safeDays, value: String(safeDays) };
}

export async function readRenewalGracePeriod(): Promise<RenewalGracePeriod> {
  const supabase = getSupabaseAdminClient();
  if (!supabase) {
    return parseRenewalGracePeriod();
  }

  const { data } = await supabase
    .from("app_settings")
    .select("value")
    .eq("key", RENEWAL_GRACE_PERIOD_KEY)
    .maybeSingle();

  return parseRenewalGracePeriod(data?.value);
}

export function canChangeCurrentRenewalCycle(renewalDate: string, gracePeriod: RenewalGracePeriod, today = new Date()) {
  const dueDate = new Date(`${renewalDate}T00:00:00`);
  if (Number.isNaN(dueDate.getTime())) {
    return false;
  }

  const currentDate = new Date(today);
  currentDate.setHours(0, 0, 0, 0);
  dueDate.setHours(0, 0, 0, 0);

  if (currentDate < dueDate) {
    return false;
  }

  if (gracePeriod.mode === "never") {
    return true;
  }

  const changeUntil = new Date(dueDate);
  changeUntil.setDate(changeUntil.getDate() + gracePeriod.days);

  return currentDate <= changeUntil;
}
