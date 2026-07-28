import { describe, expect, it } from "vitest";
import {
  buildPlaywrightWebServerEnv,
  parseSupabaseStatusEnv,
} from "./local-supabase-env";

describe("local supabase env helpers", () => {
  it("supabase status env 출력을 key/value 맵으로 파싱한다", () => {
    const parsed = parseSupabaseStatusEnv([
      'API_URL="http://127.0.0.1:54321"',
      'ANON_KEY="anon-key"',
      'SERVICE_ROLE_KEY="service-role-key"',
      "Stopped services: [pooler]",
    ].join("\n"));

    expect(parsed).toEqual({
      API_URL: "http://127.0.0.1:54321",
      ANON_KEY: "anon-key",
      SERVICE_ROLE_KEY: "service-role-key",
    });
  });

  it("local supabase status가 있으면 Playwright webServer env를 local 값으로 덮어쓴다", () => {
    const env = buildPlaywrightWebServerEnv(
      {
        NEXT_PUBLIC_SUPABASE_URL: "https://project.supabase.co",
        NEXT_PUBLIC_SUPABASE_ANON_KEY: "hosted-anon",
        SUPABASE_SERVICE_ROLE_KEY: "hosted-service",
      },
      [
        'API_URL="http://127.0.0.1:54321"',
        'ANON_KEY="local-anon"',
        'SERVICE_ROLE_KEY="local-service"',
      ].join("\n"),
    );

    expect(env).toMatchObject({
      NEXT_PUBLIC_SUPABASE_URL: "http://127.0.0.1:54321",
      NEXT_PUBLIC_SUPABASE_ANON_KEY: "local-anon",
      SUPABASE_SERVICE_ROLE_KEY: "local-service",
      KATAMINO_E2E_LOCAL_SUPABASE: "1",
    });
  });

  it("필수 값이 빠지면 기존 env를 유지한다", () => {
    const env = buildPlaywrightWebServerEnv(
      {
        NEXT_PUBLIC_SUPABASE_URL: "https://project.supabase.co",
        NEXT_PUBLIC_SUPABASE_ANON_KEY: "hosted-anon",
        SUPABASE_SERVICE_ROLE_KEY: "hosted-service",
      },
      'API_URL="http://127.0.0.1:54321"',
    );

    expect(env).toMatchObject({
      NEXT_PUBLIC_SUPABASE_URL: "https://project.supabase.co",
      NEXT_PUBLIC_SUPABASE_ANON_KEY: "hosted-anon",
      SUPABASE_SERVICE_ROLE_KEY: "hosted-service",
    });
  });
});
