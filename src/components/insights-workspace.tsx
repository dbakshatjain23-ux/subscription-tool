"use client";

import { useMemo, useState } from "react";
import type { Subscription } from "@/lib/types";
import { formatCurrency, isRenewingWithinDays, toAnnualCost, toMonthlyCost } from "@/lib/subscription-helpers";
import { useToast } from "@/components/toast-provider";

type ReportPreset = "executive" | "renewals" | "cost";
type StatusFilter = "all" | "active" | "cancelled";

interface InsightsWorkspaceProps {
  subscriptions: Subscription[];
  isAdmin: boolean;
}

const colors = ["#0f172a", "#0f766e", "#2563eb", "#d97706", "#be123c", "#7c3aed"];

export function InsightsWorkspace({ subscriptions, isAdmin }: InsightsWorkspaceProps) {
  const { toast } = useToast();
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  const [teamFilter, setTeamFilter] = useState("all");
  const [ownerFilter, setOwnerFilter] = useState("all");
  const [preset, setPreset] = useState<ReportPreset>("executive");

  const teams = useMemo(() => uniqueOptions(subscriptions.map((item) => item.team)), [subscriptions]);
  const owners = useMemo(() => uniqueOptions(subscriptions.map((item) => item.owner || "Organization")), [subscriptions]);

  const filteredSubscriptions = useMemo(() => {
    return subscriptions.filter((item) => {
      const matchesStatus = statusFilter === "all" || item.status === statusFilter;
      const matchesTeam = teamFilter === "all" || item.team === teamFilter;
      const matchesOwner = ownerFilter === "all" || (item.owner || "Organization") === ownerFilter;
      return matchesStatus && matchesTeam && matchesOwner;
    });
  }, [ownerFilter, statusFilter, subscriptions, teamFilter]);

  const activeSubscriptions = filteredSubscriptions.filter((item) => item.status === "active");
  const monthlySpend = activeSubscriptions.reduce((total, item) => total + toMonthlyCost(item), 0);
  const annualSpend = activeSubscriptions.reduce((total, item) => total + toAnnualCost(item), 0);
  const cancelledCount = filteredSubscriptions.filter((item) => item.status === "cancelled").length;
  const yearlyCount = activeSubscriptions.filter((item) => item.billingCycle === "yearly").length;
  const monthlyCount = activeSubscriptions.filter((item) => item.billingCycle === "monthly").length;
  const renewingIn30 = activeSubscriptions.filter((item) => isRenewingWithinDays(item.renewalDate, 30)).length;
  const avgMonthlySpend = activeSubscriptions.length ? monthlySpend / activeSubscriptions.length : 0;
  const spendByTeam = groupSpend(activeSubscriptions, (item) => item.team);
  const spendByOwner = groupSpend(activeSubscriptions, (item) => item.owner || "Organization");
  const spendByService = groupSpend(activeSubscriptions, (item) => item.name);
  const renewalsByMonth = groupRenewalsByMonth(activeSubscriptions);
  const upcomingRenewals = [...activeSubscriptions].sort((a, b) => a.renewalDate.localeCompare(b.renewalDate)).slice(0, 12);
  const highCostSubscriptions = [...activeSubscriptions].sort((a, b) => toMonthlyCost(b) - toMonthlyCost(a)).slice(0, 10);
  const reportRows = getReportRows(preset, {
    subscriptions: filteredSubscriptions,
    activeSubscriptions,
    spendByTeam,
    spendByOwner,
    spendByService,
    upcomingRenewals,
    highCostSubscriptions,
    monthlySpend,
    annualSpend,
    renewingIn30,
  });

  function buildExportRows() {
    return [
      ["Subscription Insights Report"],
      ["Generated at", new Date().toLocaleString("en-US")],
      ["Report preset", preset],
      ["Status filter", statusFilter],
      ["Team filter", teamFilter],
      ["User filter", ownerFilter],
      [],
      ["Summary"],
      ["Total subscriptions", String(filteredSubscriptions.length)],
      ["Active subscriptions", String(activeSubscriptions.length)],
      ["Cancelled subscriptions", String(cancelledCount)],
      ["Monthly spend", formatCurrency(monthlySpend)],
      ["Annualized spend", formatCurrency(annualSpend)],
      ["Renewing in 30 days", String(renewingIn30)],
      ["Average monthly spend", formatCurrency(avgMonthlySpend)],
      [],
      ["Detailed report"],
      ["Metric", "Value", "Detail"],
      ...reportRows.map((row) => [row.label, row.value, row.detail]),
      [],
      ["Spend by team"],
      ["Team", "Monthly equivalent"],
      ...spendByTeam.map((item) => [item.label, formatCurrency(item.value)]),
      [],
      ["Spend by user"],
      ["User", "Monthly equivalent"],
      ...spendByOwner.map((item) => [item.label, formatCurrency(item.value)]),
      [],
      ["Spend by service"],
      ["Service", "Monthly equivalent"],
      ...spendByService.map((item) => [item.label, formatCurrency(item.value)]),
      [],
      ["Renewal forecast"],
      ["Month", "Renewal count"],
      ...renewalsByMonth.map((item) => [item.label, String(item.value)]),
      [],
      ["Upcoming renewals"],
      ["Name", "Renewal date", "Team", "Owner", "Monthly equivalent"],
      ...upcomingRenewals.map((item) => [item.name, item.renewalDate, item.team, item.owner, formatCurrency(toMonthlyCost(item))]),
      [],
      ["Cost concentration"],
      ["Name", "Team", "Owner", "Monthly equivalent", "Annual equivalent"],
      ...highCostSubscriptions.map((item) => [item.name, item.team, item.owner, formatCurrency(toMonthlyCost(item)), formatCurrency(toAnnualCost(item))]),
      [],
      ["Subscription detail"],
      ["Name", "Cost", "Billing cycle", "Monthly equivalent", "Annual equivalent", "Renewal date", "Team", "Owner", "Status", "Notes"],
      ...filteredSubscriptions.map((item) => [
        item.name,
        formatCurrency(item.cost),
        item.billingCycle,
        formatCurrency(toMonthlyCost(item)),
        formatCurrency(toAnnualCost(item)),
        item.renewalDate,
        item.team,
        item.owner,
        item.status,
        item.notes,
      ]),
    ];
  }

  function exportExcel() {
    const rows = buildExportRows();
    const html = `<!doctype html><html><head><meta charset="utf-8" /></head><body>${toHtmlTable(rows)}</body></html>`;
    downloadFile("subscription-insights.xls", html, "application/vnd.ms-excel");
    toast({ kind: "success", title: "Excel exported" });
  }

  function exportCsv() {
    const rows = buildExportRows();
    downloadFile("subscription-insights.csv", toCsv(rows), "text/csv;charset=utf-8");
    toast({ kind: "success", title: "CSV exported" });
  }

  function exportJson() {
    const payload = {
      generatedAt: new Date().toISOString(),
      filters: { status: statusFilter, team: teamFilter, owner: ownerFilter },
      summary: {
        totalSubscriptions: filteredSubscriptions.length,
        activeSubscriptions: activeSubscriptions.length,
        cancelledSubscriptions: cancelledCount,
        monthlySpend,
        annualSpend,
        renewingIn30,
      },
      subscriptions: filteredSubscriptions,
      reportRows,
    };

    downloadFile("subscription-insights.json", JSON.stringify(payload, null, 2), "application/json");
    toast({ kind: "success", title: "JSON exported" });
  }

  function exportPdf() {
    const originalTitle = document.title;
    const restoreTitle = () => {
      document.title = originalTitle;
      window.removeEventListener("afterprint", restoreTitle);
    };
    document.title = "Subscription Insights Report";
    window.addEventListener("afterprint", restoreTitle);
    window.print();
  }

  return (
    <>
    <div className="grid gap-6 print:hidden">
      <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm print:hidden">
        <div className="grid gap-4 xl:grid-cols-[1fr_auto] xl:items-end">
          <div className="grid gap-3 md:grid-cols-4">
            <SelectField label="Status" value={statusFilter} onChange={(value) => setStatusFilter(value as StatusFilter)} options={["all", "active", "cancelled"]} />
            <SelectField label="Team" value={teamFilter} onChange={setTeamFilter} options={["all", ...teams]} />
            <SelectField label="User" value={ownerFilter} onChange={setOwnerFilter} options={["all", ...owners]} />
            <SelectField label="Report" value={preset} onChange={(value) => setPreset(value as ReportPreset)} options={["executive", "renewals", "cost"]} />
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <ActionButton label="Export Excel" onClick={exportExcel} />
            <ActionButton label="Export CSV" onClick={exportCsv} />
            <ActionButton label="Export JSON" onClick={exportJson} />
            <ActionButton label="Export PDF" onClick={exportPdf} dark />
          </div>
        </div>
      </section>

      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-5">
        <MetricCard label="Monthly spend" value={formatCurrency(monthlySpend)} accent="bg-slate-900" />
        <MetricCard label="Annualized spend" value={formatCurrency(annualSpend)} accent="bg-teal-600" />
        <MetricCard label="Active subscriptions" value={String(activeSubscriptions.length)} accent="bg-blue-600" />
        <MetricCard label="Renewing in 30 days" value={String(renewingIn30)} accent="bg-amber-500" />
        <MetricCard label="Average monthly" value={formatCurrency(avgMonthlySpend)} accent="bg-rose-600" />
      </section>

      <section className="grid gap-4 xl:grid-cols-[1.4fr_1fr]">
        <Panel title="Detailed report" description={reportDescription[preset]}>
          <div className="grid gap-3">
            {reportRows.map((row) => (
              <div key={row.label} className="rounded-lg border border-slate-200 bg-slate-50 px-4 py-3">
                <div className="flex items-center justify-between gap-3">
                  <p className="text-sm font-semibold text-slate-900">{row.label}</p>
                  <p className="text-sm font-semibold text-slate-700">{row.value}</p>
                </div>
                <p className="mt-1 text-xs leading-5 text-slate-500">{row.detail}</p>
              </div>
            ))}
          </div>
        </Panel>

        <Panel title="Billing mix" description="Monthly and yearly active subscriptions.">
          <DonutChart
            data={[
              { label: "Monthly", value: monthlyCount },
              { label: "Yearly", value: yearlyCount },
            ]}
            center={`${monthlyCount + yearlyCount}`}
            suffix="plans"
          />
        </Panel>
      </section>

      <section className="grid gap-4 xl:grid-cols-3">
        <Panel title="Spend by team" description="Ranked by monthly equivalent spend.">
          <HorizontalBars data={spendByTeam.slice(0, 8)} />
        </Panel>
        <Panel title="Spend by user" description={isAdmin ? "Owners and organization split." : "Your owner split."}>
          <HorizontalBars data={spendByOwner.slice(0, 8)} />
        </Panel>
        <Panel title="Spend by service" description="Highest monthly equivalent services.">
          <HorizontalBars data={spendByService.slice(0, 8)} />
        </Panel>
      </section>

      <section className="grid gap-4 xl:grid-cols-[1.2fr_1fr]">
        <Panel title="Renewal forecast" description="Active renewals grouped by month.">
          <MonthGrid data={renewalsByMonth} />
        </Panel>
        <Panel title="Status overview" description="Filtered active and cancelled mix.">
          <StatusOverview active={activeSubscriptions.length} cancelled={cancelledCount} total={filteredSubscriptions.length} />
        </Panel>
      </section>

      <section className="grid gap-4 xl:grid-cols-[1.2fr_1fr]">
        <Panel title="Upcoming renewal detail" description="Next renewals with owner, team, and monthly equivalent cost.">
          <RenewalTable subscriptions={upcomingRenewals} />
        </Panel>
        <Panel title="Cost concentration" description="Highest active subscriptions by monthly equivalent cost.">
          <CostList subscriptions={highCostSubscriptions} />
        </Panel>
      </section>
    </div>
    <PrintReport
      preset={preset}
      statusFilter={statusFilter}
      teamFilter={teamFilter}
      ownerFilter={ownerFilter}
      filteredSubscriptions={filteredSubscriptions}
      activeCount={activeSubscriptions.length}
      cancelledCount={cancelledCount}
      monthlySpend={monthlySpend}
      annualSpend={annualSpend}
      avgMonthlySpend={avgMonthlySpend}
      renewingIn30={renewingIn30}
      reportRows={reportRows}
      spendByTeam={spendByTeam}
      spendByOwner={spendByOwner}
      spendByService={spendByService}
      renewalsByMonth={renewalsByMonth}
      upcomingRenewals={upcomingRenewals}
      highCostSubscriptions={highCostSubscriptions}
    />
    </>
  );
}

