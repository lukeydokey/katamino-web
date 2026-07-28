import { beforeEach, describe, expect, it, vi } from "vitest";
import { createInitialGameSession } from "@/domain/katamino/game-state";

const { resolveRoomPlayerRequestContextMock } = vi.hoisted(() => ({
  resolveRoomPlayerRequestContextMock: vi.fn(),
}));

vi.mock("@/lib/rooms/request-context", () => ({
  resolveRoomPlayerRequestContext: resolveRoomPlayerRequestContextMock,
}));

import { POST } from "./route";

describe("POST /api/rooms/move", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("shared context가 실패하면 해당 응답을 그대로 반환한다", async () => {
    resolveRoomPlayerRequestContextMock.mockResolvedValue({
      ok: false,
      response: Response.json({ message: "인증된 guest 세션이 필요합니다." }, { status: 401 }),
    });

    const response = await POST(
      new Request("http://localhost/api/rooms/move", {
        method: "POST",
        body: JSON.stringify({ code: "ABC123", pieceId: "block12", rotation: 0, x: 3, y: 3 }),
      }),
    );

    expect(response.status).toBe(401);
    await expect(response.json()).resolves.toEqual({ message: "인증된 guest 세션이 필요합니다." });
  });

  it("malformed JSON이면 400을 반환한다", async () => {
    const response = await POST(
      new Request("http://localhost/api/rooms/move", {
        method: "POST",
        body: "{",
        headers: { "Content-Type": "application/json" },
      }),
    );

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toEqual({ message: "필수 move 정보가 부족합니다." });
  });

  it("requester가 없으면 403을 반환한다", async () => {
    resolveRoomPlayerRequestContextMock.mockResolvedValue({
      ok: true,
      supabase: {},
      guestId: "guest-2",
      room: { id: "room-1", code: "ABC123", status: "playing", turn_time_seconds: 30 },
      players: [],
      requester: null,
    });

    const response = await POST(
      new Request("http://localhost/api/rooms/move", {
        method: "POST",
        body: JSON.stringify({ code: "ABC123", pieceId: "block12", rotation: 0, x: 3, y: 3 }),
      }),
    );

    expect(response.status).toBe(403);
    await expect(response.json()).resolves.toEqual({ message: "방 참가자만 둘 수 있습니다." });
  });

  it("현재 턴이 아니면 409를 반환한다", async () => {
    const gameState = createInitialGameSession();
    const supabase = {
      from: vi.fn((table: string) => {
        if (table === "room_games") {
          return {
            select: vi.fn(() => ({
              eq: vi.fn(() => ({
                single: vi.fn().mockResolvedValue({
                  data: {
                    state_json: gameState,
                    version: 1,
                    deadline_at: null,
                  },
                }),
              })),
            })),
          };
        }

        throw new Error(`unexpected table ${table}`);
      }),
    };

    resolveRoomPlayerRequestContextMock.mockResolvedValue({
      ok: true,
      supabase,
      guestId: "guest-2",
      room: { id: "room-1", code: "ABC123", status: "playing", turn_time_seconds: 30 },
      players: [{ guestId: "guest-2", seat: "guest" }],
      requester: { guestId: "guest-2", seat: "guest" },
    });

    const response = await POST(
      new Request("http://localhost/api/rooms/move", {
        method: "POST",
        body: JSON.stringify({ code: "ABC123", pieceId: "block12", rotation: 0, x: 3, y: 3 }),
      }),
    );

    expect(response.status).toBe(409);
    await expect(response.json()).resolves.toEqual({ message: "현재는 상대 턴입니다." });
  });

  it("성공 시 game state를 저장하고 ok를 반환한다", async () => {
    const gameState = createInitialGameSession();
    const maybeSingleMock = vi.fn().mockResolvedValue({ data: { version: 2 }, error: null });
    const updateMock = vi.fn(() => ({
      eq: vi.fn(() => ({
        eq: vi.fn(() => ({
          select: vi.fn(() => ({
            maybeSingle: maybeSingleMock,
          })),
        })),
      })),
    }));
    const supabase = {
      from: vi.fn((table: string) => {
        if (table === "room_games") {
          return {
            select: vi.fn(() => ({
              eq: vi.fn(() => ({
                single: vi.fn().mockResolvedValue({
                  data: {
                    state_json: gameState,
                    version: 1,
                    deadline_at: null,
                  },
                }),
              })),
            })),
            update: updateMock,
          };
        }

        throw new Error(`unexpected table ${table}`);
      }),
    };

    resolveRoomPlayerRequestContextMock.mockResolvedValue({
      ok: true,
      supabase,
      guestId: "guest-1",
      room: { id: "room-1", code: "ABC123", status: "playing", turn_time_seconds: 30 },
      players: [{ guestId: "guest-1", seat: "host" }],
      requester: { guestId: "guest-1", seat: "host" },
    });

    const response = await POST(
      new Request("http://localhost/api/rooms/move", {
        method: "POST",
        body: JSON.stringify({ code: "ABC123", pieceId: "block12", rotation: 0, x: 3, y: 3 }),
      }),
    );

    expect(updateMock).toHaveBeenCalled();
    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toMatchObject({ ok: true });
  });
});
