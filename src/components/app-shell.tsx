"use client";

import Link from "next/link";
import type { Route } from "next";
import { usePathname } from "next/navigation";
import { useEffect, useMemo, useState, type ReactNode } from "react";
import { LogoutButton } from "@/components/logout-button";
import { fetchWithClientCache, getClientCache, setClientCache } from "@/lib/client-cache";

interface NavigationItem {
  href: string;
  label: string;
  icon: "dashboard" | "subscriptions" | "users" | "teams" | "insights" | "settings";
  adminOnly?: boolean;
}

interface AppShellProps {
  title: string;
  description: string;
  children: ReactNode;
  isAdmin?: boolean;
  action?: {
    label: string;
    href: Route;
  };
  headerActions?: ReactNode;
}

type CurrentUser = {
  id: string;
  full_name: string | null;
  email: string;
  role?: "admin" | "user";
  is_active?: boolean | null;
};

type UserLookupPayload = {
  currentUser?: CurrentUser;
};

const navigationItems: NavigationItem[] = [
  { href: "/dashboard", label: "Dashboard", icon: "dashboard" },
  { href: "/subscriptions", label: "Subscriptions", icon: "subscriptions" },
  { href: "/teams", label: "Teams", icon: "teams", adminOnly: true },
  { href: "/users", label: "Users", icon: "users", adminOnly: true },
  { href: "/insights", label: "Insights", icon: "insights" },
  { href: "/settings", label: "Settings", icon: "settings" },
];

