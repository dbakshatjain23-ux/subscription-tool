import crypto from "node:crypto";
import type { NextRequest } from "next/server";
import { getSupabaseAdminClient } from "@/lib/supabase";

const SESSION_COOKIE_NAME = "smt_session";
const SESSION_TTL_MS = 1000 * 60 * 60 * 24 * 7;

type SessionPayload = {
  userId: string;
  email: string;
  expiresAt: number;
};

function getAuthSecret() {
  return process.env.AUTH_SECRET?.trim() || "development-secret-change-me";
}

function signValue(value: string) {
  return crypto.createHmac("sha256", getAuthSecret()).update(value).digest("hex");
}

function createToken(session: SessionPayload) {
  const payload = JSON.stringify(session);
  return `${Buffer.from(payload).toString("base64url")}.${signValue(payload)}`;
}

function createTokenValue(session: Omit<SessionPayload, "expiresAt">) {
  return createToken({ ...session, expiresAt: Date.now() + SESSION_TTL_MS });
}

function parseToken(value?: string | null) {
  if (!value) {
    return null;
  }

  const [encodedPayload, signature] = value.split(".");
  if (!encodedPayload || !signature) {
    return null;
  }

  const payload = Buffer.from(encodedPayload, "base64url").toString("utf8");
  const expectedSignature = signValue(payload);

  if (signature.length !== expectedSignature.length) {
    return null;
  }

  if (!crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(expectedSignature))) {
    return null;
  }

  try {
    const session = JSON.parse(payload) as SessionPayload;

    if (!session.userId || !session.email || Number.isNaN(session.expiresAt) || session.expiresAt < Date.now()) {
      return null;
    }

    return session;
  } catch {
    return null;
  }
}

export function createSessionCookieValue(session: { userId: string; email: string }) {
  return createTokenValue(session);
}

export function verifySessionCookieValue(value?: string | null) {
  return parseToken(value) !== null;
}

export function getSessionUserIdFromCookieValue(value?: string | null) {
  return parseToken(value)?.userId ?? null;
}

export async function verifySupabaseSessionCookieValue(value?: string | null) {
  const session = parseToken(value);

  if (!session) {
    return false;
  }

  const supabase = getSupabaseAdminClient();
  if (!supabase) {
    return false;
  }

  const { data, error } = await supabase.auth.admin.getUserById(session.userId);

  if (error || !data.user) {
    return false;
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("is_active")
    .eq("id", session.userId)
    .single();

  if (profile?.is_active === false) {
    return false;
  }

  return data.user.email?.trim().toLowerCase() === session.email.trim().toLowerCase();
}

export async function verifyRequestSession(request: NextRequest) {
  return verifySupabaseSessionCookieValue(request.cookies.get(SESSION_COOKIE_NAME)?.value);
}

export function getSessionCookieName() {
  return SESSION_COOKIE_NAME;
}
