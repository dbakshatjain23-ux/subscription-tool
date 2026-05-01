"use client";

import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";
import { useToast } from "@/components/toast-provider";
import { invalidateClientCache } from "@/lib/client-cache";

const emptyForm = {
  username: "",
  email: "",
  password: "",
};

export function UserCreateForm({
  onCancel,
  onSuccess,
}: {
  onCancel?: () => void;
  onSuccess?: () => void;
}) {
  const router = useRouter();
  const { toast } = useToast();
  const [form, setForm] = useState(emptyForm);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving(true);
    setError(null);

    try {
      const response = await fetch("/api/users", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });

      const payload = (await response.json()) as { error?: string };

      if (!response.ok) {
        const message = payload.error ?? "Unable to create user.";
        setError(message);
        toast({ kind: "error", title: "Create user failed", message });
        return;
      }

      setForm(emptyForm);
      toast({ kind: "success", title: "User created" });
      invalidateClientCache("users:lookup");
      window.dispatchEvent(new CustomEvent("users:changed"));
      if (onSuccess) {
        onSuccess();
      } else {
        router.push("/users");
      }
      router.refresh();
    } catch {
      const message = "Unable to reach the server.";
      setError(message);
      toast({ kind: "error", title: "Create user failed", message });
    } finally {
      setSaving(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4" autoComplete="off">
      <Field label="Username">
        <input
          type="text"
          name="create-username"
          autoComplete="off"
          required
          value={form.username}
          onChange={(event) => setForm((current) => ({ ...current, username: event.target.value }))}
          className={inputClass}
          placeholder="Amit Sharma"
        />
      </Field>

      <Field label="Email">
        <input
          type="email"
          name="create-email"
          autoComplete="off"
          required
          value={form.email}
          onChange={(event) => setForm((current) => ({ ...current, email: event.target.value }))}
          className={inputClass}
          placeholder="name@company.com"
        />
      </Field>

      <Field label="Password">
        <input
          type="password"
          name="create-password"
          autoComplete="new-password"
          required
          value={form.password}
          onChange={(event) => setForm((current) => ({ ...current, password: event.target.value }))}
          className={inputClass}
          placeholder="Set a password"
        />
      </Field>

      {error ? <p className="rounded-lg bg-rose-50 px-3 py-2 text-sm text-rose-700">{error}</p> : null}

      <div className="flex items-center justify-end gap-2">
        {onCancel ? (
          <button
            type="button"
            onClick={onCancel}
            className="inline-flex h-10 items-center justify-center rounded-md border border-slate-200 px-4 text-sm font-medium text-slate-700 transition hover:bg-slate-50"
          >
            Cancel
          </button>
        ) : null}
        <button
          type="submit"
          disabled={saving}
          className="inline-flex h-10 items-center justify-center rounded-md bg-slate-900 px-4 text-sm font-medium text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {saving ? "Creating..." : "Create user"}
        </button>
      </div>
    </form>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block space-y-2 text-sm font-medium text-slate-700">
      <span>{label}</span>
      {children}
    </label>
  );
}

const inputClass =
  "h-10 w-full rounded-md border border-slate-200 bg-white px-3 text-sm text-slate-950 outline-none transition placeholder:text-slate-400 focus:border-slate-400 focus:ring-2 focus:ring-slate-200";
