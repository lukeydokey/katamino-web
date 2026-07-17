import type { SupabaseClient } from "@supabase/supabase-js";
import { getSupabaseServerClient } from "@/lib/supabase/server";

export async function ensureAnonymousSession(client: SupabaseClient | null) {
  if (!client) {
    return { ok: false, reason: "supabase-disabled" as const };
  }

  const {
    data: { session },
  } = await client.auth.getSession();

  if (session) {
    return { ok: true, reason: "existing-session" as const };
  }

  const { error } = await client.auth.signInAnonymously();

  if (error) {
    return { ok: false, reason: "anonymous-sign-in-failed" as const, error };
  }

  return { ok: true, reason: "anonymous-session-created" as const };
}

export async function getCurrentGuestId() {
  const client = await getSupabaseServerClient();

  if (!client) {
    return { ok: false, reason: "supabase-disabled" as const };
  }

  const {
    data: { user },
    error,
  } = await client.auth.getUser();

  if (error || !user) {
    return { ok: false, reason: "unauthenticated" as const };
  }

  return {
    ok: true,
    guestId: user.id,
  };
}
