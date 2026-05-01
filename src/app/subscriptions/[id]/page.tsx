import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { AppShell } from "@/components/app-shell";
import { SubscriptionForm } from "@/components/subscription-form";
import { getSessionCookieName, getSessionUserIdFromCookieValue, verifySessionCookieValue } from "@/lib/auth";
import { readSubscriptionById } from "@/lib/data";
import { verifyAdminPermission } from "@/lib/permissions";

type PageProps = {
  params: Promise<{ id: string }>;
};

export default async function EditSubscriptionPage({ params }: PageProps) {
  const { id } = await params;

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
  const subscription = await readSubscriptionById(id, userId, isAdmin);

  if (!subscription) {
    redirect("/subscriptions");
  }

  return (
    <AppShell
      title="Edit subscription"
      description="Update ownership, billing cycle, and renewal details in one place."
      action={{ label: "Back to subscriptions", href: "/subscriptions" }}
      isAdmin={isAdmin}
    >
      <SubscriptionForm subscription={subscription} />
    </AppShell>
  );
}
