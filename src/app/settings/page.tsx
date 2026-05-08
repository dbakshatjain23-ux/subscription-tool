import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { AppShell } from "@/components/app-shell";
import { RenewalSettingsPanel } from "@/components/renewal-settings-panel";
import { getSessionCookieName, getSessionUserIdFromCookieValue, verifySessionCookieValue } from "@/lib/auth";
import { verifyAdminPermission } from "@/lib/permissions";

export default async function SettingsPage() {
  const cookieStore = await cookies();
  const session = cookieStore.get(getSessionCookieName())?.value;

  if (!verifySessionCookieValue(session)) {
    redirect("/login");
  }

  const userId = getSessionUserIdFromCookieValue(session);
  if (!userId) {
    redirect("/login");
  }

  const isAdmin = (await verifyAdminPermission(userId)).ok;

  return (
    <AppShell
      title="Settings"
      description="Configure billing preferences, alerts, and operational defaults."
      isAdmin={isAdmin}
    >
      <section className="grid gap-4 lg:grid-cols-2">
        <RenewalSettingsPanel isAdmin={isAdmin} />
        <div className="rounded-lg border border-slate-200 bg-white p-6">
          <h3 className="text-sm font-semibold text-slate-900">Renewal alerts</h3>
          <p className="mt-2 text-sm text-slate-500">Alert workflows will be configurable here.</p>
          <button type="button" disabled className="mt-4 h-9 rounded-md bg-slate-100 px-3 text-sm text-slate-400">
            Configure alerts
          </button>
        </div>
      </section>
    </AppShell>
  );
}
