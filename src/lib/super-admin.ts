import { getSupabaseAdminClient } from "@/lib/supabase";

type ProfileLike = {
  id: string;
  email?: string | null;
  full_name?: string | null;
  role?: string | null;
};

function normalize(value?: string | null) {
  return String(value ?? "").trim().toLowerCase();
}

function configuredSuperAdminEmail() {
  return normalize(process.env.SUPER_ADMIN_EMAIL || process.env.ADMIN_EMAIL);
}

export function isConfiguredSuperAdmin(profile: ProfileLike) {
  const configuredEmail = configuredSuperAdminEmail();
  if (configuredEmail && normalize(profile.email) === configuredEmail) {
    return true;
  }

  return normalize(profile.full_name) === "super admin";
}

export async function getSuperAdminId() {
  const supabase = getSupabaseAdminClient();
  if (!supabase) {
    return null;
  }

  const configuredEmail = configuredSuperAdminEmail();
  if (configuredEmail) {
    const { data } = await supabase
      .from("profiles")
      .select("id, email")
      .ilike("email", configuredEmail)
      .maybeSingle();

    if (data?.id) {
      return data.id as string;
    }
  }

  const { data: namedSuperAdmin } = await supabase
    .from("profiles")
    .select("id")
    .ilike("full_name", "super admin")
    .maybeSingle();

  if (namedSuperAdmin?.id) {
    return namedSuperAdmin.id as string;
  }

  const { data } = await supabase
    .from("profiles")
    .select("id")
    .eq("role", "admin")
    .order("created_at", { ascending: true })
    .limit(1)
    .maybeSingle();

  return (data?.id as string | undefined) ?? null;
}

export async function isSuperAdminProfile(profile: ProfileLike) {
  if (isConfiguredSuperAdmin(profile)) {
    return true;
  }

  const superAdminId = await getSuperAdminId();
  return Boolean(superAdminId && profile.id === superAdminId);
}
