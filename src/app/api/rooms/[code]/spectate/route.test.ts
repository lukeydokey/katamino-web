import { beforeEach, describe, expect, it, vi } from "vitest";

const { ensureGuestSessionIdMock, getSupabaseAdminClientMock } = vi.hoisted(() => ({
  ensureGuestSessionIdMock: vi.fn(),
  getSupabaseAdminClientMock: vi.fn(),
}));

vi.mock("@/lib/guest-session", () => ({
  ensureGuestSessionId: ensureGuestSessionIdMock,
}));

vi.mock("@/lib/supabase/admin", () => ({
  getSupabaseAdminClient: getSupabaseAdminClientMock,
}));

import { POST } from "./route";

describe("POST /api/rooms/[code]/spectate", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("admin client가 없으면 503을 반환한다", async () => {
    getSupabaseAdminClientMock.mockReturnValue(null);
    const response = await POST(new Request("http://localhost/api/rooms/ABC123/spectate"), {
      params: Promise.resolve({ code: "ABC123" }),
    });
    expect(response.status).toBe(503);
  });

  it("guest session이 없으면 401을 반환한다", async () => {
    getSupabaseAdminClientMock.mockReturnValue({});
    ensureGuestSessionIdMock.mockResolvedValue(null);
    const response = await POST(new Request("http://localhost/api/rooms/ABC123/spectate"), {
      params: Promise.resolve({ code: "ABC123" }),
    });
    expect(response.status).toBe(401);
  });

  it("room이 없으면 404를 반환한다", async () => {
    const supabase = {
      from: vi.fn(() => ({
        select: vi.fn(() => ({ eq: vi.fn(() => ({ single: vi.fn().mockResolvedValue({ data: null }) })) })),
      })),
    };
    getSupabaseAdminClientMock.mockReturnValue(supabase);
    ensureGuestSessionIdMock.mockResolvedValue("guest-1");
    const response = await POST(new Request("http://localhost/api/rooms/ABC123/spectate"), {
      params: Promise.resolve({ code: "ABC123" }),
    });
    expect(response.status).toBe(404);
  });

  it("이미 player면 spectator upsert 없이 player 응답을 반환한다", async () => {
    const upsertMock = vi.fn();
    const supabase = {
      from: vi.fn((table: string) => {
        if (table === "rooms") {
          return { select: vi.fn(() => ({ eq: vi.fn(() => ({ single: vi.fn().mockResolvedValue({ data: { id: "room-1", code: "ABC123" } }) })) })) };
        }
        if (table === "room_players") {
          return { select: vi.fn(() => ({ eq: vi.fn(() => ({ eq: vi.fn(() => ({ maybeSingle: vi.fn().mockResolvedValue({ data: { guest_id: "guest-1" } }) })) })) })) };
        }
        if (table === "room_spectators") {
          return { upsert: upsertMock };
        }
        throw new Error(`unexpected table ${table}`);
      }),
    };
    getSupabaseAdminClientMock.mockReturnValue(supabase);
    ensureGuestSessionIdMock.mockResolvedValue("guest-1");
    const response = await POST(new Request("http://localhost/api/rooms/ABC123/spectate"), {
      params: Promise.resolve({ code: "ABC123" }),
    });
    expect(upsertMock).not.toHaveBeenCalled();
    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({ roomCode: "ABC123", role: "player" });
  });

  it("spectator upsert 성공 시 spectator 응답을 반환한다", async () => {
    const upsertMock = vi.fn().mockResolvedValue({ error: null });
    const supabase = {
      from: vi.fn((table: string) => {
        if (table === "rooms") {
          return { select: vi.fn(() => ({ eq: vi.fn(() => ({ single: vi.fn().mockResolvedValue({ data: { id: "room-1", code: "ABC123" } }) })) })) };
        }
        if (table === "room_players") {
          return { select: vi.fn(() => ({ eq: vi.fn(() => ({ eq: vi.fn(() => ({ maybeSingle: vi.fn().mockResolvedValue({ data: null }) })) })) })) };
        }
        if (table === "room_spectators") {
          return { upsert: upsertMock };
        }
        throw new Error(`unexpected table ${table}`);
      }),
    };
    getSupabaseAdminClientMock.mockReturnValue(supabase);
    ensureGuestSessionIdMock.mockResolvedValue("guest-1");
    const response = await POST(new Request("http://localhost/api/rooms/ABC123/spectate"), {
      params: Promise.resolve({ code: "ABC123" }),
    });
    expect(upsertMock).toHaveBeenCalledWith({ room_id: "room-1", guest_id: "guest-1" });
    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({ roomCode: "ABC123", role: "spectator" });
  });

  it("spectator upsert 실패 시 500을 반환한다", async () => {
    const upsertMock = vi.fn().mockResolvedValue({ error: new Error("upsert failed") });
    const supabase = {
      from: vi.fn((table: string) => {
        if (table === "rooms") {
          return { select: vi.fn(() => ({ eq: vi.fn(() => ({ single: vi.fn().mockResolvedValue({ data: { id: "room-1", code: "ABC123" } }) })) })) };
        }
        if (table === "room_players") {
          return { select: vi.fn(() => ({ eq: vi.fn(() => ({ eq: vi.fn(() => ({ maybeSingle: vi.fn().mockResolvedValue({ data: null }) })) })) })) };
        }
        if (table === "room_spectators") {
          return { upsert: upsertMock };
        }
        throw new Error(`unexpected table ${table}`);
      }),
    };
    getSupabaseAdminClientMock.mockReturnValue(supabase);
    ensureGuestSessionIdMock.mockResolvedValue("guest-1");
    const response = await POST(new Request("http://localhost/api/rooms/ABC123/spectate"), {
      params: Promise.resolve({ code: "ABC123" }),
    });
    expect(response.status).toBe(500);
  });
});
