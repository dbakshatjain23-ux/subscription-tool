import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { AppShell } from "@/components/app-shell";
import { TeamCreateModalButton, TeamManagementPanel } from "@/components/team-management-panel";
import { getSessionCookieName, getSessionUserIdFromCookieValue, verifySessionCookieValue } from "@/lib/auth";
import { verifyAdminPermission } from "@/lib/permissions";

export default async function TeamsPage() {
  const cookieStore = await cookies();
  const session = cookieStore.get(getSessionCookieName())?.value;

  if (!verifySessionCookieValue(session)) {
    redirect("/login");
  }

  const userId = getSessionUserIdFromCookieValue(session);
  if (!userId) {
    redirect("/login");
  }

  const adminCheck = await verifyAdminPermission(userId);
  if (!adminCheck.ok) {
    redirect("/dashboard");
  }

  return (
    <AppShell
      title="Teams"
      description="Create teams and manage which teams can be assigned to subscriptions."
      headerActions={<TeamCreateModalButton />}
      isAdmin
    >
      <TeamManagementPanel />
    </AppShell>
  );
}
