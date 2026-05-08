"use client";

import { useEffect, useMemo, useState, type ReactNode } from "react";
import { useToast } from "@/components/toast-provider";
import { invalidateClientCache } from "@/lib/client-cache";

type UserRow = {
  id: string;
  email: string;
  full_name: string | null;
  role: "admin" | "user";
  is_active: boolean | null;
  is_super_admin?: boolean;
  created_at?: string;
};

export function UserManagementPanel() {
  const { confirm, toast } = useToast();
  const [users, setUsers] = useState<UserRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [savingUserId, setSavingUserId] = useState<string | null>(null);
  const [deletingUserId, setDeletingUserId] = useState<string | null>(null);
  const [editingUserId, setEditingUserId] = useState<string | null>(null);
  const [nameDraft, setNameDraft] = useState("");
  const [emailDraft, setEmailDraft] = useState("");
  const [statusDraft, setStatusDraft] = useState<"active" | "inactive">("active");
  const [roleDraft, setRoleDraft] = useState<"admin" | "user">("user");
  const [isEditOpen, setIsEditOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<"all" | "active" | "inactive">("all");

  useEffect(() => {
    void loadUsers();
  }, []);

  useEffect(() => {
    function handleUsersChanged() {
      void loadUsers();
    }

    window.addEventListener("users:changed", handleUsersChanged);
    return () => window.removeEventListener("users:changed", handleUsersChanged);
  }, []);

  async function loadUsers() {
    setLoading(true);
    setError(null);

    try {
      const response = await fetch("/api/users", { cache: "no-store" });
      const payload = (await response.json()) as { users?: UserRow[]; error?: string };

      if (!response.ok) {
        setError(payload.error ?? "Unable to load users.");
        return;
      }

      setUsers(payload.users ?? []);
    } catch {
      setError("Unable to reach the server.");
    } finally {
      setLoading(false);
    }
  }

  async function updateUser(
    userId: string,
    updates: Partial<Pick<UserRow, "is_active" | "full_name" | "email" | "role">>
  ) {
    setSavingUserId(userId);
    setError(null);

    try {
      const response = await fetch("/api/users", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ user_id: userId, ...updates }),
      });

      const payload = (await response.json()) as { error?: string };

      if (!response.ok) {
        const message = payload.error ?? "Unable to update user.";
        setError(message);
        toast({ kind: "error", title: "Update failed", message });
        return false;
      }

      invalidateClientCache("users:lookup");
      toast({ kind: "success", title: "User updated" });
      await loadUsers();
      return true;
    } catch {
      const message = "Unable to reach the server.";
      setError(message);
      toast({ kind: "error", title: "Update failed", message });
      return false;
    } finally {
      setSavingUserId(null);
    }
  }

  async function deleteUser(userId: string) {
    const confirmed = await confirm({
      title: "Delete user",
      message: "This will permanently remove the user and their linked data.",
      confirmLabel: "Delete",
      tone: "danger",
    });
    if (!confirmed) {
      return;
    }

    setDeletingUserId(userId);
    setError(null);

    try {
      const response = await fetch("/api/users", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ user_id: userId }),
      });

      const payload = (await response.json()) as { error?: string };

      if (!response.ok) {
        const message = payload.error ?? "Unable to delete user.";
        setError(message);
        toast({ kind: "error", title: "Delete failed", message });
        return;
      }

      invalidateClientCache("users:lookup");
      toast({ kind: "success", title: "User deleted" });
      await loadUsers();
    } catch {
      const message = "Unable to reach the server.";
      setError(message);
      toast({ kind: "error", title: "Delete failed", message });
    } finally {
      setDeletingUserId(null);
    }
  }

  function beginEdit(user: UserRow) {
    setEditingUserId(user.id);
    setNameDraft(user.full_name ?? "");
    setEmailDraft(user.email ?? "");
    setStatusDraft(user.is_active === false ? "inactive" : "active");
    setRoleDraft(user.role ?? "user");
    setIsEditOpen(true);
  }

  async function saveEdit(userId: string) {
    const user = users.find((item) => item.id === userId);
    const updates: Partial<Pick<UserRow, "is_active" | "full_name" | "email" | "role">> = {
      full_name: nameDraft.trim(),
    };

    if (!user?.is_super_admin) {
      updates.email = emailDraft.trim();
      updates.is_active = statusDraft === "active";
      updates.role = roleDraft;
    }

    const updated = await updateUser(userId, updates);
    if (updated) {
      closeEdit();
    }
  }

  function closeEdit() {
    setIsEditOpen(false);
    setEditingUserId(null);
    setNameDraft("");
    setEmailDraft("");
    setStatusDraft("active");
    setRoleDraft("user");
  }

  const filteredUsers = useMemo(() => {
    return users.filter((user) => {
      const matchesSearch = [user.full_name, user.email]
        .filter(Boolean)
        .some((value) => value!.toLowerCase().includes(search.toLowerCase()));
      const statusValue = user.is_active === false ? "inactive" : "active";
      const matchesStatus = statusFilter === "all" || statusValue === statusFilter;
      return matchesSearch && matchesStatus;
    });
  }, [search, statusFilter, users]);

  const stats = useMemo(() => {
    const total = users.length;
    const active = users.filter((user) => user.is_active !== false).length;
    const inactive = users.filter((user) => user.is_active === false).length;
    return { total, active, inactive };
  }, [users]);

  const editingUser = users.find((user) => user.id === editingUserId);
  const editingSuperAdmin = Boolean(editingUser?.is_super_admin);

  return (
    <div className="grid gap-6">
      <section className="grid gap-4 md:grid-cols-3">
        <StatCard label="Total users" value={String(stats.total)} />
        <StatCard label="Active users" value={String(stats.active)} />
        <StatCard label="Inactive users" value={String(stats.inactive)} />
      </section>

      <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h3 className="text-base font-semibold text-slate-900">Users</h3>
              <p className="mt-1 text-sm text-slate-600">Search, update names, and manage status.</p>
            </div>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => void loadUsers()}
                className="inline-flex h-9 items-center justify-center rounded-md border border-slate-200 px-3 text-sm font-medium text-slate-700 transition hover:bg-slate-50"
              >
                Refresh
              </button>
            </div>
          </div>

          <div className="grid gap-3 sm:grid-cols-[1fr_200px]">
            <input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Search users"
              className={inputClass}
            />
            <select
              value={statusFilter}
              onChange={(event) => setStatusFilter(event.target.value as "all" | "active" | "inactive")}
              className={selectClass}
            >
              <option value="all">All status</option>
              <option value="active">Active</option>
              <option value="inactive">Inactive</option>
            </select>
          </div>

          <div className="mt-4 overflow-x-auto">
            <table className="min-w-full divide-y divide-slate-200">
              <thead className="bg-slate-50 text-left text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">
                <tr>
                  <Th>Username</Th>
                  <Th>Email</Th>
                  <Th>Role</Th>
                  <Th>Status</Th>
                  <Th>Actions</Th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 bg-white">
                {loading ? (
                  <tr>
                    <td colSpan={5} className="px-6 py-10 text-center text-sm text-slate-500">
                      Loading users...
                    </td>
                  </tr>
                ) : filteredUsers.length ? (
                  filteredUsers.map((user) => (
                    <tr key={user.id}>
                      <Td>
                        <div className="flex flex-col gap-1">
                          <span>{user.full_name || "Unnamed user"}</span>
                          {user.is_super_admin ? <span className="text-xs font-medium text-slate-500">Super admin</span> : null}
                        </div>
                      </Td>
                      <Td>{user.email}</Td>
                      <Td>
                        <span className="capitalize">{user.role ?? "user"}</span>
                      </Td>
                      <Td>
                        <button
                          type="button"
                          onClick={() => void updateUser(user.id, { is_active: !user.is_active })}
                          className={`inline-flex rounded-full px-3 py-1 text-xs font-semibold ring-1 transition ${
                            user.is_active ? "bg-emerald-50 text-emerald-700 ring-emerald-200" : "bg-slate-100 text-slate-600 ring-slate-200"
                          }`}
                          disabled={savingUserId === user.id || user.is_super_admin}
                        >
                          {user.is_active ? "Active" : "Inactive"}
                        </button>
                      </Td>
                      <Td>
                        <div className="flex items-center gap-3 text-xs">
                          <button
                            type="button"
                            onClick={() => beginEdit(user)}
                            className="font-medium text-slate-600"
                          >
                            Edit
                          </button>
                          <button
                            type="button"
                            onClick={() => void deleteUser(user.id)}
                            className={user.is_super_admin ? "font-medium text-slate-400" : "font-medium text-rose-600"}
                            disabled={deletingUserId === user.id || user.is_super_admin}
                            title={user.is_super_admin ? "Super admin cannot be deleted" : undefined}
                          >
                            {deletingUserId === user.id ? "Deleting..." : "Delete"}
                          </button>
                          <span className="text-slate-500">{savingUserId === user.id ? "Saving..." : ""}</span>
                        </div>
                      </Td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan={5} className="px-6 py-10 text-center text-sm text-slate-500">
                      No users found.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        {error ? <p className="mt-4 rounded-lg bg-rose-50 px-3 py-2 text-sm text-rose-700">{error}</p> : null}
      </section>
      {isEditOpen ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 px-4">
          <div className="w-full max-w-md rounded-2xl bg-white p-5 shadow-lg">
            <div className="flex items-start justify-between">
              <div>
                <h3 className="text-base font-semibold text-slate-900">Edit user</h3>
                <p className="mt-1 text-sm text-slate-600">Update the name, email, and status.</p>
              </div>
              <button type="button" onClick={closeEdit} className="text-sm text-slate-500">
                Close
              </button>
            </div>
            <div className="mt-4 space-y-3">
              <label className="block space-y-2 text-sm font-medium text-slate-700">
                <span>Username</span>
                <input
                  value={nameDraft}
                  onChange={(event) => setNameDraft(event.target.value)}
                  className={inputClass}
                  placeholder="User name"
                />
              </label>
              <label className="block space-y-2 text-sm font-medium text-slate-700">
                <span>Email</span>
                <input
                  type="email"
                  value={emailDraft}
                  onChange={(event) => setEmailDraft(event.target.value)}
                  className={inputClass}
                  placeholder="name@company.com"
                  disabled={editingSuperAdmin}
                />
              </label>
              <label className="block space-y-2 text-sm font-medium text-slate-700">
                <span>Status</span>
                <select
                  value={statusDraft}
                  onChange={(event) => setStatusDraft(event.target.value as "active" | "inactive")}
                  className={selectClass}
                  disabled={editingSuperAdmin}
                >
                  <option value="active">Active</option>
                  <option value="inactive">Inactive</option>
                </select>
              </label>
              <label className="block space-y-2 text-sm font-medium text-slate-700">
                <span>Role</span>
                <select
                  value={roleDraft}
                  onChange={(event) => setRoleDraft(event.target.value as "admin" | "user")}
                  className={selectClass}
                  disabled={editingSuperAdmin}
                >
                  <option value="user">User</option>
                  <option value="admin">Admin</option>
                </select>
              </label>
              <div className="flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={closeEdit}
                  className="inline-flex h-9 items-center justify-center rounded-md border border-slate-200 px-3 text-sm font-medium text-slate-700"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={() => editingUserId && void saveEdit(editingUserId)}
                  className="inline-flex h-9 items-center justify-center rounded-md bg-slate-900 px-4 text-sm font-medium text-white"
                >
                  Save changes
                </button>
              </div>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
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
