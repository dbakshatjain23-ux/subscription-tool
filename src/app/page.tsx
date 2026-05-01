import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { getSessionCookieName, verifySessionCookieValue } from "@/lib/auth";

export default async function HomePage() {
  const cookieStore = await cookies();
  const session = cookieStore.get(getSessionCookieName())?.value;

  if (verifySessionCookieValue(session)) {
    redirect("/dashboard");
  }

  redirect("/login");
}