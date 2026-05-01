import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { AppShell } from "@/components/app-shell";
import { SubscriptionForm } from "@/components/subscription-form";
import { getSessionCookieName, getSessionUserIdFromCookieValue, verifySessionCookieValue } from "@/lib/auth";
import { verifyAdminPermission } from "@/lib/permissions";

export default async function AddSubscriptionPage() {
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
      title="Add subscription"
      description="Create a new subscription and save it directly into the managed workflow."
      action={{ label: "Back to dashboard", href: "/dashboard" }}
      isAdmin={isAdmin}
    >
      <SubscriptionForm />
    </AppShell>
  );
}
