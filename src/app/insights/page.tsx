import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { AppShell } from "@/components/app-shell";
import { InsightsWorkspace } from "@/components/insights-workspace";
import { getSessionCookieName, getSessionUserIdFromCookieValue, verifySessionCookieValue } from "@/lib/auth";
import { readSubscriptionsForUser } from "@/lib/data";
import { sortSubscriptionsByRenewalDate } from "@/lib/subscription-helpers";
import { verifyAdminPermission } from "@/lib/permissions";

export default async function InsightsPage() {
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
      title="Insights"
      description={isAdmin ? "Complete subscription reporting across users, teams, spend, and renewals." : "Your subscription reporting across spend and renewals."}
      isAdmin={isAdmin}
    >
      <InsightsWorkspace subscriptions={subscriptions} isAdmin={isAdmin} />
    </AppShell>
  );
}
