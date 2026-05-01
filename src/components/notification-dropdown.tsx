"use client";

import { useEffect, useState } from "react";

type NotificationItem = {
  id: string;
  title: string;
  message: string;
  createdAt: string;
};

export function NotificationDropdown() {
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;

    async function loadNotifications() {
      setLoading(true);
      setError(null);

      try {
        const response = await fetch("/api/notifications", { cache: "no-store" });
        const payload = (await response.json()) as { notifications?: NotificationItem[]; error?: string };

        if (!active) {
          return;
        }

        if (!response.ok) {
          setError(payload.error ?? "Unable to load notifications.");
          return;
        }

        setNotifications(payload.notifications ?? []);
      } catch {
        if (active) {
          setError("Unable to load notifications.");
        }
      } finally {
        if (active) {
          setLoading(false);
        }
      }
    }

    void loadNotifications();

    return () => {
      active = false;
    };
  }, []);

  return (
    <details className="relative">
      <summary className="flex h-10 w-10 cursor-pointer list-none items-center justify-center rounded-md border border-slate-200 bg-white text-slate-600 hover:border-slate-300 hover:bg-slate-50">
        <BellIcon />
      </summary>
      <div className="absolute right-0 top-full z-20 mt-2 w-80 rounded-md border border-slate-200 bg-white p-3 text-sm text-slate-700 shadow-lg">
        <div className="flex items-center justify-between gap-3">
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-400">Notifications</p>
          {notifications.length ? (
            <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs font-medium text-slate-600">
              {notifications.length}
            </span>
          ) : null}
        </div>
        <div className="mt-3 max-h-96 space-y-2 overflow-y-auto">
          {loading ? <div className="rounded-md bg-slate-50 px-3 py-2 text-xs text-slate-500">Loading...</div> : null}
          {error ? <div className="rounded-md bg-rose-50 px-3 py-2 text-xs text-rose-700">{error}</div> : null}
          {!loading && !error && notifications.length === 0 ? (
            <div className="rounded-md bg-slate-50 px-3 py-2 text-xs text-slate-500">No actions recorded yet.</div>
          ) : null}
          {notifications.map((item) => (
            <div key={item.id} className="rounded-md border border-slate-100 px-3 py-2">
              <p className="text-sm font-semibold text-slate-900">{item.title}</p>
              <p className="mt-1 text-xs leading-5 text-slate-600">{item.message}</p>
              <p className="mt-2 text-xs text-slate-400">{new Date(item.createdAt).toLocaleString("en-IN")}</p>
            </div>
          ))}
        </div>
      </div>
    </details>
  );
}

function BellIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path
        d="M6.4 9.2c0-3.1 2.5-5.6 5.6-5.6s5.6 2.5 5.6 5.6v4.7l1.6 1.6v.8H4.8v-.8l1.6-1.6V9.2z"
        stroke="currentColor"
        strokeWidth="1.5"
      />
      <path d="M9.7 19.5a2.3 2.3 0 0 0 4.6 0" stroke="currentColor" strokeWidth="1.5" />
    </svg>
  );
}