export function AppShell({ title, description, children, isAdmin = false, action, headerActions }: AppShellProps) {
  const pathname = usePathname();
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const visibleNavigation = navigationItems.filter((item) => !item.adminOnly || isAdmin);

  useEffect(() => {
    const timeoutId = window.setTimeout(() => {
      setSidebarCollapsed(window.localStorage.getItem("smt:sidebar-collapsed") === "true");
    }, 0);

    return () => window.clearTimeout(timeoutId);
  }, []);

  function toggleSidebar() {
    setSidebarCollapsed((current) => {
      const next = !current;
      window.localStorage.setItem("smt:sidebar-collapsed", String(next));
      return next;
    });
  }

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900">
      <div className="mx-auto flex min-h-screen max-w-[1600px]">
        <aside
          className={`sticky top-0 hidden h-screen shrink-0 overflow-y-auto border-r border-slate-200 bg-white transition-[width] duration-200 lg:flex lg:flex-col ${
            sidebarCollapsed ? "w-20" : "w-72"
          }`}
        >
          <div className={`border-b border-slate-200 py-5 ${sidebarCollapsed ? "px-3" : "px-5"}`}>
            <div className={`flex items-center ${sidebarCollapsed ? "justify-center" : "justify-between gap-3"}`}>
              <div className="flex min-w-0 items-center gap-3">
                <BrandIcon />
                {sidebarCollapsed ? null : (
                  <p className="truncate text-sm font-semibold uppercase tracking-[0.24em] text-slate-500">Subscription hub</p>
                )}
              </div>
              <button
                type="button"
                onClick={toggleSidebar}
                aria-label={sidebarCollapsed ? "Expand sidebar" : "Collapse sidebar"}
                title={sidebarCollapsed ? "Expand sidebar" : "Collapse sidebar"}
                className="hidden h-9 w-9 shrink-0 items-center justify-center rounded-md border border-slate-200 text-slate-500 transition hover:bg-slate-50 hover:text-slate-900 lg:inline-flex"
              >
                <CollapseIcon collapsed={sidebarCollapsed} />
              </button>
            </div>
          </div>

          <div className={`border-b border-slate-200 py-4 ${sidebarCollapsed ? "px-3" : "px-5"}`}>
            <ProfileDropdown compact={sidebarCollapsed} />
          </div>

          <nav className="flex-1 space-y-1 px-3 py-4">
            {visibleNavigation.map((item) => {
              const active = pathname === item.href || pathname?.startsWith(`${item.href}/`);

              return (
                <Link
                  key={item.href}
                  href={item.href as Route}
                  title={sidebarCollapsed ? item.label : undefined}
                  className={`group flex items-center justify-between rounded-lg px-3 py-2.5 text-base transition ${
                    active
                      ? "bg-slate-900 text-white"
                      : "text-slate-700 hover:bg-slate-100 hover:text-slate-900"
                  }`}
                >
                  <span className={`flex min-w-0 items-center gap-3 ${sidebarCollapsed ? "justify-center" : ""}`}>
                    <NavigationIcon name={item.icon} />
                    {sidebarCollapsed ? null : <span className="truncate font-medium">{item.label}</span>}
                  </span>
                </Link>
              );
            })}
          </nav>

          <div className={`border-t border-slate-200 py-4 ${sidebarCollapsed ? "px-5" : "px-5"}`}>
            <LogoutButton compact={sidebarCollapsed} />
          </div>
        </aside>

        <div className="flex min-h-screen flex-1 flex-col lg:min-w-0">
          <div className="sticky top-0 z-30 border-b border-slate-200 bg-white lg:hidden">
            <div className="flex items-center justify-between gap-3 px-4 py-4 sm:px-6">
              <div>
                <div className="flex items-center gap-3">
                  <BrandIcon />
                  <p className="text-sm font-semibold uppercase tracking-[0.24em] text-slate-500">Subscription hub</p>
                </div>
              </div>
              <ProfileDropdown compact />
            </div>
            <div className="flex gap-2 overflow-x-auto px-4 pb-4 sm:px-6">
              {visibleNavigation.map((item) => {
                const active = pathname === item.href || pathname?.startsWith(`${item.href}/`);

                return (
                  <Link
                    key={item.href}
                    href={item.href as Route}
                    className={`whitespace-nowrap rounded-full px-4 py-2 text-base font-medium transition ${
                      active ? "bg-slate-900 text-white" : "bg-slate-100 text-slate-700 hover:bg-slate-200"
                    }`}
                  >
                    <span className="flex items-center gap-2">
                      <NavigationIcon name={item.icon} />
                      {item.label}
                    </span>
                  </Link>
                );
              })}
            </div>
            <div className="border-t border-slate-200 px-4 py-4 sm:px-6">
              <LogoutButton />
            </div>
          </div>

          <main className="flex-1 px-4 py-6 sm:px-6 lg:px-8">
            <div className="flex flex-col gap-4 border-b border-slate-200 pb-4 md:flex-row md:items-center md:justify-between">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">{title}</p>
                <p className="mt-2 text-sm text-slate-600">{description}</p>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                {headerActions}
                {action ? (
                  <Link
                    href={action.href}
                    className="inline-flex h-10 items-center justify-center rounded-md bg-slate-900 px-4 text-sm font-medium text-white transition hover:bg-slate-800"
                  >
                    {action.label}
                  </Link>
                ) : null}
              </div>
            </div>

            <div className="mt-6">{children}</div>
          </main>
        </div>
      </div>
    </div>
  );
}

function BrandIcon() {
  return (
    <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-slate-900 text-white shadow-sm">
      <svg width="19" height="19" viewBox="0 0 24 24" fill="none" aria-hidden="true">
        <path d="M7 7.5h10" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
        <path d="M7 12h7" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
        <path d="M7 16.5h4" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
        <rect x="4" y="3.5" width="16" height="17" rx="3" stroke="currentColor" strokeWidth="1.8" />
      </svg>
    </span>
  );
}

