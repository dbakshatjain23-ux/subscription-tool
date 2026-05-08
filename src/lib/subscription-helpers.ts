import type { Subscription } from "@/lib/types";

export function addBillingCycle(date: Date, billingCycle: Subscription["billingCycle"]) {
  const next = new Date(date);
  if (billingCycle === "yearly") {
    next.setFullYear(next.getFullYear() + 1);
  } else if (billingCycle === "quarterly") {
    next.setMonth(next.getMonth() + 3);
  } else {
    next.setMonth(next.getMonth() + 1);
  }
  return next;
}

function toDateOnly(value: Date) {
  return value.toISOString().slice(0, 10);
}

export function getNextRenewalAfter(renewalDate: string, billingCycle: Subscription["billingCycle"], afterDate = new Date()) {
  const parsed = new Date(`${renewalDate}T00:00:00`);
  if (Number.isNaN(parsed.getTime())) {
    return renewalDate;
  }

  const limit = new Date(afterDate);
  limit.setHours(0, 0, 0, 0);
  parsed.setHours(0, 0, 0, 0);

  let nextRenewal = parsed;
  do {
    nextRenewal = addBillingCycle(nextRenewal, billingCycle);
  } while (nextRenewal <= limit);

  return toDateOnly(nextRenewal);
}

export function getNextRenewalDate(subscription: Pick<Subscription, "billingCycle" | "renewalDate" | "status">) {
  if (subscription.status !== "active") {
    return subscription.renewalDate;
  }

  const originalDate = new Date(subscription.renewalDate);
  if (Number.isNaN(originalDate.getTime())) {
    return subscription.renewalDate;
  }

  const today = new Date();
  today.setHours(0, 0, 0, 0);
  originalDate.setHours(0, 0, 0, 0);

  let nextRenewal = originalDate;
  while (nextRenewal < today) {
    nextRenewal = addBillingCycle(nextRenewal, subscription.billingCycle);
  }

  return toDateOnly(nextRenewal);
}

export function sortSubscriptionsByRenewalDate(subscriptions: Subscription[]) {
  return [...subscriptions].sort((first, second) => {
    return new Date(first.renewalDate).getTime() - new Date(second.renewalDate).getTime();
  });
}

export function isRenewingWithinDays(renewalDate: string, days = 7) {
  const due = new Date(renewalDate);
  const now = new Date();
  const upperBound = new Date(now);
  upperBound.setDate(now.getDate() + days);

  return due >= now && due <= upperBound;
}

export function countRenewingSoon(subscriptions: Subscription[], days = 7) {
  return subscriptions.filter((item) => item.status === "active" && isRenewingWithinDays(item.renewalDate, days)).length;
}

export function toMonthlyCost(subscription: Subscription) {
  if (subscription.billingCycle === "yearly") {
    return subscription.cost / 12;
  }

  if (subscription.billingCycle === "quarterly") {
    return subscription.cost / 3;
  }

  return subscription.cost;
}

export function toAnnualCost(subscription: Subscription) {
  if (subscription.billingCycle === "monthly") {
    return subscription.cost * 12;
  }

  if (subscription.billingCycle === "quarterly") {
    return subscription.cost * 4;
  }

  return subscription.cost;
}

export function formatCurrency(value: number) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 2,
  }).format(value);
}
