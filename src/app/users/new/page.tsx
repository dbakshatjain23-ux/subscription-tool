import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { AppShell } from "@/components/app-shell";
import { UserCreateForm } from "@/components/user-create-form";
import { getSessionCookieName, getSessionUserIdFromCookieValue, verifySessionCookieValue } from "@/lib/auth";
import { verifyAdminPermission } from "@/lib/permissions";

export default async function CreateUserPage() {
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
      title="Create user"
      description="Create a new user who can sign in immediately."
      action={{ label: "Back to users", href: "/users" }}
      isAdmin
    >
      <section className="max-w-xl rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <UserCreateForm />
      </section>
    </AppShell>
  );
}
