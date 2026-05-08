import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import type { ReactNode } from "react";
import { AppShell } from "@/components/app-shell";
import { NotificationDropdown } from "@/components/notification-dropdown";
import { SubscriptionCreateModalButton } from "@/components/subscription-create-modal-button";
import { SubscriptionTable } from "@/components/subscription-table";
import { UserCreateModalButton } from "@/components/user-create-modal-button";
import { getSessionCookieName, getSessionUserIdFromCookieValue, verifySessionCookieValue } from "@/lib/auth";
import { billingCycleOptions } from "@/lib/billing-cycles";
import { readSubscriptionsForUser, readUsersSummary } from "@/lib/data";
import { countRenewingSoon, formatCurrency, sortSubscriptionsByRenewalDate, toAnnualCost, toMonthlyCost } from "@/lib/subscription-helpers";
import { verifyAdminPermission } from "@/lib/permissions";
import type { Subscription } from "@/lib/types";

export default async function DashboardPage() {
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
  const activeSubscriptions = subscriptions.filter((item) => item.status === "active");
  const renewingSoon = countRenewingSoon(subscriptions, 30);
  const totalMonthlySpend = activeSubscriptions.reduce((total, item) => total + toMonthlyCost(item), 0);
  const totalAnnualSpend = activeSubscriptions.reduce((total, item) => total + toAnnualCost(item), 0);
  const billingMix = buildBillingMix(activeSubscriptions);
  const spendByTeam = groupSpend(activeSubscriptions, (item) => item.team).slice(0, 3);
  const spendByOwner = groupSpend(activeSubscriptions, (item) => item.owner || "Organization").slice(0, 3);
  const spendByService = groupSpend(activeSubscriptions, (item) => item.name).slice(0, 3);
  const nextRenewals = activeSubscriptions
    .map((item) => ({
      ...item,
      renewalDateObj: new Date(item.renewalDate),
    }))
    .sort((a, b) => a.renewalDateObj.getTime() - b.renewalDateObj.getTime())
    .slice(0, 3);
  const usersSummary = await readUsersSummary();

  return (
    <AppShell
      title="Dashboard"
      description="Review active subscriptions, spot renewals coming up soon, and keep billing owned by the right team."
      isAdmin={isAdmin}
      headerActions={
        <div className="flex items-center gap-2">
          <SubscriptionCreateModalButton />
          {isAdmin ? (
            <>
              <UserCreateModalButton label="Add user" iconOnly />
              <NotificationDropdown />
            </>
          ) : null}
        </div>
      }
    >
      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <StatCard label="Total subscriptions" value={String(subscriptions.length)} />
        <StatCard label="Active subscriptions" value={String(activeSubscriptions.length)} />
        <StatCard label="Renewing in 30 days" value={String(renewingSoon)} />
        <StatCard label="Monthly spend" value={formatCurrency(totalMonthlySpend)} />
      </section>

      <section className={`mt-6 grid gap-4 ${isAdmin ? "lg:grid-cols-2" : "lg:grid-cols-3"}`}>
        {usersSummary ? (
          <InsightCard title="Users" description="Active access and admin coverage.">
            <div className="grid gap-3">
              <div className="flex items-center justify-between text-sm text-slate-700">
                <span className="font-medium text-slate-900">Total users</span>
                <span>{usersSummary.total}</span>
              </div>
              {isAdmin ? (
                <>
                  <div className="flex items-center justify-between text-sm text-slate-700">
                    <span className="font-medium text-slate-900">Active users</span>
                    <span>{usersSummary.active}</span>
                  </div>
                  <div className="flex items-center justify-between text-sm text-slate-700">
                    <span className="font-medium text-slate-900">Admins</span>
                    <span>{usersSummary.admins}</span>
                  </div>
                  <div className="flex items-center justify-between text-sm text-slate-700">
                    <span className="font-medium text-slate-900">Inactive users</span>
                    <span>{usersSummary.inactive}</span>
                  </div>
                </>
              ) : null}
            </div>
          </InsightCard>
        ) : null}

        {isAdmin ? (
          <InsightCard title="Spend by user" description="Monthly equivalent split by owner, including Organization.">
            {spendByOwner.length ? (
              <StackedBar data={spendByOwner} colors={["bg-slate-900", "bg-teal-600", "bg-fuchsia-600", "bg-orange-500", "bg-blue-600"]} />
            ) : (
              <p className="text-sm text-slate-500">No active spend tracked yet.</p>
            )}
          </InsightCard>
        ) : null}

        <InsightCard title="Spend by team" description="Top teams by monthly equivalent spend.">
          {spendByTeam.length ? (
            <StackedBar data={spendByTeam} colors={["bg-indigo-600", "bg-sky-500", "bg-amber-500", "bg-rose-500", "bg-emerald-500"]} />
          ) : (
            <p className="text-sm text-slate-500">No active spend tracked yet.</p>
          )}
        </InsightCard>

        <InsightCard title="Spend by service" description="Top services by monthly equivalent spend.">
          {spendByService.length ? (
            <DonutBreakdown data={spendByService} />
          ) : (
            <p className="text-sm text-slate-500">No active spend tracked yet.</p>
          )}
        </InsightCard>
      </section>

      <section className="mt-6 grid items-start gap-4 lg:grid-cols-[2fr_1fr]">
        <InsightCard title="Renewal calendar" description="Next three upcoming renewals.">
          {nextRenewals.length ? (
            <div className="grid gap-3">
              {nextRenewals.map((item) => (
                <div key={item.id} className="flex items-center gap-4 rounded-lg border border-slate-200 px-3 py-3">
                  <div className="flex h-12 w-12 flex-col items-center justify-center rounded-md bg-slate-900 text-white">
                    <span className="text-xs uppercase tracking-[0.2em]">
                      {item.renewalDateObj.toLocaleDateString("en-IN", { month: "short" })}
                    </span>
                    <span className="text-lg font-semibold">
                      {item.renewalDateObj.toLocaleDateString("en-IN", { day: "2-digit" })}
                    </span>
                  </div>
                  <div className="flex-1">
                    <p className="text-sm font-semibold text-slate-900">{item.name}</p>
                    <p className="text-xs text-slate-500">{item.team} · {item.owner}</p>
                  </div>
                  <div className="text-sm font-medium text-slate-700">{formatCurrency(toMonthlyCost(item))}</div>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-sm text-slate-500">No renewal data available.</p>
          )}
        </InsightCard>

        <InsightCard title="Billing mix" description="Active plans by billing cycle.">
          <BillingMixChart mix={billingMix} totalAnnualSpend={totalAnnualSpend} />
        </InsightCard>
      </section>

      <div className="mt-8">
        <SubscriptionTable subscriptions={subscriptions} canManageRenewals={isAdmin} />
      </div>
    </AppShell>
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

function InsightCard({
  title,
  description,
  footer,
  children,
}: {
  title: string;
  description: string;
  footer?: string;
  children: ReactNode;
}) {
  return (
    <div className="flex h-full flex-col rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
      <div className="mb-4">
        <p className="text-sm font-semibold text-slate-950">{title}</p>
        <p className="mt-1 text-sm text-slate-500">{description}</p>
      </div>
      <div className="flex-1">{children}</div>
      {footer ? <p className="mt-4 text-xs font-medium text-slate-500">{footer}</p> : null}
    </div>
  );
}

function groupSpend(subscriptions: Subscription[], getKey: (item: Subscription) => string) {
  const totals = new Map<string, number>();

  subscriptions.forEach((item) => {
    const key = getKey(item) || "Unassigned";
    totals.set(key, (totals.get(key) ?? 0) + toMonthlyCost(item));
  });

  return Array.from(totals, ([label, value]) => ({ label, value })).sort((a, b) => b.value - a.value);
}

function StackedBar({
  data,
  colors,
}: {
  data: Array<{ label: string; value: number }>;
  colors: string[];
}) {
  const total = data.reduce((sum, item) => sum + item.value, 0) || 1;

  return (
    <div className="space-y-4">
      <div className="flex h-3 overflow-hidden rounded-full bg-slate-100">
        {data.map((item, index) => (
          <span
            key={item.label}
            className={colors[index % colors.length]}
            style={{ width: `${(item.value / total) * 100}%` }}
          />
        ))}
      </div>
      <div className="grid gap-2">
        {data.map((item, index) => (
          <div key={item.label} className="flex items-center justify-between text-sm text-slate-700">
            <div className="flex items-center gap-2">
              <span className={`h-2 w-2 rounded-full ${colors[index % colors.length]}`} />
              <span className="font-medium text-slate-900">{item.label}</span>
            </div>
            <span>{formatCurrency(item.value)}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

function buildBillingMix(subscriptions: Subscription[]) {
  const total = subscriptions.length || 1;

  return billingCycleOptions.map((option) => {
    const count = subscriptions.filter((item) => item.billingCycle === option.value).length;
    return {
      ...option,
      count,
      percent: (count / total) * 100,
    };
  });
}

function BillingMixChart({ mix, totalAnnualSpend }: { mix: ReturnType<typeof buildBillingMix>; totalAnnualSpend: number }) {
  const totalPlans = mix.reduce((total, item) => total + item.count, 0);
  const colors = ["#0284c7", "#0f766e", "#7c3aed"];
  const segments = mix.reduce<{ start: number; segments: string[] }>((current, item, index) => {
    const segment = `${colors[index % colors.length]} ${current.start}% ${current.start + item.percent}%`;
    return { start: current.start + item.percent, segments: [...current.segments, segment] };
  }, { start: 0, segments: [] }).segments;

  return (
    <div className="space-y-4">
      <div>
        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-400">Annualized spend</p>
        <p className="mt-2 text-2xl font-semibold text-slate-900">{formatCurrency(totalAnnualSpend)}</p>
      </div>
      <div className="flex flex-col gap-4">
        <div className="flex items-center gap-4">
          <div className="relative h-28 w-28">
          <div
            className="h-28 w-28 rounded-full"
            style={{
              background: totalPlans ? `conic-gradient(${segments.join(",")})` : "#e2e8f0",
            }}
          />
          <div className="absolute inset-4 rounded-full bg-white" />
          <div className="absolute inset-0 flex flex-col items-center justify-center text-xs text-slate-500">
            <span className="text-sm font-semibold text-slate-900">{totalPlans}</span>
            <span>plans</span>
          </div>
          </div>
          <div className="flex-1 space-y-3">
            {mix.map((item, index) => (
              <div key={item.value} className="flex items-center justify-between text-sm text-slate-700">
                <div className="flex items-center gap-2">
                  <span className="h-2 w-2 rounded-full" style={{ backgroundColor: colors[index % colors.length] }} />
                  <span>{item.label}</span>
                </div>
                <span className="font-medium text-slate-900">
                  {item.count} <span className="text-xs font-normal text-slate-500">({Math.round(item.percent)}%)</span>
                </span>
              </div>
            ))}
          </div>
        </div>
        <div className="rounded-lg border border-slate-200 bg-slate-50 px-4 py-3 text-xs text-slate-600">
          <span className="font-semibold text-slate-700">{totalPlans}</span> total plans
          {mix.map((item) => `, ${item.count} ${item.label.toLowerCase()}`)}
        </div>
      </div>
    </div>
  );
}

function DonutBreakdown({ data }: { data: Array<{ label: string; value: number }> }) {
  const total = data.reduce((sum, item) => sum + item.value, 0) || 1;
  const colors = ["#0f766e", "#14b8a6", "#5eead4", "#99f6e4", "#ccfbf1"];
  const segments = data.reduce<{ start: number; segments: string[] }>((current, item, index) => {
    const percent = (item.value / total) * 100;
    const segment = `${colors[index % colors.length]} ${current.start}% ${current.start + percent}%`;

    return {
      start: current.start + percent,
      segments: [...current.segments, segment],
    };
  }, { start: 0, segments: [] }).segments;

  return (
    <div className="flex flex-col gap-4 sm:flex-row sm:items-center">
      <div
        className="h-28 w-28 shrink-0 rounded-full"
        style={{
          background: `conic-gradient(${segments.join(",")})`,
        }}
      />
      <div className="grid min-w-0 flex-1 gap-2">
        {data.map((item, index) => (
          <div key={item.label} className="flex min-w-0 items-center justify-between gap-3 text-sm text-slate-700">
            <div className="flex min-w-0 items-center gap-2">
              <span className="h-2 w-2 shrink-0 rounded-full" style={{ backgroundColor: colors[index % colors.length] }} />
              <span className="truncate font-medium text-slate-900">{item.label}</span>
            </div>
            <span className="shrink-0">{formatCurrency(item.value)}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

