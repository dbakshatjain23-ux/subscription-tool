import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { getSessionCookieName, getSessionUserIdFromCookieValue } from "@/lib/auth";
import { writeAuditLog } from "@/lib/audit";

export async function POST(request: NextRequest) {
  const userId = getSessionUserIdFromCookieValue(request.cookies.get(getSessionCookieName())?.value);
  if (userId) {
    await writeAuditLog({
      userId,
      action: "LOGOUT",
      resourceType: "auth",
      resourceId: userId,
    });
  }

  const response = NextResponse.json({ ok: true });
  response.cookies.set({
    name: getSessionCookieName(),
    value: "",
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 0,
  });

  return response;
}