function NavigationIcon({ name }: { name: NavigationItem["icon"] }) {
  const common = { width: 18, height: 18, viewBox: "0 0 24 24", fill: "none", "aria-hidden": true } as const;

  if (name === "dashboard") {
    return (
      <svg {...common}>
        <path d="M4 13h7V4H4v9zM13 20h7V4h-7v16zM4 20h7v-5H4v5z" stroke="currentColor" strokeWidth="1.7" strokeLinejoin="round" />
      </svg>
    );
  }

  if (name === "subscriptions") {
    return (
      <svg {...common}>
        <rect x="4" y="5" width="16" height="14" rx="2.5" stroke="currentColor" strokeWidth="1.7" />
        <path d="M7.5 9h9M7.5 13h5" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" />
      </svg>
    );
  }

  if (name === "users") {
    return (
      <svg {...common}>
        <path d="M15.5 19v-1.2a3.3 3.3 0 0 0-3.3-3.3H7.3A3.3 3.3 0 0 0 4 17.8V19" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" />
        <circle cx="9.8" cy="8" r="3.2" stroke="currentColor" strokeWidth="1.7" />
        <path d="M17 11.5a2.8 2.8 0 0 0 0-5.4M20 19v-1a3 3 0 0 0-2.2-2.9" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" />
      </svg>
    );
  }

  if (name === "teams") {
    return (
      <svg {...common}>
        <path d="M7.5 12.5a3 3 0 1 0 0-6 3 3 0 0 0 0 6zM16.5 12.5a3 3 0 1 0 0-6 3 3 0 0 0 0 6z" stroke="currentColor" strokeWidth="1.7" />
        <path d="M3.8 19a3.8 3.8 0 0 1 3.7-3h0a3.8 3.8 0 0 1 3.7 3M12.8 19a3.8 3.8 0 0 1 3.7-3h0a3.8 3.8 0 0 1 3.7 3" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" />
      </svg>
    );
  }

  if (name === "insights") {
    return (
      <svg {...common}>
        <path d="M5 19V5" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" />
        <path d="M5 19h14" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" />
        <path d="M8.5 15v-4M12 15V8M15.5 15v-6" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" />
      </svg>
    );
  }

  return (
    <svg {...common}>
      <path d="M12 15.2a3.2 3.2 0 1 0 0-6.4 3.2 3.2 0 0 0 0 6.4z" stroke="currentColor" strokeWidth="1.7" />
      <path d="M19 13.2v-2.4l-2-.7a5.7 5.7 0 0 0-.6-1.4l.9-1.9-1.7-1.7-1.9.9a5.7 5.7 0 0 0-1.4-.6l-.7-2H9.2l-.7 2a5.7 5.7 0 0 0-1.4.6l-1.9-.9-1.7 1.7.9 1.9a5.7 5.7 0 0 0-.6 1.4l-2 .7v2.4l2 .7a5.7 5.7 0 0 0 .6 1.4l-.9 1.9 1.7 1.7 1.9-.9a5.7 5.7 0 0 0 1.4.6l.7 2h2.4l.7-2a5.7 5.7 0 0 0 1.4-.6l1.9.9 1.7-1.7-.9-1.9a5.7 5.7 0 0 0 .6-1.4l2-.7z" stroke="currentColor" strokeWidth="1.7" strokeLinejoin="round" />
    </svg>
  );
}

