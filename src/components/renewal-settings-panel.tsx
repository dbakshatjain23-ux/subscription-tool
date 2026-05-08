"use client";

import { useEffect, useState } from "react";
import { useToast } from "@/components/toast-provider";

type RenewalGracePeriod = {
  mode: "days" | "never";
  days: number;
  value: string;
};

export function RenewalSettingsPanel({ isAdmin }: { isAdmin: boolean }) {
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [mode, setMode] = useState<"days" | "never">("days");
  const [days, setDays] = useState("7");
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;

    async function loadSettings() {
      if (!isAdmin) {
        setLoading(false);
        return;
      }

      setLoading(true);
      setError(null);

      try {
        const response = await fetch("/api/settings", { cache: "no-store" });
        const payload = (await response.json()) as { renewalGracePeriod?: RenewalGracePeriod; error?: string };

        if (!response.ok) {
          throw new Error(payload.error ?? "Unable to load settings.");
        }

        if (!active) {
          return;
        }

        const setting = payload.renewalGracePeriod;
        setMode(setting?.mode ?? "days");
        setDays(String(setting?.days ?? 7));
      } catch (err) {
        if (!active) {
          return;
        }
        setError(err instanceof Error ? err.message : "Unable to load settings.");
      } finally {
        if (active) {
          setLoading(false);
        }
      }
    }

    void loadSettings();

    return () => {
      active = false;
    };
  }, [isAdmin]);

  async function saveSettings() {
    const numericDays = Math.max(0, Number.parseInt(days, 10));
    const renewalGracePeriod = mode === "never" ? "never" : String(Number.isFinite(numericDays) ? numericDays : 7);

    setSaving(true);
    setError(null);

    try {
      const response = await fetch("/api/settings", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ renewalGracePeriod }),
      });
      const payload = (await response.json()) as { renewalGracePeriod?: RenewalGracePeriod; error?: string };

      if (!response.ok) {
        throw new Error(payload.error ?? "Unable to save settings.");
      }

      const setting = payload.renewalGracePeriod;
      setMode(setting?.mode ?? mode);
      setDays(String(setting?.days ?? numericDays));
      toast({ kind: "success", title: "Settings saved" });
    } catch (err) {
      const message = err instanceof Error ? err.message : "Unable to save settings.";
      setError(message);
      toast({ kind: "error", title: "Save failed", message });
    } finally {
      setSaving(false);
    }
  }

  if (!isAdmin) {
    return (
      <div className="rounded-lg border border-slate-200 bg-white p-6">
        <h3 className="text-sm font-semibold text-slate-900">Renewal review window</h3>
        <p className="mt-2 text-sm text-slate-500">Only admins can configure renewal payment review settings.</p>
      </div>
    );
  }

  return (
    <div className="rounded-lg border border-slate-200 bg-white p-6">
      <h3 className="text-sm font-semibold text-slate-900">Renewal review window</h3>
      <p className="mt-2 text-sm text-slate-500">Control how long payment status can be changed after a renewal date.</p>

      <div className="mt-5 grid gap-4">
        <label className="space-y-2 text-sm font-medium text-slate-700">
          <span>Grace period mode</span>
          <select
            value={mode}
            onChange={(event) => setMode(event.target.value as "days" | "never")}
            disabled={loading || saving}
            className={inputClass}
          >
            <option value="days">Fixed number of days</option>
            <option value="never">Never expire</option>
          </select>
        </label>

        {mode === "days" ? (
          <label className="space-y-2 text-sm font-medium text-slate-700">
            <span>Grace period days</span>
            <input
              value={days}
              onChange={(event) => setDays(event.target.value)}
              type="number"
              min="0"
              step="1"
              disabled={loading || saving}
              className={inputClass}
            />
          </label>
        ) : null}

        {error ? <p className="rounded-md bg-rose-50 px-3 py-2 text-sm text-rose-700">{error}</p> : null}

        <button
          type="button"
          onClick={() => void saveSettings()}
          disabled={loading || saving}
          className="inline-flex h-10 w-fit items-center justify-center rounded-md bg-slate-900 px-4 text-sm font-medium text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {saving ? "Saving..." : "Save settings"}
        </button>
      </div>
    </div>
  );
}

const inputClass =
  "h-11 w-full rounded-xl border border-slate-200 bg-white px-4 text-sm text-slate-950 outline-none transition focus:border-slate-400 focus:ring-2 focus:ring-slate-200 disabled:bg-slate-50 disabled:text-slate-500";
