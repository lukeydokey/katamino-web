export interface PublicSupabaseEnv {
  url: string;
  anonKey: string;
}

export interface ServerSupabaseEnv extends PublicSupabaseEnv {
  serviceRoleKey: string | null;
}

export type EnvSource = Record<string, string | undefined>;

export function readPublicSupabaseEnv(
  source: EnvSource = process.env,
): PublicSupabaseEnv | null {
  const url = source.NEXT_PUBLIC_SUPABASE_URL?.trim();
  const anonKey = source.NEXT_PUBLIC_SUPABASE_ANON_KEY?.trim();

  if (!url || !anonKey) {
    return null;
  }

  return {
    url,
    anonKey,
  };
}

export function readServerSupabaseEnv(
  source: EnvSource = process.env,
): ServerSupabaseEnv | null {
  const publicEnv = readPublicSupabaseEnv(source);

  if (!publicEnv) {
    return null;
  }

  return {
    ...publicEnv,
    serviceRoleKey: source.SUPABASE_SERVICE_ROLE_KEY?.trim() || null,
  };
}

export function isSupabaseConfigured(source: EnvSource = process.env): boolean {
  return readPublicSupabaseEnv(source) !== null;
}
