import { describe, expect, it, vi, beforeEach } from "vitest";

const {
  ensureGuestSessionIdMock,
  getGuestSessionIdMock,
  getSupabaseAdminClientMock,
} = vi.hoisted(() => ({
  ensureGuestSessionIdMock: vi.fn(),
  getGuestSessionIdMock: vi.fn(),
  getSupabaseAdminClientMock: vi.fn(),
}));

vi.mock("@/lib/guest-session", () => ({
  ensureGuestSessionId: ensureGuestSessionIdMock,
  getGuestSessionId: getGuestSessionIdMock,
}));

vi.mock("@/lib/supabase/admin", () => ({
  getSupabaseAdminClient: getSupabaseAdminClientMock,
}));

import {
  isRoomBackendReady,
  resolveRoomPlayerRequestContext,
  resolveRoomRequestContext,
} from "./request-context";

describe("room request context", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("admin client가 없으면 503 응답을 반환한다", async () => {
    getSupabaseAdminClientMock.mockReturnValue(null);

    const result = await resolveRoomRequestContext();

    expect(result.ok).toBe(false);

    if (result.ok) {
      throw new Error("expected failure result");
    }

    expect(result.response.status).toBe(503);
    await expect(result.response.json()).resolves.toEqual({
      message: "Supabase server 환경이 아직 설정되지 않았습니다.",
    });
  });

  it("ensure guest 모드에서 세션이 없으면 401 응답을 반환한다", async () => {
    getSupabaseAdminClientMock.mockReturnValue({});
    ensureGuestSessionIdMock.mockResolvedValue(null);

    const result = await resolveRoomRequestContext({ guestMode: "ensure" });

    expect(result.ok).toBe(false);

    if (result.ok) {
      throw new Error("expected failure result");
    }

    expect(result.response.status).toBe(401);
    await expect(result.response.json()).resolves.toEqual({
      message: "인증된 guest 세션이 필요합니다.",
    });
  });

  it("get guest 모드에서 기존 세션이 있으면 guestId를 반환한다", async () => {
    const supabase = {};
    getSupabaseAdminClientMock.mockReturnValue(supabase);
    getGuestSessionIdMock.mockResolvedValue("guest-1");

    const result = await resolveRoomRequestContext({ guestMode: "get" });

    expect(result).toEqual({
      ok: true,
      supabase,
      guestId: "guest-1",
    });
  });

  it("skip 모드에서는 guest 세션 없이도 성공한다", async () => {
    const supabase = {};
    getSupabaseAdminClientMock.mockReturnValue(supabase);

    const result = await resolveRoomRequestContext();

    expect(result).toEqual({
      ok: true,
      supabase,
      guestId: null,
    });
  });

  it("room backend readiness는 room 관련 모든 테이블 조회가 성공해야 true를 반환한다", async () => {
    const probes: Array<{ table: string; column: string }> = [];
    const supabase = {
      from: vi.fn((table: string) => ({
        select: vi.fn((column: string) => {
          probes.push({ table, column });

          return {
            limit: vi.fn().mockResolvedValue({ error: null }),
          };
        }),
      })),
    };

    await expect(isRoomBackendReady(supabase as never)).resolves.toBe(true);
    expect(probes).toEqual([
      { table: "rooms", column: "id" },
      { table: "room_players", column: "id" },
      { table: "room_games", column: "id" },
      { table: "room_spectators", column: "room_id" },
      { table: "room_messages", column: "id" },
    ]);
  });

  it("room backend readiness는 어떤 probe라도 에러가 나면 false를 반환한다", async () => {
    const supabase = {
      from: vi.fn((table: string) => ({
        select: vi.fn(() => ({
          limit: vi.fn().mockResolvedValue({
            error: table === "room_spectators" ? new Error("permission denied") : null,
          }),
        })),
      })),
    };

    await expect(isRoomBackendReady(supabase as never)).resolves.toBe(false);
  });

  it("room backend readiness는 예외가 발생해도 false를 반환한다", async () => {
    const supabase = {
      from: vi.fn(() => {
        throw new Error("unexpected failure");
      }),
    };

    await expect(isRoomBackendReady(supabase as never)).resolves.toBe(false);
  });

  it("room player request context는 room과 players, requester를 함께 반환한다", async () => {
    const supabase = {
      from: vi.fn((table: string) => {
        if (table === "rooms") {
          return {
            select: vi.fn(() => ({
              eq: vi.fn(() => ({
                single: vi.fn().mockResolvedValue({
                  data: { id: "room-1", code: "ABC123", status: "playing" },
                }),
              })),
            })),
          };
        }

        if (table === "room_players") {
          return {
            select: vi.fn(() => ({
              eq: vi.fn(() => Promise.resolve({
                data: [
                  { guest_id: "guest-1", seat: "host" },
                  { guest_id: "guest-2", seat: "guest" },
                ],
              })),
            })),
          };
        }

        throw new Error(`unexpected table ${table}`);
      }),
    };

    getSupabaseAdminClientMock.mockReturnValue(supabase);
    getGuestSessionIdMock.mockResolvedValue("guest-2");

    const result = await resolveRoomPlayerRequestContext<{
      id: string;
      code: string;
      status: string;
    }>({
      code: "ABC123",
      guestMode: "get",
      roomSelect: "id, code, status",
    });

    expect(result).toEqual({
      ok: true,
      supabase,
      guestId: "guest-2",
      room: { id: "room-1", code: "ABC123", status: "playing" },
      players: [
        { guestId: "guest-1", seat: "host" },
        { guestId: "guest-2", seat: "guest" },
      ],
      requester: { guestId: "guest-2", seat: "guest" },
    });
  });

  it("room player request context는 room이 없으면 404 응답을 반환한다", async () => {
    const supabase = {
      from: vi.fn((table: string) => {
        if (table === "rooms") {
          return {
            select: vi.fn(() => ({
              eq: vi.fn(() => ({
                single: vi.fn().mockResolvedValue({ data: null }),
              })),
            })),
          };
        }

        throw new Error(`unexpected table ${table}`);
      }),
    };

    getSupabaseAdminClientMock.mockReturnValue(supabase);
    getGuestSessionIdMock.mockResolvedValue("guest-2");

    const result = await resolveRoomPlayerRequestContext<{
      id: string;
      code: string;
    }>({
      code: "ABC123",
      guestMode: "get",
      roomSelect: "id, code",
    });

    expect(result.ok).toBe(false);

    if (result.ok) {
      throw new Error("expected failure result");
    }

    expect(result.response.status).toBe(404);
    await expect(result.response.json()).resolves.toEqual({
      message: "해당 코드를 가진 방이 없습니다.",
    });
  });

  it("room player request context는 room lookup error를 500으로 반환한다", async () => {
    const supabase = {
      from: vi.fn((table: string) => {
        if (table === "rooms") {
          return {
            select: vi.fn(() => ({
              eq: vi.fn(() => ({
                single: vi.fn().mockResolvedValue({ data: null, error: new Error("db down") }),
              })),
            })),
          };
        }

        throw new Error(`unexpected table ${table}`);
      }),
    };

    getSupabaseAdminClientMock.mockReturnValue(supabase);
    getGuestSessionIdMock.mockResolvedValue("guest-2");

    const result = await resolveRoomPlayerRequestContext<{ id: string; code: string }>({
      code: "ABC123",
      guestMode: "get",
      roomSelect: "id, code",
    });

    expect(result.ok).toBe(false);

    if (result.ok) {
      throw new Error("expected failure result");
    }

    expect(result.response.status).toBe(500);
    await expect(result.response.json()).resolves.toEqual({
      message: "방 정보를 불러오는 중 문제가 발생했습니다.",
    });
  });

  it("room player request context는 player lookup error를 500으로 반환한다", async () => {
    const supabase = {
      from: vi.fn((table: string) => {
        if (table === "rooms") {
          return {
            select: vi.fn(() => ({
              eq: vi.fn(() => ({
                single: vi.fn().mockResolvedValue({
                  data: { id: "room-1", code: "ABC123" },
                  error: null,
                }),
              })),
            })),
          };
        }

        if (table === "room_players") {
          return {
            select: vi.fn(() => ({
              eq: vi.fn().mockResolvedValue({ data: null, error: new Error("db down") }),
            })),
          };
        }

        throw new Error(`unexpected table ${table}`);
      }),
    };

    getSupabaseAdminClientMock.mockReturnValue(supabase);
    getGuestSessionIdMock.mockResolvedValue("guest-2");

    const result = await resolveRoomPlayerRequestContext<{ id: string; code: string }>({
      code: "ABC123",
      guestMode: "get",
      roomSelect: "id, code",
    });

    expect(result.ok).toBe(false);

    if (result.ok) {
      throw new Error("expected failure result");
    }

    expect(result.response.status).toBe(500);
    await expect(result.response.json()).resolves.toEqual({
      message: "방 참가 정보를 불러오는 중 문제가 발생했습니다.",
    });
  });
});
