"use client";

import Link from "next/link";
import type { Route } from "next";
import { useRouter } from "next/navigation";
import { useMemo, useState, type ReactNode } from "react";
import { useToast } from "@/components/toast-provider";
import type { Subscription } from "@/lib/types";
import { formatCurrency, isRenewingWithinDays, sortSubscriptionsByRenewalDate } from "@/lib/subscription-helpers";

type SortDirection = "asc" | "desc";

interface SubscriptionTableProps {
  subscriptions: Subscription[];
}

export function SubscriptionTable({ subscriptions }: SubscriptionTableProps) {
  const router = useRouter();
  const { confirm, toast } = useToast();
  const [teamFilter, setTeamFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");
  const [sortDirection, setSortDirection] = useState<SortDirection>("asc");
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const teams = useMemo(() => {
    return Array.from(new Set(subscriptions.map((item) => item.team))).sort();
  }, [subscriptions]);

  const visibleSubscriptions = useMemo(() => {
    const filtered = subscriptions.filter((item) => {
      const matchesTeam = teamFilter === "all" || item.team === teamFilter;
      const matchesStatus = statusFilter === "all" || item.status === statusFilter;
      return matchesTeam && matchesStatus;
    });

    const sorted = sortSubscriptionsByRenewalDate(filtered);
    return sortDirection === "asc" ? sorted : [...sorted].reverse();
  }, [subscriptions, statusFilter, sortDirection, teamFilter]);

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
        <div className="grid gap-3 sm:grid-cols-3">
          <SelectField label="Team" value={teamFilter} onChange={setTeamFilter} options={["all", ...teams]} />
          <SelectField label="Status" value={statusFilter} onChange={setStatusFilter} options={["all", "active", "cancelled"]} />
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
                    <Td className="capitalize">{subscription.billingCycle}</Td>
                    <Td>{subscription.renewalDate}</Td>
                    <Td>{subscription.team}</Td>
                    <Td>{subscription.owner}</Td>
                    <Td>
                      <StatusBadge status={subscription.status} />
                    </Td>
                    <Td>
                      <div className="flex items-center gap-3">
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
                      </div>
                    </Td>
                  </tr>
                );
              })
            ) : (
              <tr>
                <td colSpan={8} className="px-6 py-10 text-center text-sm text-slate-500">
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
