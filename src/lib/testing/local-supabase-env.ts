import { execSync } from "node:child_process";

export type PlaywrightWebServerEnv = Record<string, string>;

function normalizeEnv(
  baseEnv: Record<string, string | undefined>,
): PlaywrightWebServerEnv {
  return Object.fromEntries(
    Object.entries(baseEnv).filter((entry): entry is [string, string] => {
      return typeof entry[1] === "string";
    }),
  );
}

export function parseSupabaseStatusEnv(output: string): Record<string, string> {
  const entries = output
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => /^[A-Z0-9_]+=/.test(line));

  return entries.reduce<Record<string, string>>((accumulator, entry) => {
    const separatorIndex = entry.indexOf("=");

    if (separatorIndex < 0) {
      return accumulator;
    }

    const key = entry.slice(0, separatorIndex);
    const rawValue = entry.slice(separatorIndex + 1);
    const value = rawValue.replace(/^"|"$/g, "");

    accumulator[key] = value;
    return accumulator;
  }, {});
}

export function buildPlaywrightWebServerEnv(
  baseEnv: Record<string, string | undefined>,
  statusOutput: string | null,
): PlaywrightWebServerEnv {
  const normalizedBaseEnv = normalizeEnv(baseEnv);

  if (!statusOutput) {
    return normalizedBaseEnv;
  }

  const parsed = parseSupabaseStatusEnv(statusOutput);
  const localUrl = parsed.API_URL;
  const localAnonKey = parsed.ANON_KEY;
  const localServiceRoleKey = parsed.SERVICE_ROLE_KEY;

  if (!localUrl || !localAnonKey || !localServiceRoleKey) {
    return normalizedBaseEnv;
  }

  return {
    ...normalizedBaseEnv,
    NEXT_PUBLIC_SUPABASE_URL: localUrl,
    NEXT_PUBLIC_SUPABASE_ANON_KEY: localAnonKey,
    SUPABASE_SERVICE_ROLE_KEY: localServiceRoleKey,
    KATAMINO_E2E_LOCAL_SUPABASE: "1",
  };
}

export function readLocalSupabaseStatusEnv(): string | null {
  try {
    return execSync("supabase status -o env", {
      encoding: "utf8",
      stdio: ["ignore", "pipe", "ignore"],
    });
  } catch {
    return null;
  }
}

export function resolvePlaywrightWebServerEnv(
  baseEnv: Record<string, string | undefined>,
): PlaywrightWebServerEnv {
  return buildPlaywrightWebServerEnv(baseEnv, readLocalSupabaseStatusEnv());
}
