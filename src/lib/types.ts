export type BillingCycle = "monthly" | "quarterly" | "yearly";
export type SubscriptionStatus = "active" | "cancelled";
export type PaymentStatus = "paid" | "due" | "unpaid" | "skipped";

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
  paymentStatus: PaymentStatus;
  autoRenew: boolean;
  lastPaidAt?: string | null;
  lastRenewedAt?: string | null;
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
  paymentStatus?: PaymentStatus;
  autoRenew?: boolean;
  notes: string;
}

export interface SubscriptionRenewalEvent {
  id: string;
  subscriptionId: string;
  billingCycle: BillingCycle;
  amount: number;
  dueDate: string;
  status: PaymentStatus | "cancelled";
  processedAt?: string | null;
  processedBy?: string | null;
  notes?: string | null;
  createdAt?: string;
  updatedAt?: string;
}
