import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createInitialGameSession } from "@/domain/katamino/game-state";

const { resolveRoomPlayerRequestContextMock } = vi.hoisted(() => ({
  resolveRoomPlayerRequestContextMock: vi.fn(),
}));

vi.mock("@/lib/rooms/request-context", () => ({
  resolveRoomPlayerRequestContext: resolveRoomPlayerRequestContextMock,
}));

import { POST } from "./route";

describe("POST /api/rooms/rematch", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("shared context가 실패하면 해당 응답을 그대로 반환한다", async () => {
    resolveRoomPlayerRequestContextMock.mockResolvedValue({
      ok: false,
      response: Response.json({ message: "인증된 guest 세션이 필요합니다." }, { status: 401 }),
    });

    const response = await POST(
      new Request("http://localhost/api/rooms/rematch", {
        method: "POST",
        body: JSON.stringify({ code: "ABC123" }),
      }),
    );

    expect(response.status).toBe(401);
  });

  it("malformed JSON이면 400을 반환한다", async () => {
    const response = await POST(
      new Request("http://localhost/api/rooms/rematch", {
        method: "POST",
        body: "{",
        headers: { "Content-Type": "application/json" },
      }),
    );

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toEqual({ message: "code가 필요합니다." });
  });

  it("requester가 없으면 403을 반환한다", async () => {
    resolveRoomPlayerRequestContextMock.mockResolvedValue({
      ok: true,
      supabase: {},
      guestId: "guest-2",
      room: { id: "room-1", code: "ABC123", status: "finished", turn_time_seconds: 30 },
      players: [],
      requester: null,
    });

    const response = await POST(
      new Request("http://localhost/api/rooms/rematch", {
        method: "POST",
        body: JSON.stringify({ code: "ABC123" }),
      }),
    );

    expect(response.status).toBe(403);
    await expect(response.json()).resolves.toEqual({ message: "방 참가자만 다시 시작할 수 있습니다." });
  });

  it("host가 아니면 403을 반환한다", async () => {
    resolveRoomPlayerRequestContextMock.mockResolvedValue({
      ok: true,
      supabase: {},
      guestId: "guest-2",
      room: { id: "room-1", code: "ABC123", status: "finished", turn_time_seconds: 30 },
      players: [{ guestId: "guest-2", seat: "guest" }],
      requester: { guestId: "guest-2", seat: "guest" },
    });

    const response = await POST(
      new Request("http://localhost/api/rooms/rematch", {
        method: "POST",
        body: JSON.stringify({ code: "ABC123" }),
      }),
    );

    expect(response.status).toBe(403);
    await expect(response.json()).resolves.toEqual({ message: "host만 다시 시작할 수 있습니다." });
  });

  it("성공 시 room game을 초기화하고 room status를 playing으로 바꾼다", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-07-28T12:00:00.000Z"));

    const finishedState = { ...createInitialGameSession(), phase: "finished" as const };
    const roomGameUpdateMaybeSingleMock = vi.fn().mockResolvedValue({ data: { version: 2 }, error: null });
    const roomGameUpdateMock = vi.fn(() => ({
      eq: vi.fn(() => ({
        eq: vi.fn(() => ({
          select: vi.fn(() => ({ maybeSingle: roomGameUpdateMaybeSingleMock })),
        })),
      })),
    }));
    const roomUpdateEqMock = vi.fn().mockResolvedValue({ error: null });
    const roomUpdateMock = vi.fn(() => ({ eq: roomUpdateEqMock }));
    const supabase = {
      from: vi.fn((table: string) => {
        if (table === "room_games") {
          return {
            select: vi.fn(() => ({
              eq: vi.fn(() => ({
                single: vi.fn().mockResolvedValue({ data: { state_json: finishedState, version: 1 } }),
              })),
            })),
            update: roomGameUpdateMock,
          };
        }

        if (table === "rooms") {
          return {
            update: roomUpdateMock,
          };
        }

        throw new Error(`unexpected table ${table}`);
      }),
    };

    resolveRoomPlayerRequestContextMock.mockResolvedValue({
      ok: true,
      supabase,
      guestId: "guest-1",
      room: { id: "room-1", code: "ABC123", status: "finished", turn_time_seconds: 30 },
      players: [
        { guestId: "guest-1", seat: "host" },
        { guestId: "guest-2", seat: "guest" },
      ],
      requester: { guestId: "guest-1", seat: "host" },
    });

    const response = await POST(
      new Request("http://localhost/api/rooms/rematch", {
        method: "POST",
        body: JSON.stringify({ code: "ABC123" }),
      }),
    );

    expect(roomGameUpdateMock).toHaveBeenCalled();
    expect(roomUpdateMock).toHaveBeenCalledWith({ status: "playing" });
    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toMatchObject({ ok: true });
  });
});