const reportDescription: Record<ReportPreset, string> = {
  executive: "A concise business summary for leadership review.",
  renewals: "Operational focus on upcoming renewal pressure.",
  cost: "Cost control view focused on spend concentration.",
};

function getReportRows(
  preset: ReportPreset,
  data: {
    subscriptions: Subscription[];
    activeSubscriptions: Subscription[];
    spendByTeam: Array<{ label: string; value: number }>;
    spendByOwner: Array<{ label: string; value: number }>;
    spendByService: Array<{ label: string; value: number }>;
    upcomingRenewals: Subscription[];
    highCostSubscriptions: Subscription[];
    monthlySpend: number;
    annualSpend: number;
    renewingIn30: number;
  }
) {
  if (preset === "renewals") {
    return [
      {
        label: "Renewal pressure",
        value: `${data.renewingIn30} due soon`,
        detail: "Active subscriptions renewing in the next 30 days.",
      },
      {
        label: "Next renewal",
        value: data.upcomingRenewals[0]?.renewalDate ?? "None",
        detail: data.upcomingRenewals[0] ? `${data.upcomingRenewals[0].name} owned by ${data.upcomingRenewals[0].owner}.` : "No active renewals found.",
      },
      {
        label: "Renewal spend at risk",
        value: formatCurrency(data.upcomingRenewals.slice(0, 5).reduce((sum, item) => sum + toMonthlyCost(item), 0)),
        detail: "Monthly equivalent spend for the next five renewals.",
      },
    ];
  }

  if (preset === "cost") {
    return [
      {
        label: "Top service",
        value: data.highCostSubscriptions[0]?.name ?? "None",
        detail: data.highCostSubscriptions[0] ? `${formatCurrency(toMonthlyCost(data.highCostSubscriptions[0]))} monthly equivalent.` : "No active services found.",
      },
      {
        label: "Top team",
        value: data.spendByTeam[0]?.label ?? "None",
        detail: data.spendByTeam[0] ? `${formatCurrency(data.spendByTeam[0].value)} monthly equivalent.` : "No team spend found.",
      },
      {
        label: "Top owner",
        value: data.spendByOwner[0]?.label ?? "None",
        detail: data.spendByOwner[0] ? `${formatCurrency(data.spendByOwner[0].value)} monthly equivalent.` : "No owner spend found.",
      },
    ];
  }

  return [
    {
      label: "Portfolio size",
      value: `${data.subscriptions.length} subscriptions`,
      detail: `${data.activeSubscriptions.length} active subscriptions included in current filters.`,
    },
    {
      label: "Spend run rate",
      value: formatCurrency(data.monthlySpend),
      detail: `${formatCurrency(data.annualSpend)} annualized spend based on active subscriptions.`,
    },
    {
      label: "Largest spend driver",
      value: data.spendByService[0]?.label ?? "None",
      detail: data.spendByService[0] ? `${formatCurrency(data.spendByService[0].value)} monthly equivalent.` : "No active spend tracked.",
    },
  ];
}

