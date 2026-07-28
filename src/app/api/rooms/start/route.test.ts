import { beforeEach, describe, expect, it, vi, afterEach } from "vitest";
import { createInitialRoomSnapshot } from "@/lib/rooms/service";

const { resolveRoomRequestContextMock } = vi.hoisted(() => ({
  resolveRoomRequestContextMock: vi.fn(),
}));

vi.mock("@/lib/rooms/request-context", () => ({
  resolveRoomRequestContext: resolveRoomRequestContextMock,
}));

import { POST } from "./route";

describe("POST /api/rooms/start", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("code가 없으면 400을 반환한다", async () => {
    resolveRoomRequestContextMock.mockResolvedValue({
      ok: true,
      supabase: {},
      guestId: "guest-1",
    });

    const response = await POST(
      new Request("http://localhost/api/rooms/start", {
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
      guestId: "guest-1",
    });

    const response = await POST(
      new Request("http://localhost/api/rooms/start", {
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

    resolveRoomRequestContextMock.mockResolvedValue({ ok: true, supabase, guestId: "guest-1" });

    const response = await POST(
      new Request("http://localhost/api/rooms/start", {
        method: "POST",
        body: JSON.stringify({ code: "ABC123" }),
      }),
    );

    expect(response.status).toBe(404);
    await expect(response.json()).resolves.toEqual({ message: "해당 코드를 가진 방이 없습니다." });
  });

  it("방 참가자가 아니면 403을 반환한다", async () => {
    const supabase = {
      from: vi.fn((table: string) => {
        if (table === "rooms") {
          return {
            select: vi.fn(() => ({
              eq: vi.fn(() => ({
                single: vi.fn().mockResolvedValue({
                  data: { id: "room-1", code: "ABC123", status: "waiting", turn_time_seconds: 30 },
                }),
              })),
            })),
          };
        }

        if (table === "room_players") {
          return {
            select: vi.fn(() => ({
              eq: vi.fn(() => Promise.resolve({
                data: [{ guest_id: "guest-2", seat: "host" }],
              })),
            })),
          };
        }

        throw new Error(`unexpected table ${table}`);
      }),
    };

    resolveRoomRequestContextMock.mockResolvedValue({ ok: true, supabase, guestId: "guest-1" });

    const response = await POST(
      new Request("http://localhost/api/rooms/start", {
        method: "POST",
        body: JSON.stringify({ code: "ABC123" }),
      }),
    );

    expect(response.status).toBe(403);
    await expect(response.json()).resolves.toEqual({ message: "방 참가자만 게임을 시작할 수 있습니다." });
  });

  it("host가 아니면 403을 반환한다", async () => {
    const supabase = {
      from: vi.fn((table: string) => {
        if (table === "rooms") {
          return {
            select: vi.fn(() => ({
              eq: vi.fn(() => ({
                single: vi.fn().mockResolvedValue({
                  data: { id: "room-1", code: "ABC123", status: "waiting", turn_time_seconds: 30 },
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
                  { guest_id: "guest-1", seat: "guest" },
                  { guest_id: "guest-2", seat: "host" },
                ],
              })),
            })),
          };
        }

        throw new Error(`unexpected table ${table}`);
      }),
    };

    resolveRoomRequestContextMock.mockResolvedValue({ ok: true, supabase, guestId: "guest-1" });

    const response = await POST(
      new Request("http://localhost/api/rooms/start", {
        method: "POST",
        body: JSON.stringify({ code: "ABC123" }),
      }),
    );

    expect(response.status).toBe(403);
    await expect(response.json()).resolves.toEqual({ message: "host만 게임을 시작할 수 있습니다." });
  });

  it("시작 가능한 상태가 아니면 409를 반환한다", async () => {
    const supabase = {
      from: vi.fn((table: string) => {
        if (table === "rooms") {
          return {
            select: vi.fn(() => ({
              eq: vi.fn(() => ({
                single: vi.fn().mockResolvedValue({
                  data: { id: "room-1", code: "ABC123", status: "waiting", turn_time_seconds: 30 },
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

        throw new Error(`unexpected table ${table}`);
      }),
    };

    resolveRoomRequestContextMock.mockResolvedValue({ ok: true, supabase, guestId: "guest-1" });

    const response = await POST(
      new Request("http://localhost/api/rooms/start", {
        method: "POST",
        body: JSON.stringify({ code: "ABC123" }),
      }),
    );

    expect(response.status).toBe(409);
    await expect(response.json()).resolves.toEqual({ message: "현재 상태에서는 게임을 시작할 수 없습니다." });
  });

  it("host와 guest가 모두 있으면 room game을 만들고 상태를 playing으로 바꾼다", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-07-28T12:00:00.000Z"));

    const upsertMock = vi.fn().mockResolvedValue({ error: null });
    const eqUpdateMock = vi.fn().mockResolvedValue({ error: null });
    const updateMock = vi.fn(() => ({ eq: eqUpdateMock }));
    const supabase = {
      from: vi.fn((table: string) => {
        if (table === "rooms") {
          return {
            select: vi.fn(() => ({
              eq: vi.fn(() => ({
                single: vi.fn().mockResolvedValue({
                  data: { id: "room-1", code: "ABC123", status: "waiting", turn_time_seconds: 30 },
                }),
              })),
            })),
            update: updateMock,
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

        if (table === "room_games") {
          return {
            upsert: upsertMock,
          };
        }

        throw new Error(`unexpected table ${table}`);
      }),
    };

    resolveRoomRequestContextMock.mockResolvedValue({ ok: true, supabase, guestId: "guest-1" });

    const response = await POST(
      new Request("http://localhost/api/rooms/start", {
        method: "POST",
        body: JSON.stringify({ code: "ABC123" }),
      }),
    );

    expect(upsertMock).toHaveBeenCalledWith({
      room_id: "room-1",
      state_json: createInitialRoomSnapshot(),
      version: 1,
      deadline_at: "2026-07-28T12:00:30.000Z",
    });
    expect(updateMock).toHaveBeenCalledWith({ status: "playing" });
    expect(eqUpdateMock).toHaveBeenCalledWith("id", "room-1");
    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({ roomCode: "ABC123", started: true });
  });

  it("방 상태 변경이 실패하면 생성한 room game을 cleanup한다", async () => {
    const eqDeleteMock = vi.fn().mockResolvedValue({ error: null });
    const deleteMock = vi.fn(() => ({ eq: eqDeleteMock }));
    const upsertMock = vi.fn().mockResolvedValue({ error: null });
    const eqUpdateMock = vi.fn().mockResolvedValue({ error: new Error("update failed") });
    const updateMock = vi.fn(() => ({ eq: eqUpdateMock }));
    const supabase = {
      from: vi.fn((table: string) => {
        if (table === "rooms") {
          return {
            select: vi.fn(() => ({
              eq: vi.fn(() => ({
                single: vi.fn().mockResolvedValue({
                  data: { id: "room-1", code: "ABC123", status: "waiting", turn_time_seconds: 30 },
                }),
              })),
            })),
            update: updateMock,
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

        if (table === "room_games") {
          return {
            upsert: upsertMock,
            delete: deleteMock,
          };
        }

        throw new Error(`unexpected table ${table}`);
      }),
    };

    resolveRoomRequestContextMock.mockResolvedValue({ ok: true, supabase, guestId: "guest-1" });

    const response = await POST(
      new Request("http://localhost/api/rooms/start", {
        method: "POST",
        body: JSON.stringify({ code: "ABC123" }),
      }),
    );

    expect(upsertMock).toHaveBeenCalled();
    expect(deleteMock).toHaveBeenCalled();
    expect(eqDeleteMock).toHaveBeenCalledWith("room_id", "room-1");
    expect(response.status).toBe(500);
    await expect(response.json()).resolves.toEqual({ message: "방 상태 변경에 실패했습니다." });
  });

  it("방 상태 변경 실패 후 cleanup이 실패해도 기존 500 응답을 유지한다", async () => {
    const eqDeleteMock = vi.fn().mockResolvedValue({ error: new Error("cleanup failed") });
    const deleteMock = vi.fn(() => ({ eq: eqDeleteMock }));
    const upsertMock = vi.fn().mockResolvedValue({ error: null });
    const eqUpdateMock = vi.fn().mockResolvedValue({ error: new Error("update failed") });
    const updateMock = vi.fn(() => ({ eq: eqUpdateMock }));
    const supabase = {
      from: vi.fn((table: string) => {
        if (table === "rooms") {
          return {
            select: vi.fn(() => ({
              eq: vi.fn(() => ({
                single: vi.fn().mockResolvedValue({
                  data: { id: "room-1", code: "ABC123", status: "waiting", turn_time_seconds: 30 },
                }),
              })),
            })),
            update: updateMock,
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

        if (table === "room_games") {
          return {
            upsert: upsertMock,
            delete: deleteMock,
          };
        }

        throw new Error(`unexpected table ${table}`);
      }),
    };

    resolveRoomRequestContextMock.mockResolvedValue({ ok: true, supabase, guestId: "guest-1" });

    const response = await POST(
      new Request("http://localhost/api/rooms/start", {
        method: "POST",
        body: JSON.stringify({ code: "ABC123" }),
      }),
    );

    expect(deleteMock).toHaveBeenCalled();
    expect(eqDeleteMock).toHaveBeenCalledWith("room_id", "room-1");
    expect(response.status).toBe(500);
    await expect(response.json()).resolves.toEqual({ message: "방 상태 변경에 실패했습니다." });
  });
});
