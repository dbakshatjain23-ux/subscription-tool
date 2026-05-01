import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { AppShell } from "@/components/app-shell";
import { UserCreateModalButton } from "@/components/user-create-modal-button";
import { UserManagementPanel } from "@/components/user-management-panel";
import { getSessionCookieName, getSessionUserIdFromCookieValue, verifySessionCookieValue } from "@/lib/auth";
import { verifyAdminPermission } from "@/lib/permissions";

export default async function UsersPage() {
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
      title="Users"
      description="Create users, assign access, and manage who can sign in."
      headerActions={<UserCreateModalButton />}
      isAdmin
    >
      <UserManagementPanel />
    </AppShell>
  );
}
