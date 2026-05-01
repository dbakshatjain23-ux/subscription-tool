import { createClient, type SupabaseClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.SUPABASE_URL?.trim();
const supabaseAnonKey = process.env.SUPABASE_ANON_KEY?.trim();
const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();

function createConfiguredClient(key: string) {
  if (!supabaseUrl) {
    return null;
  }

  return createClient(supabaseUrl, key, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  });
}

export function getSupabaseAuthClient(): SupabaseClient | null {
  if (!supabaseAnonKey) {
    return null;
  }

  return createConfiguredClient(supabaseAnonKey);
}

export function getSupabaseAdminClient(): SupabaseClient | null {
  if (!supabaseServiceRoleKey) {
    return null;
  }

  return createConfiguredClient(supabaseServiceRoleKey);
}
