"use client";

import { useEffect, useMemo, useState, type FormEvent, type ReactNode } from "react";
import { useToast } from "@/components/toast-provider";
import { invalidateClientCache } from "@/lib/client-cache";

type TeamRow = {
  id: string;
  name: string;
  description: string | null;
  is_active: boolean | null;
  created_at?: string;
};

const emptyForm = {
  name: "",
  description: "",
};

export function TeamCreateModalButton() {
  const [open, setOpen] = useState(false);

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="inline-flex h-10 items-center justify-center rounded-md bg-slate-900 px-4 text-sm font-medium text-white transition hover:bg-slate-800"
      >
        Create team
      </button>
      {open ? <TeamCreateModal onClose={() => setOpen(false)} /> : null}
    </>
  );
}

function TeamCreateModal({ onClose }: { onClose: () => void }) {
  const { toast } = useToast();
  const [form, setForm] = useState(emptyForm);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving(true);
    setError(null);

    try {
      const response = await fetch("/api/teams", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      const payload = (await response.json()) as { error?: string };

      if (!response.ok) {
        const message = payload.error ?? "Unable to create team.";
        setError(message);
        toast({ kind: "error", title: "Create team failed", message });
        return;
      }

      invalidateTeamsCache();
      window.dispatchEvent(new CustomEvent("teams:changed"));
      toast({ kind: "success", title: "Team created" });
      onClose();
    } catch {
      const message = "Unable to reach the server.";
      setError(message);
      toast({ kind: "error", title: "Create team failed", message });
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 px-4">
      <div className="w-full max-w-md rounded-lg bg-white p-5 shadow-lg">
        <div className="mb-5 flex items-start justify-between gap-4">
          <div>
            <h3 className="text-base font-semibold text-slate-900">Create team</h3>
            <p className="mt-1 text-sm text-slate-500">Add a team for subscription ownership and reporting.</p>
          </div>
          <button type="button" onClick={onClose} className="text-sm font-medium text-slate-500 hover:text-slate-900">
            Close
          </button>
        </div>
        <TeamForm form={form} setForm={setForm} onSubmit={handleSubmit} error={error} saving={saving} submitLabel="Create team" onCancel={onClose} />
      </div>
    </div>
  );
}

export function TeamManagementPanel() {
  const { confirm, toast } = useToast();
  const [teams, setTeams] = useState<TeamRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<"all" | "active" | "inactive">("all");
  const [savingTeamId, setSavingTeamId] = useState<string | null>(null);
  const [deletingTeamId, setDeletingTeamId] = useState<string | null>(null);
  const [editingTeam, setEditingTeam] = useState<TeamRow | null>(null);
  const [editForm, setEditForm] = useState(emptyForm);

  useEffect(() => {
    void loadTeams();
  }, []);

  useEffect(() => {
    function handleTeamsChanged() {
      void loadTeams();
    }

    window.addEventListener("teams:changed", handleTeamsChanged);
    return () => window.removeEventListener("teams:changed", handleTeamsChanged);
  }, []);

  async function loadTeams() {
    setLoading(true);
    setError(null);

    try {
      const response = await fetch("/api/teams", { cache: "no-store" });
      const payload = (await response.json()) as { teams?: TeamRow[]; error?: string };

      if (!response.ok) {
        setError(payload.error ?? "Unable to load teams.");
        return;
      }

      setTeams(payload.teams ?? []);
    } catch {
      setError("Unable to reach the server.");
    } finally {
      setLoading(false);
    }
  }

  async function updateTeam(teamId: string, updates: Partial<Pick<TeamRow, "name" | "description" | "is_active">>) {
    setSavingTeamId(teamId);
    setError(null);

    try {
      const response = await fetch("/api/teams", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: teamId, ...updates }),
      });
      const payload = (await response.json()) as { error?: string };

      if (!response.ok) {
        const message = payload.error ?? "Unable to update team.";
        setError(message);
        toast({ kind: "error", title: "Update failed", message });
        return false;
      }

      invalidateTeamsCache();
      toast({ kind: "success", title: "Team updated" });
      await loadTeams();
      return true;
    } catch {
      const message = "Unable to reach the server.";
      setError(message);
      toast({ kind: "error", title: "Update failed", message });
      return false;
    } finally {
      setSavingTeamId(null);
    }
  }

  async function deleteTeam(teamId: string) {
    const confirmed = await confirm({
      title: "Delete team",
      message: "This removes the team from future selections. Existing subscriptions keep their current team text.",
      confirmLabel: "Delete",
      tone: "danger",
    });

    if (!confirmed) {
      return;
    }

    setDeletingTeamId(teamId);
    setError(null);

    try {
      const response = await fetch("/api/teams", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: teamId }),
      });
      const payload = (await response.json()) as { error?: string };

      if (!response.ok) {
        const message = payload.error ?? "Unable to delete team.";
        setError(message);
        toast({ kind: "error", title: "Delete failed", message });
        return;
      }

      invalidateTeamsCache();
      toast({ kind: "success", title: "Team deleted" });
      await loadTeams();
    } catch {
      const message = "Unable to reach the server.";
      setError(message);
      toast({ kind: "error", title: "Delete failed", message });
    } finally {
      setDeletingTeamId(null);
    }
  }

  function beginEdit(team: TeamRow) {
    setEditingTeam(team);
    setEditForm({ name: team.name, description: team.description ?? "" });
  }

  async function saveEdit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!editingTeam) {
      return;
    }

    const updated = await updateTeam(editingTeam.id, editForm);
    if (updated) {
      setEditingTeam(null);
    }
  }

  const filteredTeams = useMemo(() => {
    return teams.filter((team) => {
      const status = team.is_active === false ? "inactive" : "active";
      const matchesStatus = statusFilter === "all" || statusFilter === status;
      const matchesSearch = [team.name, team.description]
        .filter(Boolean)
        .some((value) => value!.toLowerCase().includes(search.toLowerCase()));
      return matchesStatus && matchesSearch;
    });
  }, [search, statusFilter, teams]);

  const stats = useMemo(() => {
    return {
      total: teams.length,
      active: teams.filter((team) => team.is_active !== false).length,
      inactive: teams.filter((team) => team.is_active === false).length,
    };
  }, [teams]);

  return (
    <div className="grid gap-6">
      <section className="grid gap-4 md:grid-cols-3">
        <StatCard label="Total teams" value={String(stats.total)} />
        <StatCard label="Active teams" value={String(stats.active)} />
        <StatCard label="Inactive teams" value={String(stats.inactive)} />
      </section>

      <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h3 className="text-base font-semibold text-slate-900">Teams</h3>
            <p className="mt-1 text-sm text-slate-600">Create, edit, and manage teams used by subscriptions.</p>
          </div>
          <button
            type="button"
            onClick={() => void loadTeams()}
            className="inline-flex h-9 items-center justify-center rounded-md border border-slate-200 px-3 text-sm font-medium text-slate-700 transition hover:bg-slate-50"
          >
            Refresh
          </button>
        </div>

        <div className="grid gap-3 sm:grid-cols-[1fr_200px]">
          <input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search teams" className={inputClass} />
          <select value={statusFilter} onChange={(event) => setStatusFilter(event.target.value as "all" | "active" | "inactive")} className={selectClass}>
            <option value="all">All status</option>
            <option value="active">Active</option>
            <option value="inactive">Inactive</option>
          </select>
        </div>

        <div className="mt-4 overflow-x-auto">
          <table className="min-w-full divide-y divide-slate-200">
            <thead className="bg-slate-50 text-left text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">
              <tr>
                <Th>Name</Th>
                <Th>Description</Th>
                <Th>Status</Th>
                <Th>Actions</Th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 bg-white">
              {loading ? (
                <tr>
                  <td colSpan={4} className="px-6 py-10 text-center text-sm text-slate-500">Loading teams...</td>
                </tr>
              ) : filteredTeams.length ? (
                filteredTeams.map((team) => (
                  <tr key={team.id}>
                    <Td>{team.name}</Td>
                    <Td>{team.description || "No description"}</Td>
                    <Td>
                      <button
                        type="button"
                        onClick={() => void updateTeam(team.id, { is_active: !team.is_active })}
                        className={`inline-flex rounded-full px-3 py-1 text-xs font-semibold ring-1 transition ${
                          team.is_active ? "bg-emerald-50 text-emerald-700 ring-emerald-200" : "bg-slate-100 text-slate-600 ring-slate-200"
                        }`}
                        disabled={savingTeamId === team.id}
                      >
                        {team.is_active ? "Active" : "Inactive"}
                      </button>
                    </Td>
                    <Td>
                      <div className="flex items-center gap-3 text-xs">
                        <button type="button" onClick={() => beginEdit(team)} className="font-medium text-slate-600">Edit</button>
                        <button
                          type="button"
                          onClick={() => void deleteTeam(team.id)}
                          className="font-medium text-rose-600"
                          disabled={deletingTeamId === team.id}
                        >
                          {deletingTeamId === team.id ? "Deleting..." : "Delete"}
                        </button>
                      </div>
                    </Td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={4} className="px-6 py-10 text-center text-sm text-slate-500">No teams found.</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
        {error ? <p className="mt-4 rounded-lg bg-rose-50 px-3 py-2 text-sm text-rose-700">{error}</p> : null}
      </section>

      {editingTeam ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 px-4">
          <div className="w-full max-w-md rounded-lg bg-white p-5 shadow-lg">
            <div className="mb-5 flex items-start justify-between gap-4">
              <div>
                <h3 className="text-base font-semibold text-slate-900">Edit team</h3>
                <p className="mt-1 text-sm text-slate-500">Update team name and description.</p>
              </div>
              <button type="button" onClick={() => setEditingTeam(null)} className="text-sm font-medium text-slate-500 hover:text-slate-900">
                Close
              </button>
            </div>
            <TeamForm
              form={editForm}
              setForm={setEditForm}
              onSubmit={saveEdit}
              saving={savingTeamId === editingTeam.id}
              submitLabel="Save changes"
              onCancel={() => setEditingTeam(null)}
            />
          </div>
        </div>
      ) : null}
    </div>
  );
}

function TeamForm({
  form,
  setForm,
  onSubmit,
  error,
  saving,
  submitLabel,
  onCancel,
}: {
  form: typeof emptyForm;
  setForm: React.Dispatch<React.SetStateAction<typeof emptyForm>>;
  onSubmit: (event: FormEvent<HTMLFormElement>) => void;
  error?: string | null;
  saving: boolean;
  submitLabel: string;
  onCancel: () => void;
}) {
  return (
    <form onSubmit={onSubmit} className="space-y-4">
      <label className="block space-y-2 text-sm font-medium text-slate-700">
        <span>Team name</span>
        <input value={form.name} onChange={(event) => setForm((current) => ({ ...current, name: event.target.value }))} required className={inputClass} />
      </label>
      <label className="block space-y-2 text-sm font-medium text-slate-700">
        <span>Description</span>
        <input value={form.description} onChange={(event) => setForm((current) => ({ ...current, description: event.target.value }))} className={inputClass} />
      </label>
      {error ? <p className="rounded-lg bg-rose-50 px-3 py-2 text-sm text-rose-700">{error}</p> : null}
      <div className="flex items-center justify-end gap-2">
        <button type="button" onClick={onCancel} className="inline-flex h-10 items-center justify-center rounded-md border border-slate-200 px-4 text-sm font-medium text-slate-700">
          Cancel
        </button>
        <button type="submit" disabled={saving} className="inline-flex h-10 items-center justify-center rounded-md bg-slate-900 px-4 text-sm font-medium text-white disabled:opacity-60">
          {saving ? "Saving..." : submitLabel}
        </button>
      </div>
    </form>
  );
}

function invalidateTeamsCache() {
  invalidateClientCache("teams:list");
}

function StatCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
      <p className="text-sm font-medium text-slate-500">{label}</p>
      <p className="mt-3 text-3xl font-semibold tracking-tight text-slate-950">{value}</p>
    </div>
  );
}

function Th({ children }: { children: ReactNode }) {
  return <th className="px-6 py-4 text-sm font-semibold">{children}</th>;
}

function Td({ children }: { children: ReactNode }) {
  return <td className="px-6 py-4 text-sm text-slate-700">{children}</td>;
}

const inputClass =
  "h-10 w-full rounded-md border border-slate-200 bg-white px-3 text-sm text-slate-950 outline-none transition placeholder:text-slate-400 focus:border-slate-400 focus:ring-2 focus:ring-slate-200";

const selectClass =
  "h-10 w-full rounded-md border border-slate-200 bg-white px-3 text-sm text-slate-950 outline-none transition focus:border-slate-400 focus:ring-2 focus:ring-slate-200";
