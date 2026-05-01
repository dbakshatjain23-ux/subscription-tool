export type BillingCycle = "monthly" | "yearly";
export type SubscriptionStatus = "active" | "cancelled";

export interface Subscription {
  id: string;
  name: string;
  cost: number;
  billingCycle: BillingCycle;
  renewalDate: string;
  team: string;
  owner: string;
  ownerUserId?: string;
  status: SubscriptionStatus;
  notes: string;
}

export interface SubscriptionInput {
  name: string;
  cost: number;
  billingCycle: BillingCycle;
  renewalDate: string;
  team: string;
  owner: string;
  status: SubscriptionStatus;
  notes: string;
}