function uniqueOptions(values: string[]) {
  return Array.from(new Set(values.filter(Boolean))).sort((a, b) => a.localeCompare(b));
}

function groupSpend(subscriptions: Subscription[], getKey: (item: Subscription) => string) {
  const totals = new Map<string, number>();

  subscriptions.forEach((item) => {
    const key = getKey(item) || "Unassigned";
    totals.set(key, (totals.get(key) ?? 0) + toMonthlyCost(item));
  });

  return Array.from(totals, ([label, value]) => ({ label, value })).sort((a, b) => b.value - a.value);
}

function groupRenewalsByMonth(subscriptions: Subscription[]) {
  const totals = new Map<string, number>();

  subscriptions.forEach((item) => {
    const date = new Date(item.renewalDate);
    const label = Number.isNaN(date.getTime()) ? "Unknown" : date.toLocaleDateString("en-US", { month: "short", year: "numeric" });
    totals.set(label, (totals.get(label) ?? 0) + 1);
  });

  return Array.from(totals, ([label, value]) => ({ label, value })).slice(0, 8);
}

function MetricCard({ label, value, accent }: { label: string; value: string; accent: string }) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
      <span className={`block h-1.5 w-10 rounded-full ${accent}`} />
      <p className="mt-4 text-sm font-medium text-slate-500">{label}</p>
      <p className="mt-3 text-2xl font-semibold tracking-tight text-slate-950">{value}</p>
    </div>
  );
}

