import { describe, expect, it } from "vitest";
import {
  isSupabaseConfigured,
  readPublicSupabaseEnv,
  readServerSupabaseEnv,
} from "@/lib/env";

describe("supabase env helpers", () => {
  it("public env가 모두 있어야 클라이언트 설정을 반환한다", () => {
    expect(
      readPublicSupabaseEnv({
        NEXT_PUBLIC_SUPABASE_URL: "https://example.supabase.co",
        NEXT_PUBLIC_SUPABASE_ANON_KEY: "anon-key",
      } as NodeJS.ProcessEnv),
    ).toEqual({
      url: "https://example.supabase.co",
      anonKey: "anon-key",
    });
  });

  it("public env가 빠지면 null을 반환한다", () => {
    expect(readPublicSupabaseEnv({} as NodeJS.ProcessEnv)).toBeNull();
  });

  it("server env는 service role key를 함께 읽는다", () => {
    expect(
      readServerSupabaseEnv({
        NEXT_PUBLIC_SUPABASE_URL: "https://example.supabase.co",
        NEXT_PUBLIC_SUPABASE_ANON_KEY: "anon-key",
        SUPABASE_SERVICE_ROLE_KEY: "service-role",
      } as NodeJS.ProcessEnv),
    ).toEqual({
      url: "https://example.supabase.co",
      anonKey: "anon-key",
      serviceRoleKey: "service-role",
    });
  });

  it("설정 존재 여부를 boolean으로 판단한다", () => {
    expect(isSupabaseConfigured({} as NodeJS.ProcessEnv)).toBe(false);
    expect(
      isSupabaseConfigured({
        NEXT_PUBLIC_SUPABASE_URL: "https://example.supabase.co",
        NEXT_PUBLIC_SUPABASE_ANON_KEY: "anon-key",
      } as NodeJS.ProcessEnv),
    ).toBe(true);
  });
});
