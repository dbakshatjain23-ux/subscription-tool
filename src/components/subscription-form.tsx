"use client";

import { useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState, type FormEvent, type ReactNode } from "react";
import { useToast } from "@/components/toast-provider";
import { fetchWithClientCache } from "@/lib/client-cache";
import type { Subscription } from "@/lib/types";

const defaultForm = {
  name: "",
  cost: "",
  billingCycle: "monthly",
  renewalDate: "",
  team: "",
  owner: "",
  ownerUserId: "",
  status: "active",
  notes: "",
};

function getTodayDateString() {
  const today = new Date();
  const year = today.getFullYear();
  const month = String(today.getMonth() + 1).padStart(2, "0");
  const day = String(today.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function createFormState(subscription?: Subscription | null) {
  if (!subscription) {
    return defaultForm;
  }

  return {
    name: subscription.name,
    cost: subscription.cost.toString(),
    billingCycle: subscription.billingCycle,
    renewalDate: subscription.renewalDate,
    team: subscription.team,
    owner: subscription.owner,
    ownerUserId: subscription.ownerUserId ?? "",
    status: subscription.status,
    notes: subscription.notes,
  };
}

interface SubscriptionFormProps {
  subscription?: Subscription | null;
  onSuccess?: () => void;
  onCancel?: () => void;
  redirectOnSuccess?: boolean;
}

export function SubscriptionForm({ subscription = null, onSuccess, onCancel, redirectOnSuccess = true }: SubscriptionFormProps) {
  const router = useRouter();
  const { toast } = useToast();
  const [form, setForm] = useState(() => createFormState(subscription));
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [ownerOptions, setOwnerOptions] = useState<Array<{ label: string; value: string }>>([]);
  const [ownerSearch, setOwnerSearch] = useState("");
  const [ownerOpen, setOwnerOpen] = useState(false);
  const [ownersLoading, setOwnersLoading] = useState(false);
  const [ownersError, setOwnersError] = useState<string | null>(null);
  const [teamOptions, setTeamOptions] = useState<Array<{ label: string; value: string }>>([]);
  const [teamSearch, setTeamSearch] = useState("");
  const [teamOpen, setTeamOpen] = useState(false);
  const [teamsLoading, setTeamsLoading] = useState(false);
  const [teamsError, setTeamsError] = useState<string | null>(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const ownerControlRef = useRef<HTMLDivElement | null>(null);
  const teamControlRef = useRef<HTMLDivElement | null>(null);
  const minRenewalDate = useMemo(() => getTodayDateString(), []);

  function updateField(field: keyof typeof defaultForm, value: string) {
    setForm((current) => ({ ...current, [field]: value }));
  }

  useEffect(() => {
    let active = true;

    async function loadOwners() {
      setOwnersLoading(true);
      setOwnersError(null);

      try {
        const payload = await fetchWithClientCache<{
          users?: Array<{ id: string; full_name: string | null; email: string }>;
          currentUser?: { id: string; full_name: string | null; email: string };
          isAdmin?: boolean;
          error?: string;
        }>(
          "users:lookup",
          async () => {
            const response = await fetch("/api/users/lookup", { cache: "no-store" });
            const lookupPayload = (await response.json()) as {
              users?: Array<{ id: string; full_name: string | null; email: string }>;
              currentUser?: { id: string; full_name: string | null; email: string };
              isAdmin?: boolean;
              error?: string;
            };

            if (!response.ok) {
              throw new Error(lookupPayload.error ?? "Unable to load users.");
            }

            return lookupPayload;
          },
          120_000
        );

        if (!active) {
          return;
        }

        const isAdminUser = Boolean(payload.isAdmin);
        const users = (payload.users ?? []).map((user) => {
          const label = user.full_name?.trim() || user.email;
          return { label, value: user.id };
        });

        const personOptions = users.length
          ? users
          : payload.currentUser
            ? [{ label: payload.currentUser.full_name?.trim() || payload.currentUser.email, value: payload.currentUser.id }]
            : [];
        const options = isAdminUser ? [{ label: "Organization", value: "" }, ...personOptions] : personOptions;

        setIsAdmin(isAdminUser);
        setOwnerOptions(options);

        if (subscription && !form.ownerUserId) {
          const matchingOwner = options.find((option) => option.label === subscription.owner);
          if (matchingOwner) {
            setForm((current) => ({ ...current, ownerUserId: matchingOwner.value }));
          }
        }

        if (!subscription && !form.owner) {
          const defaultOwner = payload.currentUser?.full_name?.trim() || payload.currentUser?.email || "";
          if (defaultOwner) {
            setForm((current) => ({ ...current, owner: defaultOwner, ownerUserId: payload.currentUser?.id ?? "" }));
          }
        }
      } catch (err) {
        if (!active) {
          return;
        }
        const message = err instanceof Error ? err.message : "Unable to load owners.";
        setOwnersError(message);
      } finally {
        if (active) {
          setOwnersLoading(false);
        }
      }
    }

    void loadOwners();

    return () => {
      active = false;
    };
  }, [form.owner, form.ownerUserId, subscription]);

  useEffect(() => {
    let active = true;

    async function loadTeams() {
      setTeamsLoading(true);
      setTeamsError(null);

      try {
        const payload = await fetchWithClientCache<{
          teams?: Array<{ id: string; name: string; is_active?: boolean | null }>;
          error?: string;
        }>(
          "teams:list",
          async () => {
            const response = await fetch("/api/teams", { cache: "no-store" });
            const teamsPayload = (await response.json()) as {
              teams?: Array<{ id: string; name: string; is_active?: boolean | null }>;
              error?: string;
            };

            if (!response.ok) {
              throw new Error(teamsPayload.error ?? "Unable to load teams.");
            }

            return teamsPayload;
          },
          120_000
        );

        if (!active) {
          return;
        }

        setTeamOptions((payload.teams ?? []).filter((team) => team.is_active !== false).map((team) => ({ label: team.name, value: team.name })));
      } catch (err) {
        if (!active) {
          return;
        }
        const message = err instanceof Error ? err.message : "Unable to load teams.";
        setTeamsError(message);
      } finally {
        if (active) {
          setTeamsLoading(false);
        }
      }
    }

    void loadTeams();

    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    function handleDocumentClick(event: MouseEvent) {
      if (!ownerControlRef.current) {
        return;
      }

      if (!ownerControlRef.current.contains(event.target as Node)) {
        setOwnerOpen(false);
      }
    }

    document.addEventListener("mousedown", handleDocumentClick);
    return () => document.removeEventListener("mousedown", handleDocumentClick);
  }, []);

  useEffect(() => {
    function handleDocumentClick(event: MouseEvent) {
      if (!teamControlRef.current) {
        return;
      }

      if (!teamControlRef.current.contains(event.target as Node)) {
        setTeamOpen(false);
      }
    }

    document.addEventListener("mousedown", handleDocumentClick);
    return () => document.removeEventListener("mousedown", handleDocumentClick);
  }, []);

  const filteredOwners = useMemo(() => {
    if (!ownerSearch.trim()) {
      return ownerOptions;
    }
    const query = ownerSearch.toLowerCase();
    return ownerOptions.filter((option) => option.label.toLowerCase().includes(query));
  }, [ownerOptions, ownerSearch]);

  const filteredTeams = useMemo(() => {
    if (!teamSearch.trim()) {
      return teamOptions;
    }

    const query = teamSearch.toLowerCase();
    return teamOptions.filter((option) => option.label.toLowerCase().includes(query));
  }, [teamOptions, teamSearch]);

  const selectedOwnerLabel = form.owner || (isAdmin ? "Select owner" : "Select owner");
  const selectedTeamLabel = form.team || "Select team";

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSubmitting(true);
    setError(null);
    setSuccess(null);

    try {
      const response = await fetch("/api/subscriptions", {
        method: subscription ? "PUT" : "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(subscription ? { ...form, id: subscription.id } : form),
      });

      const payload = (await response.json()) as { error?: string };

      if (!response.ok) {
        const message = payload.error ?? "Unable to save subscription.";
        setError(message);
        toast({ kind: "error", title: "Save failed", message });
        return;
      }

      const successMessage = subscription ? "Subscription updated successfully." : "Subscription added successfully.";
      setSuccess(successMessage);
      toast({ kind: "success", title: subscription ? "Subscription updated" : "Subscription added" });
      if (!subscription) {
        setForm(defaultForm);
      }
      onSuccess?.();
      if (redirectOnSuccess) {
        router.push("/subscriptions");
      }
      router.refresh();
    } catch {
      const message = "Unable to reach the server.";
      setError(message);
      toast({ kind: "error", title: "Save failed", message });
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="grid gap-4 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
      <div className="grid gap-4 md:grid-cols-2">
        <Field label="Subscription Name" required>
          <input value={form.name} onChange={(event) => updateField("name", event.target.value)} required className={inputClass} />
        </Field>
        <Field label="Cost" required>
          <input value={form.cost} onChange={(event) => updateField("cost", event.target.value)} type="number" min="0" step="0.01" required className={inputClass} />
        </Field>
        <Field label="Billing Cycle" required>
          <select value={form.billingCycle} onChange={(event) => updateField("billingCycle", event.target.value)} required className={inputClass}>
            <option value="monthly">Monthly</option>
            <option value="yearly">Yearly</option>
          </select>
        </Field>
        <Field label="Renewal Date" required>
          <input
            value={form.renewalDate}
            onChange={(event) => updateField("renewalDate", event.target.value)}
            type="date"
            min={minRenewalDate}
            required
            className={inputClass}
          />
        </Field>
        <Field label="Assigned Team" required>
          <div ref={teamControlRef} className="relative">
            <button
              type="button"
              onClick={() => setTeamOpen((current) => !current)}
              className={inputClass + " flex items-center justify-between text-left"}
              disabled={teamsLoading}
            >
              <span className={form.team ? "text-slate-950" : "text-slate-400"}>{selectedTeamLabel}</span>
              <span className="ml-4 text-slate-400">v</span>
            </button>

            {teamOpen ? (
              <div className="absolute left-0 top-full z-20 mt-2 w-full rounded-xl border border-slate-200 bg-white shadow-lg">
                <div className="border-b border-slate-100 p-2">
                  <input value={teamSearch} onChange={(event) => setTeamSearch(event.target.value)} className={inputClass} placeholder="Search teams" autoFocus />
                </div>

                <div className="max-h-64 overflow-y-auto p-1">
                  {filteredTeams.map((option) => {
                    const selected = form.team === option.value;
                    return (
                      <button
                        key={option.value}
                        type="button"
                        onClick={() => {
                          updateField("team", option.value);
                          setTeamOpen(false);
                          setTeamSearch("");
                        }}
                        className={`flex w-full items-center justify-between rounded-lg px-3 py-2 text-left text-sm transition ${
                          selected ? "bg-slate-900 text-white" : "hover:bg-slate-100 text-slate-700"
                        }`}
                      >
                        <span>{option.label}</span>
                        {selected ? <span className="text-xs">Selected</span> : null}
                      </button>
                    );
                  })}
                  {filteredTeams.length === 0 ? <p className="px-3 py-2 text-sm text-slate-500">No teams found.</p> : null}
                </div>
              </div>
            ) : null}

            <input type="hidden" name="team" value={form.team} />
            {teamsError ? <p className="mt-2 text-xs text-rose-600">{teamsError}</p> : null}
          </div>
        </Field>
        <Field label="Owner" required>
          <div ref={ownerControlRef} className="relative">
            <button
              type="button"
              onClick={() => setOwnerOpen((current) => !current)}
              className={inputClass + " flex items-center justify-between text-left"}
              disabled={ownersLoading}
            >
              <span className={form.owner ? "text-slate-950" : "text-slate-400"}>{selectedOwnerLabel}</span>
              <span className="ml-4 text-slate-400">▾</span>
            </button>

            {ownerOpen ? (
              <div className="absolute left-0 top-full z-20 mt-2 w-full rounded-xl border border-slate-200 bg-white shadow-lg">
                <div className="border-b border-slate-100 p-2">
                  <input
                    value={ownerSearch}
                    onChange={(event) => setOwnerSearch(event.target.value)}
                    className={inputClass}
                    placeholder="Search users"
                    autoFocus
                  />
                </div>

                <div className="max-h-64 overflow-y-auto p-1">
                  {filteredOwners.map((option) => {
                    const selected = form.ownerUserId === option.value;
                    return (
                      <button
                        key={option.value}
                        type="button"
                        onClick={() => {
                          setForm((current) => ({ ...current, owner: option.label, ownerUserId: option.value }));
                          setOwnerOpen(false);
                          setOwnerSearch("");
                        }}
                        className={`flex w-full items-center justify-between rounded-lg px-3 py-2 text-left text-sm transition ${
                          selected ? "bg-slate-900 text-white" : "hover:bg-slate-100 text-slate-700"
                        }`}
                      >
                        <span>{option.label}</span>
                        {selected ? <span className="text-xs">Selected</span> : null}
                      </button>
                    );
                  })}
                  {filteredOwners.length === 0 ? <p className="px-3 py-2 text-sm text-slate-500">No matches found.</p> : null}
                </div>
              </div>
            ) : null}

            <input type="hidden" name="owner" value={form.owner} />
            <input type="hidden" name="ownerUserId" value={form.ownerUserId} />
            {ownersError ? <p className="mt-2 text-xs text-rose-600">{ownersError}</p> : null}
          </div>
        </Field>
        <Field label="Status" required>
          <select value={form.status} onChange={(event) => updateField("status", event.target.value)} required className={inputClass}>
            <option value="active">Active</option>
            <option value="cancelled">Cancelled</option>
          </select>
        </Field>
        <Field label="Notes">
          <input value={form.notes} onChange={(event) => updateField("notes", event.target.value)} className={inputClass} />
        </Field>
      </div>
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="min-h-6 text-sm">
          {error ? <p className="text-rose-700">{error}</p> : null}
          {success ? <p className="text-emerald-700">{success}</p> : null}
        </div>
        <div className="flex items-center gap-2">
          {onCancel ? (
            <button
              type="button"
              onClick={onCancel}
              className="inline-flex h-11 items-center justify-center rounded-xl border border-slate-200 px-5 text-sm font-medium text-slate-700 transition hover:bg-slate-50"
            >
              Cancel
            </button>
          ) : null}
          <button
            type="submit"
            disabled={submitting}
            className="inline-flex h-11 items-center justify-center rounded-xl bg-slate-950 px-5 text-sm font-medium text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {submitting ? "Saving..." : subscription ? "Update subscription" : "Save subscription"}
          </button>
        </div>
      </div>
    </form>
  );
}

function Field({ label, required, children }: { label: string; required?: boolean; children: ReactNode }) {
  return (
    <label className="space-y-2 text-sm font-medium text-slate-700">
      <span>
        {label}
        {required ? <span className="ml-1 text-rose-600">*</span> : null}
      </span>
      {children}
    </label>
  );
}

const inputClass =
  "h-11 w-full rounded-xl border border-slate-200 bg-white px-4 text-sm text-slate-950 outline-none transition placeholder:text-slate-400 focus:border-slate-400 focus:ring-2 focus:ring-slate-200";