function Panel({ title, description, children }: { title: string; description: string; children: React.ReactNode }) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
      <div className="mb-4">
        <p className="text-sm font-semibold text-slate-950">{title}</p>
        <p className="mt-1 text-sm text-slate-500">{description}</p>
      </div>
      {children}
    </div>
  );
}

function SelectField({ label, value, onChange, options }: { label: string; value: string; onChange: (value: string) => void; options: string[] }) {
  return (
    <label className="space-y-2 text-sm font-medium text-slate-700">
      <span>{label}</span>
      <select value={value} onChange={(event) => onChange(event.target.value)} className="h-10 w-full rounded-md border border-slate-200 bg-white px-3 text-sm text-slate-950 outline-none transition focus:border-slate-400 focus:ring-2 focus:ring-slate-200">
        {options.map((option) => (
          <option key={option} value={option} className="capitalize">
            {option}
          </option>
        ))}
      </select>
    </label>
  );
}

function ActionButton({ label, onClick, dark = false }: { label: string; onClick: () => void; dark?: boolean }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`inline-flex h-10 items-center justify-center rounded-md px-4 text-sm font-medium transition ${
        dark ? "bg-slate-900 text-white hover:bg-slate-800" : "border border-slate-200 bg-white text-slate-700 hover:bg-slate-50"
      }`}
    >
      {label}
    </button>
  );
}

