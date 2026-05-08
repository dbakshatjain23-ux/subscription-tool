import type { BillingCycle } from "@/lib/types";

export const billingCycleOptions: Array<{ value: BillingCycle; label: string }> = [
  { value: "monthly", label: "Monthly" },
  { value: "quarterly", label: "Quarterly" },
  { value: "yearly", label: "Yearly" },
];

export function isBillingCycle(value: string): value is BillingCycle {
  return billingCycleOptions.some((option) => option.value === value);
}

export function formatBillingCycle(value: BillingCycle) {
  return billingCycleOptions.find((option) => option.value === value)?.label ?? value;
}
