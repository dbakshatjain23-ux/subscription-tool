import type { PaymentStatus } from "@/lib/types";

export const paymentStatusOptions: Array<{ value: PaymentStatus; label: string }> = [
  { value: "paid", label: "Paid" },
  { value: "due", label: "Due" },
  { value: "unpaid", label: "Unpaid" },
  { value: "skipped", label: "Skipped" },
];

export function isPaymentStatus(value: string): value is PaymentStatus {
  return paymentStatusOptions.some((option) => option.value === value);
}
