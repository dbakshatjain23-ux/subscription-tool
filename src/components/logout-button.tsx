"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { useToast } from "@/components/toast-provider";
import { invalidateClientCache } from "@/lib/client-cache";

export function LogoutButton({ compact = false }: { compact?: boolean }) {
  const router = useRouter();
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);

  async function handleLogout() {
    setLoading(true);

    try {
      await fetch("/api/auth/logout", {
        method: "POST",
      });
      invalidateClientCache("users:lookup");
      toast({ kind: "success", title: "Signed out" });
      router.replace("/login");
      router.refresh();
    } catch {
      toast({ kind: "error", title: "Sign out failed", message: "Unable to reach the server." });
    } finally {
      setLoading(false);
    }
  }

  return (
    <button
      type="button"
      onClick={handleLogout}
      disabled={loading}
      aria-label="Sign out"
      title="Sign out"
      className={`inline-flex h-9 items-center justify-center rounded-md border border-slate-200 text-sm font-medium text-slate-700 transition hover:border-slate-300 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60 ${
        compact ? "w-9 px-0" : "w-full px-3"
      }`}
    >
      {compact ? <LogoutIcon /> : loading ? "Signing out..." : "Sign out"}
    </button>
  );
}

function LogoutIcon() {
  return (
    <svg width="17" height="17" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path d="M10 6H6.5A2.5 2.5 0 0 0 4 8.5v7A2.5 2.5 0 0 0 6.5 18H10" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
      <path d="M14 8l4 4-4 4" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M18 12H9" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
    </svg>
  );
}
