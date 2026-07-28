import { beforeEach, describe, expect, it, vi } from "vitest";

const { getSupabaseAdminClientMock } = vi.hoisted(() => ({
  getSupabaseAdminClientMock: vi.fn(),
}));

vi.mock("@/lib/supabase/admin", () => ({
  getSupabaseAdminClient: getSupabaseAdminClientMock,
}));

import { GET } from "./route";

describe("GET /api/rooms/[code]", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("admin client가 없으면 503을 반환한다", async () => {
    getSupabaseAdminClientMock.mockReturnValue(null);

    const response = await GET(new Request("http://localhost/api/rooms/ABC123"), {
      params: Promise.resolve({ code: "ABC123" }),
    });

    expect(response.status).toBe(503);
  });

  it("room이 없으면 404를 반환한다", async () => {
    const supabase = {
      from: vi.fn(() => ({
        select: vi.fn(() => ({
          eq: vi.fn(() => ({
            single: vi.fn().mockResolvedValue({ data: null }),
          })),
        })),
      })),
    };
    getSupabaseAdminClientMock.mockReturnValue(supabase);

    const response = await GET(new Request("http://localhost/api/rooms/ABC123"), {
      params: Promise.resolve({ code: "ABC123" }),
    });

    expect(response.status).toBe(404);
    await expect(response.json()).resolves.toEqual({ message: "해당 코드를 가진 방이 없습니다." });
  });

  it("정상 room summary를 반환한다", async () => {
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
              eq: vi.fn(() => ({
                order: vi.fn().mockResolvedValue({
                  data: [
                    { guest_id: "guest-1", seat: "host" },
                    { guest_id: "guest-2", seat: "guest" },
                  ],
                }),
              })),
            })),
          };
        }
        if (table === "room_spectators") {
          return {
            select: vi.fn(() => ({
              eq: vi.fn().mockResolvedValue({ data: [{ guest_id: "spec-1" }] }),
            })),
          };
        }
        if (table === "room_games") {
          return {
            select: vi.fn(() => ({
              eq: vi.fn(() => ({
                maybeSingle: vi.fn().mockResolvedValue({ data: null }),
              })),
            })),
          };
        }
        throw new Error(`unexpected table ${table}`);
      }),
    };
    getSupabaseAdminClientMock.mockReturnValue(supabase);

    const response = await GET(new Request("http://localhost/api/rooms/ABC123"), {
      params: Promise.resolve({ code: "ABC123" }),
    });

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({
      roomCode: "ABC123",
      status: "waiting",
      players: [
        { guestId: "guest-1", seat: "host" },
        { guestId: "guest-2", seat: "guest" },
      ],
      spectators: [{ guestId: "spec-1" }],
      canStart: true,
      gameState: null,
      turnTimeSeconds: 30,
      deadlineAt: null,
      spectatorCount: 1,
    });
  });

  it("deadline이 만료된 진행 중 game은 timeout 종료 상태로 반환한다", async () => {
    const roomGameUpdateEqVersionMock = vi.fn().mockResolvedValue({ error: null });
    const roomGameUpdateEqRoomMock = vi.fn(() => ({ eq: roomGameUpdateEqVersionMock }));
    const roomGameUpdateMock = vi.fn(() => ({ eq: roomGameUpdateEqRoomMock }));
    const roomUpdateEqMock = vi.fn().mockResolvedValue({ error: null });
    const roomUpdateMock = vi.fn(() => ({ eq: roomUpdateEqMock }));
    const supabase = {
      from: vi.fn((table: string) => {
        if (table === "rooms") {
          return {
            select: vi.fn(() => ({
              eq: vi.fn(() => ({
                single: vi.fn().mockResolvedValue({
                  data: { id: "room-1", code: "ABC123", status: "playing", turn_time_seconds: 30 },
                }),
              })),
            })),
            update: roomUpdateMock,
          };
        }
        if (table === "room_players") {
          return {
            select: vi.fn(() => ({
              eq: vi.fn(() => ({
                order: vi.fn().mockResolvedValue({ data: [{ guest_id: "guest-1", seat: "host" }] }),
              })),
            })),
          };
        }
        if (table === "room_spectators") {
          return {
            select: vi.fn(() => ({
              eq: vi.fn().mockResolvedValue({ data: [] }),
            })),
          };
        }
        if (table === "room_games") {
          return {
            select: vi.fn(() => ({
              eq: vi.fn(() => ({
                maybeSingle: vi.fn().mockResolvedValue({
                  data: {
                    state_json: {
                      phase: "playing",
                      currentTurnSeat: "host",
                      winnerSeat: null,
                      finishedReason: null,
                      message: null,
                    },
                    version: 1,
                    deadline_at: "2000-01-01T00:00:00.000Z",
                  },
                }),
              })),
            })),
            update: roomGameUpdateMock,
          };
        }
        throw new Error(`unexpected table ${table}`);
      }),
    };
    getSupabaseAdminClientMock.mockReturnValue(supabase);

    const response = await GET(new Request("http://localhost/api/rooms/ABC123"), {
      params: Promise.resolve({ code: "ABC123" }),
    });

    expect(roomGameUpdateMock).toHaveBeenCalled();
    expect(roomUpdateMock).toHaveBeenCalledWith({ status: "finished" });
    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toMatchObject({
      status: "finished",
      gameState: {
        phase: "finished",
        finishedReason: "timeout",
      },
    });
  });
});
