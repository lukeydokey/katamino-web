import { beforeEach, describe, expect, it, vi } from "vitest";

const { resolveRoomPlayerRequestContextMock } = vi.hoisted(() => ({
  resolveRoomPlayerRequestContextMock: vi.fn(),
}));

vi.mock("@/lib/rooms/request-context", () => ({
  resolveRoomPlayerRequestContext: resolveRoomPlayerRequestContextMock,
}));

import { POST } from "./route";

describe("POST /api/rooms/[code]/role", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("shared context가 실패하면 해당 응답을 그대로 반환한다", async () => {
    resolveRoomPlayerRequestContextMock.mockResolvedValue({
      ok: false,
      response: Response.json({ message: "인증된 guest 세션이 필요합니다." }, { status: 401 }),
    });

    const response = await POST(
      new Request("http://localhost/api/rooms/ABC123/role", {
        method: "POST",
        body: JSON.stringify({ targetRole: "player" }),
      }),
      { params: Promise.resolve({ code: "ABC123" }) },
    );

    expect(response.status).toBe(401);
  });

  it("targetRole이 없으면 400을 반환한다", async () => {
    resolveRoomPlayerRequestContextMock.mockResolvedValue({
      ok: true,
      supabase: {},
      guestId: "guest-2",
      room: { id: "room-1", code: "ABC123", status: "waiting" },
      players: [],
      requester: null,
    });

    const response = await POST(
      new Request("http://localhost/api/rooms/ABC123/role", {
        method: "POST",
        body: JSON.stringify({}),
      }),
      { params: Promise.resolve({ code: "ABC123" }) },
    );

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toEqual({ message: "targetRole이 필요합니다." });
  });

  it("playing room에서는 409를 반환한다", async () => {
    resolveRoomPlayerRequestContextMock.mockResolvedValue({
      ok: true,
      supabase: {},
      guestId: "guest-2",
      room: { id: "room-1", code: "ABC123", status: "playing" },
      players: [],
      requester: null,
    });

    const response = await POST(
      new Request("http://localhost/api/rooms/ABC123/role", {
        method: "POST",
        body: JSON.stringify({ targetRole: "spectator" }),
      }),
      { params: Promise.resolve({ code: "ABC123" }) },
    );

    expect(response.status).toBe(409);
    await expect(response.json()).resolves.toEqual({ message: "게임 진행 중에는 역할을 바꿀 수 없습니다." });
  });

  it("host는 spectator로 전환할 수 없다", async () => {
    resolveRoomPlayerRequestContextMock.mockResolvedValue({
      ok: true,
      supabase: {},
      guestId: "guest-1",
      room: { id: "room-1", code: "ABC123", status: "waiting" },
      players: [{ guestId: "guest-1", seat: "host" }],
      requester: { guestId: "guest-1", seat: "host" },
    });

    const response = await POST(
      new Request("http://localhost/api/rooms/ABC123/role", {
        method: "POST",
        body: JSON.stringify({ targetRole: "spectator" }),
      }),
      { params: Promise.resolve({ code: "ABC123" }) },
    );

    expect(response.status).toBe(403);
    await expect(response.json()).resolves.toEqual({ message: "HOST는 관전으로 전환할 수 없습니다." });
  });

  it("spectator는 guest seat로 승격될 수 있다", async () => {
    const deleteEqGuestMock = vi.fn().mockResolvedValue({ error: null });
    const deleteEqRoomMock = vi.fn(() => ({ eq: deleteEqGuestMock }));
    const deleteMock = vi.fn(() => ({ eq: deleteEqRoomMock }));
    const insertMock = vi.fn().mockResolvedValue({ error: null });
    const supabase = {
      from: vi.fn((table: string) => {
        if (table === "room_spectators") {
          return {
            delete: deleteMock,
          };
        }

        if (table === "room_players") {
          return {
            insert: insertMock,
          };
        }

        throw new Error(`unexpected table ${table}`);
      }),
    };

    resolveRoomPlayerRequestContextMock.mockResolvedValue({
      ok: true,
      supabase,
      guestId: "guest-2",
      room: { id: "room-1", code: "ABC123", status: "waiting" },
      players: [{ guestId: "guest-1", seat: "host" }],
      requester: null,
    });

    const response = await POST(
      new Request("http://localhost/api/rooms/ABC123/role", {
        method: "POST",
        body: JSON.stringify({ targetRole: "player" }),
      }),
      { params: Promise.resolve({ code: "ABC123" }) },
    );

    expect(deleteMock).toHaveBeenCalled();
    expect(insertMock).toHaveBeenCalledWith({
      room_id: "room-1",
      guest_id: "guest-2",
      seat: "guest",
    });
    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({
      ok: true,
      roomCode: "ABC123",
      role: "player",
      seat: "guest",
    });
  });
});
