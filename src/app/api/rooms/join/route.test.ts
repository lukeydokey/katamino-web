import { beforeEach, describe, expect, it, vi } from "vitest";

const { resolveRoomRequestContextMock } = vi.hoisted(() => ({
  resolveRoomRequestContextMock: vi.fn(),
}));

vi.mock("@/lib/rooms/request-context", () => ({
  resolveRoomRequestContext: resolveRoomRequestContextMock,
}));

import { POST } from "./route";

describe("POST /api/rooms/join", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("code가 없으면 400을 반환한다", async () => {
    resolveRoomRequestContextMock.mockResolvedValue({
      ok: true,
      supabase: {},
      guestId: "guest-2",
    });

    const response = await POST(
      new Request("http://localhost/api/rooms/join", {
        method: "POST",
        body: JSON.stringify({}),
      }),
    );

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toEqual({ message: "code가 필요합니다." });
  });

  it("malformed JSON이면 400을 반환한다", async () => {
    resolveRoomRequestContextMock.mockResolvedValue({
      ok: true,
      supabase: {},
      guestId: "guest-2",
    });

    const response = await POST(
      new Request("http://localhost/api/rooms/join", {
        method: "POST",
        body: "{",
        headers: { "Content-Type": "application/json" },
      }),
    );

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toEqual({ message: "code가 필요합니다." });
  });

  it("해당 room이 없으면 404를 반환한다", async () => {
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

    resolveRoomRequestContextMock.mockResolvedValue({ ok: true, supabase, guestId: "guest-2" });

    const response = await POST(
      new Request("http://localhost/api/rooms/join", {
        method: "POST",
        body: JSON.stringify({ code: "ABC123" }),
      }),
    );

    expect(response.status).toBe(404);
    await expect(response.json()).resolves.toEqual({ message: "해당 코드를 가진 방이 없습니다." });
  });

  it("이미 참가한 player면 write 없이 player 응답을 반환한다", async () => {
    const insertMock = vi.fn();
    const upsertMock = vi.fn();
    const supabase = {
      from: vi.fn((table: string) => {
        if (table === "rooms") {
          return {
            select: vi.fn(() => ({
              eq: vi.fn(() => ({
                single: vi.fn().mockResolvedValue({
                  data: { id: "room-1", code: "ABC123", status: "waiting" },
                }),
              })),
            })),
          };
        }

        if (table === "room_players") {
          return {
            select: vi.fn(() => ({
              eq: vi.fn(() => Promise.resolve({
                data: [{ guest_id: "guest-2", seat: "guest" }],
              })),
            })),
            insert: insertMock,
          };
        }

        if (table === "room_spectators") {
          return {
            select: vi.fn(() => ({
              eq: vi.fn(() => ({
                eq: vi.fn(() => ({
                  maybeSingle: vi.fn().mockResolvedValue({ data: null }),
                })),
              })),
            })),
            upsert: upsertMock,
          };
        }

        throw new Error(`unexpected table ${table}`);
      }),
    };

    resolveRoomRequestContextMock.mockResolvedValue({ ok: true, supabase, guestId: "guest-2" });

    const response = await POST(
      new Request("http://localhost/api/rooms/join", {
        method: "POST",
        body: JSON.stringify({ code: "ABC123" }),
      }),
    );

    expect(insertMock).not.toHaveBeenCalled();
    expect(upsertMock).not.toHaveBeenCalled();
    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({
      roomCode: "ABC123",
      seat: "guest",
      role: "player",
    });
  });

  it("대기 room에서 guest 자리가 비어 있으면 guest player로 입장한다", async () => {
    const insertMock = vi.fn().mockResolvedValue({ error: null });
    const supabase = {
      from: vi.fn((table: string) => {
        if (table === "rooms") {
          return {
            select: vi.fn(() => ({
              eq: vi.fn(() => ({
                single: vi.fn().mockResolvedValue({
                  data: { id: "room-1", code: "ABC123", status: "waiting" },
                }),
              })),
            })),
          };
        }

        if (table === "room_players") {
          return {
            select: vi.fn(() => ({
              eq: vi.fn(() => Promise.resolve({
                data: [{ guest_id: "guest-1", seat: "host" }],
              })),
            })),
            insert: insertMock,
          };
        }

        if (table === "room_spectators") {
          return {
            select: vi.fn(() => ({
              eq: vi.fn(() => ({
                eq: vi.fn(() => ({
                  maybeSingle: vi.fn().mockResolvedValue({ data: null }),
                })),
              })),
            })),
          };
        }

        throw new Error(`unexpected table ${table}`);
      }),
    };

    resolveRoomRequestContextMock.mockResolvedValue({ ok: true, supabase, guestId: "guest-2" });

    const response = await POST(
      new Request("http://localhost/api/rooms/join", {
        method: "POST",
        body: JSON.stringify({ code: "ABC123" }),
      }),
    );

    expect(insertMock).toHaveBeenCalledWith({
      room_id: "room-1",
      guest_id: "guest-2",
      seat: "guest",
    });
    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({
      roomCode: "ABC123",
      seat: "guest",
      role: "player",
    });
  });

  it("진행 중 room이면 spectator fallback으로 입장한다", async () => {
    const upsertMock = vi.fn().mockResolvedValue({ error: null });
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
                data: [{ guest_id: "guest-1", seat: "host" }],
              })),
            })),
          };
        }

        if (table === "room_spectators") {
          return {
            select: vi.fn(() => ({
              eq: vi.fn(() => ({
                eq: vi.fn(() => ({
                  maybeSingle: vi.fn().mockResolvedValue({ data: null }),
                })),
              })),
            })),
            upsert: upsertMock,
          };
        }

        throw new Error(`unexpected table ${table}`);
      }),
    };

    resolveRoomRequestContextMock.mockResolvedValue({ ok: true, supabase, guestId: "guest-2" });

    const response = await POST(
      new Request("http://localhost/api/rooms/join", {
        method: "POST",
        body: JSON.stringify({ code: "ABC123" }),
      }),
    );

    expect(upsertMock).toHaveBeenCalledWith({
      room_id: "room-1",
      guest_id: "guest-2",
    });
    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({
      roomCode: "ABC123",
      role: "spectator",
    });
  });
});