function CollapseIcon({ collapsed }: { collapsed: boolean }) {
  return (
    <svg width="17" height="17" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path d={collapsed ? "M9 6l6 6-6 6" : "M15 6l-6 6 6 6"} stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function ProfileDropdown({ compact = false }: { compact?: boolean }) {
  const [currentUser, setCurrentUser] = useState<CurrentUser | null>(null);
  const [panel, setPanel] = useState<"profile" | "security" | null>(null);

  useEffect(() => {
    let active = true;

    async function loadCurrentUser() {
      try {
        const cachedUser = getClientCache<UserLookupPayload>("users:lookup")?.currentUser ?? null;
        if (active && cachedUser) {
          setCurrentUser(cachedUser);
        }

        const payload = await fetchWithClientCache<UserLookupPayload>(
          "users:lookup",
          async () => {
            const response = await fetch("/api/users/lookup", { cache: "no-store" });
            if (!response.ok) {
              throw new Error("Unable to load user profile.");
            }
            return (await response.json()) as UserLookupPayload;
          },
          120_000
        );

        if (active) {
          setCurrentUser(payload.currentUser ?? null);
          setClientCache("users:lookup", payload, 120_000);
        }
      } catch {
        if (active) {
          setCurrentUser(null);
        }
      }
    }

    void loadCurrentUser();

    return () => {
      active = false;
    };
  }, []);

  const displayName = currentUser?.full_name?.trim() || "Current User";
  const email = currentUser?.email || "user@company.com";
  const initials = useMemo(() => {
    const parts = displayName.split(/\s+/).filter(Boolean);
    const letters = parts.length > 1 ? `${parts[0][0]}${parts[1][0]}` : displayName.slice(0, 2);
    return letters.toUpperCase();
  }, [displayName]);

  return (
    <>
      <details className="group relative">
        <summary
          className={`flex cursor-pointer list-none items-center gap-3 rounded-md border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700 hover:border-slate-300 ${
            compact ? "px-2" : "w-full"
          }`}
        >
          <span className="flex h-8 w-8 items-center justify-center rounded-full bg-slate-900 text-xs font-semibold text-white">
            {initials}
          </span>
          {compact ? null : (
            <span className="min-w-0 flex-1 text-left">
              <span className="block truncate font-medium text-slate-900">{displayName}</span>
              <span className="block truncate text-xs text-slate-500">{email}</span>
            </span>
          )}
          <span className="text-xs text-slate-400">v</span>
        </summary>
        <div className="absolute left-0 top-full z-20 mt-2 w-56 rounded-md border border-slate-200 bg-white p-2 text-sm text-slate-700 shadow-lg">
          <p className="px-2 py-1 text-xs font-semibold uppercase tracking-[0.2em] text-slate-400">Account</p>
          <button type="button" onClick={() => setPanel("profile")} className="w-full rounded px-2 py-2 text-left hover:bg-slate-100">
            View profile
          </button>
          <button type="button" onClick={() => setPanel("security")} className="w-full rounded px-2 py-2 text-left hover:bg-slate-100">
            Security settings
          </button>
          <div className="mt-2 border-t border-slate-200 pt-2">
            <LogoutButton />
          </div>
        </div>
      </details>

      {panel ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 px-4">
          <div className="w-full max-w-md rounded-lg bg-white p-5 shadow-lg">
            <div className="flex items-start justify-between gap-4">
              <div>
                <h3 className="text-base font-semibold text-slate-900">
                  {panel === "profile" ? "Profile" : "Security settings"}
                </h3>
                <p className="mt-1 text-sm text-slate-500">
                  {panel === "profile" ? "Your signed-in account details." : "Manage access for this session."}
                </p>
              </div>
              <button type="button" onClick={() => setPanel(null)} className="text-sm font-medium text-slate-500 hover:text-slate-900">
                Close
              </button>
            </div>

            {panel === "profile" ? (
              <div className="mt-5 space-y-3 text-sm">
                <ProfileRow label="Name" value={displayName} />
                <ProfileRow label="Email" value={email} />
                <ProfileRow label="Role" value={currentUser?.role ?? "user"} />
                <ProfileRow label="Status" value={currentUser?.is_active === false ? "Inactive" : "Active"} />
              </div>
            ) : (
              <div className="mt-5 space-y-4 text-sm text-slate-600">
                <p>Your session is protected by a signed, HTTP-only cookie and verified against Supabase.</p>
                <div className="rounded-md border border-slate-200 bg-slate-50 p-3">
                  <p className="font-medium text-slate-900">Password changes</p>
                  <p className="mt-1">Use Supabase Auth or the company identity workflow to update passwords and MFA.</p>
                </div>
                <LogoutButton />
              </div>
            )}
          </div>
        </div>
      ) : null}
    </>
  );
}

function ProfileRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between gap-4 border-b border-slate-100 pb-3 last:border-0 last:pb-0">
      <span className="text-slate-500">{label}</span>
      <span className="text-right font-medium capitalize text-slate-900">{value}</span>
    </div>
  );
}
