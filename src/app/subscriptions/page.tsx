import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { AppShell } from "@/components/app-shell";
import { SubscriptionCreateModalButton } from "@/components/subscription-create-modal-button";
import { SubscriptionTable } from "@/components/subscription-table";
import { getSessionCookieName, getSessionUserIdFromCookieValue, verifySessionCookieValue } from "@/lib/auth";
import { readSubscriptionsForUser } from "@/lib/data";
import { countRenewingSoon, sortSubscriptionsByRenewalDate } from "@/lib/subscription-helpers";
import { verifyAdminPermission } from "@/lib/permissions";

export default async function SubscriptionsPage() {
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
  const subscriptions = sortSubscriptionsByRenewalDate(await readSubscriptionsForUser(userId, isAdmin));

  return (
    <AppShell
      title="Subscriptions"
      description="Browse all subscription records, filter by team, and review renewal risk in one place."
      headerActions={<SubscriptionCreateModalButton />}
      isAdmin={isAdmin}
    >
      <section className="grid gap-4 sm:grid-cols-3">
        <MetricCard label="Total subscriptions" value={String(subscriptions.length)} />
        <MetricCard label="Active subscriptions" value={String(subscriptions.filter((item) => item.status === "active").length)} />
        <MetricCard label="Renewing soon" value={String(countRenewingSoon(subscriptions))} />
      </section>

      <div className="mt-6">
        <SubscriptionTable subscriptions={subscriptions} />
      </div>
    </AppShell>
  );
}

function MetricCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
      <p className="text-sm font-medium text-slate-500">{label}</p>
      <p className="mt-3 text-3xl font-semibold tracking-tight text-slate-950">{value}</p>
    </div>
  );
}
