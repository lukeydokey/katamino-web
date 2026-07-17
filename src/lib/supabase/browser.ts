import { createBrowserClient } from "@supabase/ssr";
import type { SupabaseClient } from "@supabase/supabase-js";
import { readPublicSupabaseEnv } from "@/lib/env";

let browserClient: SupabaseClient | null = null;

export function getSupabaseBrowserClient(): SupabaseClient | null {
  const env = readPublicSupabaseEnv();

  if (!env) {
    return null;
  }

  if (browserClient) {
    return browserClient;
  }

  browserClient = createBrowserClient(env.url, env.anonKey);
  return browserClient;
}
