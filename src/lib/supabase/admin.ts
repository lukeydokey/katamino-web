import { createClient } from "@supabase/supabase-js";
import { readServerSupabaseEnv } from "@/lib/env";

export function getSupabaseAdminClient() {
  const env = readServerSupabaseEnv();

  if (!env?.serviceRoleKey) {
    return null;
  }

  return createClient(env.url, env.serviceRoleKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  });
}
