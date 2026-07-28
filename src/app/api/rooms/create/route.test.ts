import { beforeEach, describe, expect, it, vi } from "vitest";

const { generateRoomCodeMock, resolveRoomRequestContextMock } = vi.hoisted(() => ({
  generateRoomCodeMock: vi.fn(),
  resolveRoomRequestContextMock: vi.fn(),
}));

vi.mock("@/lib/rooms/request-context", () => ({
  resolveRoomRequestContext: resolveRoomRequestContextMock,
}));

vi.mock("@/lib/rooms/service", () => ({
  generateRoomCode: generateRoomCodeMock,
}));

import { POST } from "./route";

describe("POST /api/rooms/create", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    generateRoomCodeMock.mockReturnValue("ABC123");
  });

  it("request context가 실패하면 해당 응답을 그대로 반환한다", async () => {
    resolveRoomRequestContextMock.mockResolvedValue({
      ok: false,
      response: Response.json({ message: "인증된 guest 세션이 필요합니다." }, { status: 401 }),
    });

    const response = await POST(new Request("http://localhost/api/rooms/create", { method: "POST" }));

    expect(response.status).toBe(401);
    await expect(response.json()).resolves.toEqual({
      message: "인증된 guest 세션이 필요합니다.",
    });
  });

  it("rooms insert가 실패하면 500을 반환한다", async () => {
    const supabase = {
      from: vi.fn((table: string) => {
        if (table === "rooms") {
          return {
            insert: vi.fn(() => ({
              select: vi.fn(() => ({
                single: vi.fn().mockResolvedValue({ room: null, error: new Error("insert failed") }),
              })),
            })),
          };
        }

        throw new Error(`unexpected table ${table}`);
      }),
    };

    resolveRoomRequestContextMock.mockResolvedValue({
      ok: true,
      supabase,
      guestId: "guest-1",
    });

    const response = await POST(
      new Request("http://localhost/api/rooms/create", {
        method: "POST",
        body: JSON.stringify({ turnTimeSeconds: 30 }),
      }),
    );

    expect(response.status).toBe(500);
    await expect(response.json()).resolves.toEqual({ message: "방 생성에 실패했습니다." });
  });

  it("host insert가 실패하면 500을 반환한다", async () => {
    const eqDeleteMock = vi.fn().mockResolvedValue({ error: null });
    const deleteMock = vi.fn(() => ({ eq: eqDeleteMock }));
    const supabase = {
      from: vi.fn((table: string) => {
        if (table === "rooms") {
          return {
            insert: vi.fn(() => ({
              select: vi.fn(() => ({
                single: vi.fn().mockResolvedValue({
                  data: { id: "room-1", code: "ABC123", status: "waiting" },
                  error: null,
                }),
              })),
            })),
            delete: deleteMock,
          };
        }

        if (table === "room_players") {
          return {
            insert: vi.fn().mockResolvedValue({ error: new Error("player insert failed") }),
          };
        }

        throw new Error(`unexpected table ${table}`);
      }),
    };

    resolveRoomRequestContextMock.mockResolvedValue({
      ok: true,
      supabase,
      guestId: "guest-1",
    });

    const response = await POST(
      new Request("http://localhost/api/rooms/create", {
        method: "POST",
        body: JSON.stringify({ turnTimeSeconds: 30 }),
      }),
    );

    expect(deleteMock).toHaveBeenCalled();
    expect(eqDeleteMock).toHaveBeenCalledWith("id", "room-1");
    expect(response.status).toBe(500);
    await expect(response.json()).resolves.toEqual({ message: "호스트 참가 처리에 실패했습니다." });
  });

  it("host insert 실패 후 cleanup delete가 실패해도 기존 500 응답을 유지한다", async () => {
    const eqDeleteMock = vi.fn().mockResolvedValue({ error: new Error("cleanup failed") });
    const deleteMock = vi.fn(() => ({ eq: eqDeleteMock }));
    const supabase = {
      from: vi.fn((table: string) => {
        if (table === "rooms") {
          return {
            insert: vi.fn(() => ({
              select: vi.fn(() => ({
                single: vi.fn().mockResolvedValue({
                  data: { id: "room-1", code: "ABC123", status: "waiting" },
                  error: null,
                }),
              })),
            })),
            delete: deleteMock,
          };
        }

        if (table === "room_players") {
          return {
            insert: vi.fn().mockResolvedValue({ error: new Error("player insert failed") }),
          };
        }

        throw new Error(`unexpected table ${table}`);
      }),
    };

    resolveRoomRequestContextMock.mockResolvedValue({
      ok: true,
      supabase,
      guestId: "guest-1",
    });

    const response = await POST(
      new Request("http://localhost/api/rooms/create", {
        method: "POST",
        body: JSON.stringify({ turnTimeSeconds: 30 }),
      }),
    );

    expect(deleteMock).toHaveBeenCalled();
    expect(eqDeleteMock).toHaveBeenCalledWith("id", "room-1");
    expect(response.status).toBe(500);
    await expect(response.json()).resolves.toEqual({ message: "호스트 참가 처리에 실패했습니다." });
  });

  it("성공 시 roomCode와 host seat를 반환한다", async () => {
    const supabase = {
      from: vi.fn((table: string) => {
        if (table === "rooms") {
          return {
            insert: vi.fn(() => ({
              select: vi.fn(() => ({
                single: vi.fn().mockResolvedValue({
                  data: { id: "room-1", code: "ABC123", status: "waiting" },
                  error: null,
                }),
              })),
            })),
          };
        }

        if (table === "room_players") {
          return {
            insert: vi.fn().mockResolvedValue({ error: null }),
          };
        }

        throw new Error(`unexpected table ${table}`);
      }),
    };

    resolveRoomRequestContextMock.mockResolvedValue({
      ok: true,
      supabase,
      guestId: "guest-1",
    });

    const response = await POST(
      new Request("http://localhost/api/rooms/create", {
        method: "POST",
        body: JSON.stringify({ turnTimeSeconds: 30 }),
      }),
    );

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({
      roomCode: "ABC123",
      seat: "host",
      turnTimeSeconds: 30,
    });
  });
});
