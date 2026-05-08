"use client";

import Link from "next/link";
import type { Route } from "next";
import { useRouter } from "next/navigation";
import { useMemo, useState, type ReactNode } from "react";
import { useToast } from "@/components/toast-provider";
import type { Subscription } from "@/lib/types";
import { formatBillingCycle } from "@/lib/billing-cycles";
import { paymentStatusOptions } from "@/lib/payment-statuses";
import { formatCurrency, isRenewingWithinDays, sortSubscriptionsByRenewalDate } from "@/lib/subscription-helpers";

type SortDirection = "asc" | "desc";

interface SubscriptionTableProps {
  subscriptions: Subscription[];
  canManageRenewals?: boolean;
}

export function SubscriptionTable({ subscriptions, canManageRenewals = false }: SubscriptionTableProps) {
  const router = useRouter();
  const { confirm, toast } = useToast();
  const [teamFilter, setTeamFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");
  const [paymentFilter, setPaymentFilter] = useState("all");
  const [sortDirection, setSortDirection] = useState<SortDirection>("asc");
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [workingAction, setWorkingAction] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const teams = useMemo(() => {
    return Array.from(new Set(subscriptions.map((item) => item.team))).sort();
  }, [subscriptions]);

  const visibleSubscriptions = useMemo(() => {
    const filtered = subscriptions.filter((item) => {
      const matchesTeam = teamFilter === "all" || item.team === teamFilter;
      const matchesStatus = statusFilter === "all" || item.status === statusFilter;
      const matchesPayment = paymentFilter === "all" || item.paymentStatus === paymentFilter;
      return matchesTeam && matchesStatus && matchesPayment;
    });

    const sorted = sortSubscriptionsByRenewalDate(filtered);
    return sortDirection === "asc" ? sorted : [...sorted].reverse();
  }, [paymentFilter, subscriptions, statusFilter, sortDirection, teamFilter]);

  async function handleRenewalAction(subscription: Subscription, action: "mark_paid" | "mark_unpaid" | "skip" | "cancel" | "move_next") {
    if (action === "cancel") {
      const confirmed = await confirm({
        title: "Cancel subscription",
        message: "This keeps the record but removes it from active renewals.",
        confirmLabel: "Cancel subscription",
        tone: "danger",
      });
      if (!confirmed) {
        return;
      }
    }

    const actionKey = `${subscription.id}:${action}`;
    setWorkingAction(actionKey);
    setError(null);

    try {
      const response = await fetch("/api/subscriptions/renewals", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ subscriptionId: subscription.id, action }),
      });

      const payload = (await response.json()) as { error?: string };

      if (!response.ok) {
        const message = payload.error ?? "Unable to update renewal.";
        setError(message);
        toast({ kind: "error", title: "Renewal update failed", message });
        return;
      }

      toast({ kind: "success", title: "Renewal updated" });
      router.refresh();
    } catch {
      const message = "Unable to reach the server.";
      setError(message);
      toast({ kind: "error", title: "Renewal update failed", message });
    } finally {
      setWorkingAction(null);
    }
  }

  async function handleDelete(id: string) {
    const confirmed = await confirm({
      title: "Delete subscription",
      message: "This will permanently remove the subscription from the workspace.",
      confirmLabel: "Delete",
      tone: "danger",
    });
    if (!confirmed) {
      return;
    }

    setDeletingId(id);
    setError(null);

    try {
      const response = await fetch(`/api/subscriptions?id=${encodeURIComponent(id)}`, {
        method: "DELETE",
      });

      const payload = (await response.json()) as { error?: string };

      if (!response.ok) {
        const message = payload.error ?? "Unable to delete subscription.";
        setError(message);
        toast({ kind: "error", title: "Delete failed", message });
        return;
      }

      toast({ kind: "success", title: "Subscription deleted" });
      router.refresh();
    } catch {
      const message = "Unable to reach the server.";
      setError(message);
      toast({ kind: "error", title: "Delete failed", message });
    } finally {
      setDeletingId(null);
    }
  }

  return (
    <div className="rounded-2xl border border-slate-200 bg-white shadow-sm">
      <div className="flex flex-col gap-4 border-b border-slate-200 p-5 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <h2 className="text-lg font-semibold text-slate-950">Subscriptions</h2>
          <p className="mt-1 text-sm text-slate-600">Sort by renewal date and filter by team or status.</p>
        </div>
        <div className="grid gap-3 sm:grid-cols-4">
          <SelectField label="Team" value={teamFilter} onChange={setTeamFilter} options={["all", ...teams]} />
          <SelectField label="Status" value={statusFilter} onChange={setStatusFilter} options={["all", "active", "cancelled"]} />
          <SelectField label="Payment" value={paymentFilter} onChange={setPaymentFilter} options={["all", ...paymentStatusOptions.map((option) => option.value)]} />
          <SelectField label="Sort" value={sortDirection} onChange={(value) => setSortDirection(value as SortDirection)} options={["asc", "desc"]} />
        </div>
      </div>

      {error ? <p className="border-b border-slate-200 bg-rose-50 px-6 py-3 text-sm text-rose-700">{error}</p> : null}

      <div className="overflow-x-auto">
        <table className="min-w-full divide-y divide-slate-200">
          <thead className="bg-slate-50 text-left text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">
            <tr>
              <Th>Name</Th>
              <Th>Cost</Th>
              <Th>Billing Cycle</Th>
              <Th>Renewal Date</Th>
              <Th>Payment</Th>
              <Th>Auto Renew</Th>
              <Th>Team</Th>
              <Th>Owner</Th>
              <Th>Status</Th>
              <Th>Actions</Th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 bg-white">
            {visibleSubscriptions.length ? (
              visibleSubscriptions.map((subscription) => {
                const urgent = isRenewingWithinDays(subscription.renewalDate);
                const editHref = `/subscriptions/${subscription.id}` as Route;

                return (
                  <tr key={subscription.id} className={urgent ? "bg-amber-50/70" : undefined}>
                    <Td>
                      <div className="flex flex-col gap-1">
                        <span className="font-medium text-slate-950">{subscription.name}</span>
                        {urgent ? <span className="text-xs font-medium text-amber-700">Renewal within 7 days</span> : null}
                      </div>
                    </Td>
                    <Td>{formatCurrency(subscription.cost)}</Td>
                    <Td>{formatBillingCycle(subscription.billingCycle)}</Td>
                    <Td>{subscription.renewalDate}</Td>
                    <Td>
                      <PaymentBadge status={subscription.paymentStatus} />
                    </Td>
                    <Td>{subscription.autoRenew ? "On" : "Off"}</Td>
                    <Td>{subscription.team}</Td>
                    <Td>{subscription.owner}</Td>
                    <Td>
                      <StatusBadge status={subscription.status} />
                    </Td>
                    <Td>
                      <div className="flex min-w-52 flex-wrap items-center gap-2">
                        <Link
                          href={editHref}
                          className="text-sm font-medium text-slate-900 underline-offset-4 hover:underline"
                        >
                          Edit
                        </Link>
                        <button
                          type="button"
                          onClick={() => void handleDelete(subscription.id)}
                          disabled={deletingId === subscription.id}
                          className="text-sm font-medium text-rose-700 transition hover:text-rose-800 disabled:cursor-not-allowed disabled:opacity-60"
                        >
                          {deletingId === subscription.id ? "Deleting..." : "Delete"}
                        </button>
                        {canManageRenewals ? (
                          <RenewalActionSelect
                            disabled={workingAction !== null || subscription.status === "cancelled"}
                            onAction={(action) => void handleRenewalAction(subscription, action)}
                          />
                        ) : null}
                      </div>
                    </Td>
                  </tr>
                );
              })
            ) : (
              <tr>
                <td colSpan={10} className="px-6 py-10 text-center text-sm text-slate-500">
                  No subscriptions match the current filters.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function SelectField({
  label,
  value,
  onChange,
  options,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  options: string[];
}) {
  return (
    <label className="space-y-2 text-sm font-medium text-slate-700">
      <span>{label}</span>
      <select
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="h-11 w-full rounded-xl border border-slate-200 bg-white px-4 text-sm text-slate-950 outline-none transition focus:border-slate-400 focus:ring-2 focus:ring-slate-200"
      >
        {options.map((option) => (
          <option key={option} value={option} className="capitalize">
            {option}
          </option>
        ))}
      </select>
    </label>
  );
}

function Th({ children }: { children: ReactNode }) {
  return <th className="px-6 py-4 text-sm font-semibold">{children}</th>;
}

function Td({ children, className }: { children: ReactNode; className?: string }) {
  return <td className={`px-6 py-4 text-sm text-slate-700 ${className ?? ""}`}>{children}</td>;
}

function StatusBadge({ status }: { status: Subscription["status"] }) {
  const styles =
    status === "active"
      ? "bg-emerald-50 text-emerald-700 ring-emerald-200"
      : "bg-slate-100 text-slate-600 ring-slate-200";

  return <span className={`inline-flex rounded-full px-3 py-1 text-xs font-medium capitalize ring-1 ${styles}`}>{status}</span>;
}

function PaymentBadge({ status }: { status: Subscription["paymentStatus"] }) {
  const styles =
    status === "paid"
      ? "bg-emerald-50 text-emerald-700 ring-emerald-200"
      : status === "due"
        ? "bg-amber-50 text-amber-700 ring-amber-200"
        : status === "unpaid"
          ? "bg-rose-50 text-rose-700 ring-rose-200"
          : "bg-slate-100 text-slate-600 ring-slate-200";

  return <span className={`inline-flex rounded-full px-3 py-1 text-xs font-medium capitalize ring-1 ${styles}`}>{status}</span>;
}

function RenewalActionSelect({
  disabled,
  onAction,
}: {
  disabled: boolean;
  onAction: (action: "mark_paid" | "mark_unpaid" | "skip" | "cancel" | "move_next") => void;
}) {
  return (
    <select
      value=""
      onChange={(event) => {
        const action = event.target.value as "mark_paid" | "mark_unpaid" | "skip" | "cancel" | "move_next";
        if (action) {
          onAction(action);
        }
      }}
      disabled={disabled}
      className="h-8 w-36 rounded-md border border-slate-200 bg-white px-2 text-xs font-medium text-slate-700 outline-none transition hover:bg-slate-50 focus:border-slate-400 focus:ring-2 focus:ring-slate-200 disabled:cursor-not-allowed disabled:opacity-50"
    >
      <option value="">Renewal actions</option>
      <option value="mark_paid">Mark paid</option>
      <option value="mark_unpaid">Mark unpaid</option>
      <option value="skip">Skip cycle</option>
      <option value="move_next">Move next</option>
      <option value="cancel">Cancel subscription</option>
    </select>
  );
}