function HorizontalBars({ data }: { data: Array<{ label: string; value: number }> }) {
  if (!data.length) {
    return <p className="text-sm text-slate-500">No active spend tracked yet.</p>;
  }

  const max = data[0]?.value || 1;

  return (
    <div className="grid gap-3">
      {data.map((item, index) => (
        <div key={item.label}>
          <div className="mb-2 flex items-center justify-between gap-3 text-sm">
            <span className="truncate font-medium text-slate-900">{item.label}</span>
            <span className="shrink-0 text-slate-600">{formatCurrency(item.value)}</span>
          </div>
          <div className="h-2.5 overflow-hidden rounded-full bg-slate-100">
            <div className="h-full rounded-full" style={{ width: `${Math.max((item.value / max) * 100, 5)}%`, backgroundColor: colors[index % colors.length] }} />
          </div>
        </div>
      ))}
    </div>
  );
}

function DonutChart({ data, center, suffix }: { data: Array<{ label: string; value: number }>; center: string; suffix: string }) {
  const total = data.reduce((sum, item) => sum + item.value, 0) || 1;
  const segments = data.reduce<{ start: number; segments: string[] }>((current, item, index) => {
    const percent = (item.value / total) * 100;
    const segment = `${colors[index % colors.length]} ${current.start}% ${current.start + percent}%`;

    return {
      start: current.start + percent,
      segments: [...current.segments, segment],
    };
  }, { start: 0, segments: [] }).segments;

  return (
    <div className="flex flex-col gap-5 sm:flex-row sm:items-center">
      <div className="relative h-36 w-36 shrink-0">
        <div className="h-36 w-36 rounded-full" style={{ background: `conic-gradient(${segments.join(",")})` }} />
        <div className="absolute inset-5 rounded-full bg-white" />
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <span className="text-2xl font-semibold text-slate-900">{center}</span>
          <span className="text-xs text-slate-500">{suffix}</span>
        </div>
      </div>
      <div className="grid flex-1 gap-3">
        {data.map((item, index) => (
          <div key={item.label} className="flex items-center justify-between text-sm">
            <span className="flex items-center gap-2 text-slate-700">
              <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: colors[index % colors.length] }} />
              {item.label}
            </span>
            <span className="font-medium text-slate-900">{item.value}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

function MonthGrid({ data }: { data: Array<{ label: string; value: number }> }) {
  if (!data.length) {
    return <p className="text-sm text-slate-500">No renewal data available.</p>;
  }

  const max = Math.max(...data.map((item) => item.value), 1);

  return (
    <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
      {data.map((item, index) => (
        <div key={item.label} className="rounded-lg border border-slate-200 bg-slate-50 p-3">
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">{item.label}</p>
          <p className="mt-3 text-2xl font-semibold text-slate-900">{item.value}</p>
          <div className="mt-3 h-2 overflow-hidden rounded-full bg-white">
            <div className="h-full rounded-full" style={{ width: `${(item.value / max) * 100}%`, backgroundColor: colors[index % colors.length] }} />
          </div>
        </div>
      ))}
    </div>
  );
}

function StatusOverview({ active, cancelled, total }: { active: number; cancelled: number; total: number }) {
  const activePercent = total ? Math.round((active / total) * 100) : 0;
  const cancelledPercent = total ? Math.round((cancelled / total) * 100) : 0;

  return (
    <div className="space-y-5">
      <StatusRow label="Active" value={active} percent={activePercent} color="#0f766e" />
      <StatusRow label="Cancelled" value={cancelled} percent={cancelledPercent} color="#be123c" />
    </div>
  );
}

function StatusRow({ label, value, percent, color }: { label: string; value: number; percent: number; color: string }) {
  return (
    <div>
      <div className="flex items-center justify-between text-sm">
        <span className="font-medium text-slate-900">{label}</span>
        <span className="text-slate-600">{value}</span>
      </div>
      <div className="mt-2 h-2 overflow-hidden rounded-full bg-slate-100">
        <div className="h-full rounded-full" style={{ width: `${percent}%`, backgroundColor: color }} />
      </div>
      <p className="mt-1 text-xs text-slate-500">{percent}% of filtered total</p>
    </div>
  );
}

function RenewalTable({ subscriptions }: { subscriptions: Subscription[] }) {
  if (!subscriptions.length) {
    return <p className="text-sm text-slate-500">No upcoming renewals.</p>;
  }

  return (
    <div className="overflow-x-auto">
      <table className="min-w-full divide-y divide-slate-200 text-sm">
        <thead className="text-left text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">
          <tr>
            <th className="py-3 pr-4">Service</th>
            <th className="py-3 pr-4">Renewal</th>
            <th className="py-3 pr-4">Team</th>
            <th className="py-3 pr-4">Monthly</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100">
          {subscriptions.map((item) => (
            <tr key={item.id}>
              <td className="py-3 pr-4 font-medium text-slate-900">{item.name}</td>
              <td className="py-3 pr-4 text-slate-600">{item.renewalDate}</td>
              <td className="py-3 pr-4 text-slate-600">{item.team}</td>
              <td className="py-3 pr-4 text-slate-600">{formatCurrency(toMonthlyCost(item))}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function CostList({ subscriptions }: { subscriptions: Subscription[] }) {
  if (!subscriptions.length) {
    return <p className="text-sm text-slate-500">No active costs.</p>;
  }

  return (
    <div className="grid gap-3">
      {subscriptions.map((item, index) => (
        <div key={item.id} className="flex items-center justify-between gap-4 rounded-lg border border-slate-200 px-3 py-3">
          <div className="min-w-0">
            <p className="truncate text-sm font-semibold text-slate-900">{index + 1}. {item.name}</p>
            <p className="mt-1 text-xs text-slate-500">{item.team} · {item.owner}</p>
          </div>
          <p className="shrink-0 text-sm font-medium text-slate-700">{formatCurrency(toMonthlyCost(item))}</p>
        </div>
      ))}
    </div>
  );
}

function PrintReport({
  preset,
  statusFilter,
  teamFilter,
  ownerFilter,
  filteredSubscriptions,
  activeCount,
  cancelledCount,
  monthlySpend,
  annualSpend,
  avgMonthlySpend,
  renewingIn30,
  reportRows,
  spendByTeam,
  spendByOwner,
  spendByService,
  renewalsByMonth,
  upcomingRenewals,
  highCostSubscriptions,
}: {
  preset: ReportPreset;
  statusFilter: StatusFilter;
  teamFilter: string;
  ownerFilter: string;
  filteredSubscriptions: Subscription[];
  activeCount: number;
  cancelledCount: number;
  monthlySpend: number;
  annualSpend: number;
  avgMonthlySpend: number;
  renewingIn30: number;
  reportRows: Array<{ label: string; value: string; detail: string }>;
  spendByTeam: Array<{ label: string; value: number }>;
  spendByOwner: Array<{ label: string; value: number }>;
  spendByService: Array<{ label: string; value: number }>;
  renewalsByMonth: Array<{ label: string; value: number }>;
  upcomingRenewals: Subscription[];
  highCostSubscriptions: Subscription[];
}) {
  return (
    <article className="hidden print:block">
      <header className="border-b border-slate-300 pb-4">
        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">Subscription Hub</p>
        <h1 className="mt-2 text-2xl font-semibold text-slate-950">Subscription Insights Report</h1>
        <p className="mt-2 text-sm text-slate-600">Generated {new Date().toLocaleString("en-US")}</p>
        <div className="mt-4 grid grid-cols-4 gap-2 text-xs">
          <PrintMeta label="Report" value={preset} />
          <PrintMeta label="Status" value={statusFilter} />
          <PrintMeta label="Team" value={teamFilter} />
          <PrintMeta label="User" value={ownerFilter} />
        </div>
      </header>

      <section className="mt-5 grid grid-cols-3 gap-3">
        <PrintMetric label="Subscriptions" value={String(filteredSubscriptions.length)} />
        <PrintMetric label="Active" value={String(activeCount)} />
        <PrintMetric label="Cancelled" value={String(cancelledCount)} />
        <PrintMetric label="Monthly spend" value={formatCurrency(monthlySpend)} />
        <PrintMetric label="Annualized spend" value={formatCurrency(annualSpend)} />
        <PrintMetric label="Avg monthly" value={formatCurrency(avgMonthlySpend)} />
      </section>

      <PrintSection title="Detailed Report">
        <div className="grid gap-2">
          {reportRows.map((row) => (
            <div key={row.label} className="rounded border border-slate-200 p-3">
              <div className="flex justify-between gap-4 text-sm">
                <strong>{row.label}</strong>
                <span>{row.value}</span>
              </div>
              <p className="mt-1 text-xs text-slate-600">{row.detail}</p>
            </div>
          ))}
        </div>
      </PrintSection>

      <section className="mt-5 grid grid-cols-3 gap-4">
        <PrintSection title="Spend By Team">
          <PrintRankedRows data={spendByTeam.slice(0, 8)} />
        </PrintSection>
        <PrintSection title="Spend By User">
          <PrintRankedRows data={spendByOwner.slice(0, 8)} />
        </PrintSection>
        <PrintSection title="Spend By Service">
          <PrintRankedRows data={spendByService.slice(0, 8)} />
        </PrintSection>
      </section>

      <section className="mt-5 grid grid-cols-2 gap-4">
        <PrintSection title="Renewal Forecast">
          <PrintCountRows data={renewalsByMonth} />
        </PrintSection>
        <PrintSection title="Renewal Pressure">
          <PrintMetric label="Renewing in 30 days" value={String(renewingIn30)} />
        </PrintSection>
      </section>

      <PrintSection title="Upcoming Renewals">
        <PrintSubscriptionTable subscriptions={upcomingRenewals} />
      </PrintSection>

      <PrintSection title="Cost Concentration">
        <PrintSubscriptionTable subscriptions={highCostSubscriptions} />
      </PrintSection>
    </article>
  );
}

function PrintMeta({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded border border-slate-200 p-2">
      <p className="font-semibold text-slate-500">{label}</p>
      <p className="mt-1 capitalize text-slate-900">{value}</p>
    </div>
  );
}

function PrintMetric({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded border border-slate-200 p-3">
      <p className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">{label}</p>
      <p className="mt-2 text-lg font-semibold text-slate-950">{value}</p>
    </div>
  );
}

function PrintSection({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="mt-5 break-inside-avoid">
      <h2 className="mb-3 border-b border-slate-200 pb-2 text-sm font-semibold uppercase tracking-[0.14em] text-slate-700">{title}</h2>
      {children}
    </section>
  );
}

function PrintRankedRows({ data }: { data: Array<{ label: string; value: number }> }) {
  if (!data.length) {
    return <p className="text-xs text-slate-500">No data.</p>;
  }

  return (
    <div className="grid gap-2 text-xs">
      {data.map((item) => (
        <div key={item.label} className="flex justify-between gap-3">
          <span>{item.label}</span>
          <strong>{formatCurrency(item.value)}</strong>
        </div>
      ))}
    </div>
  );
}

function PrintCountRows({ data }: { data: Array<{ label: string; value: number }> }) {
  if (!data.length) {
    return <p className="text-xs text-slate-500">No data.</p>;
  }

  return (
    <div className="grid gap-2 text-xs">
      {data.map((item) => (
        <div key={item.label} className="flex justify-between gap-3">
          <span>{item.label}</span>
          <strong>{item.value}</strong>
        </div>
      ))}
    </div>
  );
}

function PrintSubscriptionTable({ subscriptions }: { subscriptions: Subscription[] }) {
  if (!subscriptions.length) {
    return <p className="text-xs text-slate-500">No subscriptions.</p>;
  }

  return (
    <table className="w-full border-collapse text-xs">
      <thead>
        <tr className="border-b border-slate-300 text-left">
          <th className="py-2 pr-2">Name</th>
          <th className="py-2 pr-2">Renewal</th>
          <th className="py-2 pr-2">Team</th>
          <th className="py-2 pr-2">Owner</th>
          <th className="py-2 text-right">Monthly</th>
        </tr>
      </thead>
      <tbody>
        {subscriptions.map((item) => (
          <tr key={item.id} className="border-b border-slate-100">
            <td className="py-2 pr-2">{item.name}</td>
            <td className="py-2 pr-2">{item.renewalDate}</td>
            <td className="py-2 pr-2">{item.team}</td>
            <td className="py-2 pr-2">{item.owner}</td>
            <td className="py-2 text-right">{formatCurrency(toMonthlyCost(item))}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

function toCsv(rows: string[][]) {
  return rows
    .map((row) =>
      row
        .map((cell) => {
          const value = String(cell ?? "");
          return `"${value.replaceAll('"', '""')}"`;
        })
        .join(",")
    )
    .join("\n");
}

function toHtmlTable(rows: string[][]) {
  const body = rows
    .map((row) => {
      const cells = row.length ? row : [""];
      const tds = cells
        .map((cell) => `<td>${escapeHtml(String(cell ?? ""))}</td>`)
        .join("");
      return `<tr>${tds}</tr>`;
    })
    .join("");
  return `<table>${body}</table>`;
}

function escapeHtml(value: string) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

function downloadFile(filename: string, content: string, type: string) {
  const blob = new Blob([content], { type });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
}
