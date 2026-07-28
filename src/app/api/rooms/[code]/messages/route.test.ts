import { beforeEach, describe, expect, it, vi } from "vitest";

const { getGuestSessionIdMock, getSupabaseAdminClientMock } = vi.hoisted(() => ({
  getGuestSessionIdMock: vi.fn(),
  getSupabaseAdminClientMock: vi.fn(),
}));

vi.mock("@/lib/guest-session", () => ({
  getGuestSessionId: getGuestSessionIdMock,
}));

vi.mock("@/lib/supabase/admin", () => ({
  getSupabaseAdminClient: getSupabaseAdminClientMock,
}));

import { GET, POST } from "./route";

describe("/api/rooms/[code]/messages", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("GET admin client가 없으면 503을 반환한다", async () => {
    getSupabaseAdminClientMock.mockReturnValue(null);
    const response = await GET(new Request("http://localhost/api/rooms/ABC123/messages"), {
      params: Promise.resolve({ code: "ABC123" }),
    });
    expect(response.status).toBe(503);
  });

  it("GET room이 없으면 404를 반환한다", async () => {
    const supabase = {
      from: vi.fn(() => ({
        select: vi.fn(() => ({ eq: vi.fn(() => ({ single: vi.fn().mockResolvedValue({ data: null }) })) })),
      })),
    };
    getSupabaseAdminClientMock.mockReturnValue(supabase);
    const response = await GET(new Request("http://localhost/api/rooms/ABC123/messages"), {
      params: Promise.resolve({ code: "ABC123" }),
    });
    expect(response.status).toBe(404);
  });

  it("GET은 senderRole이 포함된 메시지 목록을 반환한다", async () => {
    const supabase = {
      from: vi.fn((table: string) => {
        if (table === "rooms") {
          return { select: vi.fn(() => ({ eq: vi.fn(() => ({ single: vi.fn().mockResolvedValue({ data: { id: "room-1" } }) })) })) };
        }
        if (table === "room_players") {
          return { select: vi.fn(() => ({ eq: vi.fn().mockResolvedValue({ data: [{ guest_id: "guest-1", seat: "host" }] }) })) };
        }
        if (table === "room_spectators") {
          return { select: vi.fn(() => ({ eq: vi.fn().mockResolvedValue({ data: [{ guest_id: "spec-1" }] }) })) };
        }
        if (table === "room_messages") {
          return {
            select: vi.fn(() => ({
              eq: vi.fn(() => ({
                order: vi.fn(() => ({
                  limit: vi.fn().mockResolvedValue({
                    data: [
                      { id: "m1", guest_id: "guest-1", body: "hello", created_at: "2026-01-01T00:00:00.000Z" },
                      { id: "m2", guest_id: "spec-1", body: "hi", created_at: "2026-01-01T00:01:00.000Z" },
                    ],
                  }),
                })),
              })),
            })),
          };
        }
        throw new Error(`unexpected table ${table}`);
      }),
    };
    getSupabaseAdminClientMock.mockReturnValue(supabase);
    const response = await GET(new Request("http://localhost/api/rooms/ABC123/messages"), {
      params: Promise.resolve({ code: "ABC123" }),
    });
    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({
      messages: [
        { id: "m1", guest_id: "guest-1", body: "hello", created_at: "2026-01-01T00:00:00.000Z", senderRole: "host" },
        { id: "m2", guest_id: "spec-1", body: "hi", created_at: "2026-01-01T00:01:00.000Z", senderRole: "spectator" },
      ],
    });
  });

  it("POST guest session이 없으면 401을 반환한다", async () => {
    getSupabaseAdminClientMock.mockReturnValue({});
    getGuestSessionIdMock.mockResolvedValue(null);
    const response = await POST(new Request("http://localhost/api/rooms/ABC123/messages", { method: "POST", body: JSON.stringify({ body: "hi" }) }), {
      params: Promise.resolve({ code: "ABC123" }),
    });
    expect(response.status).toBe(401);
  });

  it("POST blank body면 400을 반환한다", async () => {
    getSupabaseAdminClientMock.mockReturnValue({});
    getGuestSessionIdMock.mockResolvedValue("guest-1");
    const response = await POST(new Request("http://localhost/api/rooms/ABC123/messages", { method: "POST", body: JSON.stringify({ body: "   " }) }), {
      params: Promise.resolve({ code: "ABC123" }),
    });
    expect(response.status).toBe(400);
  });

  it("POST malformed JSON이면 400을 반환한다", async () => {
    getSupabaseAdminClientMock.mockReturnValue({});
    getGuestSessionIdMock.mockResolvedValue("guest-1");

    const response = await POST(
      new Request("http://localhost/api/rooms/ABC123/messages", {
        method: "POST",
        body: "{",
        headers: { "Content-Type": "application/json" },
      }),
      { params: Promise.resolve({ code: "ABC123" }) },
    );

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toEqual({ message: "메시지를 입력해 주세요." });
  });

  it("POST 참가자/관전자가 아니면 403을 반환한다", async () => {
    const supabase = {
      from: vi.fn((table: string) => {
        if (table === "rooms") {
          return { select: vi.fn(() => ({ eq: vi.fn(() => ({ single: vi.fn().mockResolvedValue({ data: { id: "room-1" } }) })) })) };
        }
        if (table === "room_players" || table === "room_spectators") {
          return { select: vi.fn(() => ({ eq: vi.fn(() => ({ eq: vi.fn(() => ({ maybeSingle: vi.fn().mockResolvedValue({ data: null }) })) })) })) };
        }
        throw new Error(`unexpected table ${table}`);
      }),
    };
    getSupabaseAdminClientMock.mockReturnValue(supabase);
    getGuestSessionIdMock.mockResolvedValue("guest-1");
    const response = await POST(new Request("http://localhost/api/rooms/ABC123/messages", { method: "POST", body: JSON.stringify({ body: "hi" }) }), {
      params: Promise.resolve({ code: "ABC123" }),
    });
    expect(response.status).toBe(403);
  });

  it("POST 성공 시 ok와 senderRole이 포함된 messageRecord를 반환한다", async () => {
    const supabase = {
      from: vi.fn((table: string) => {
        if (table === "rooms") {
          return { select: vi.fn(() => ({ eq: vi.fn(() => ({ single: vi.fn().mockResolvedValue({ data: { id: "room-1" } }) })) })) };
        }
        if (table === "room_players") {
          return {
            select: vi.fn(() => ({
              eq: vi.fn((field: string, value?: string) => {
                if (field === "room_id" && value === "room-1") {
                  const roomIdScoped = {
                    eq: vi.fn((nestedField: string) => {
                      if (nestedField === "guest_id") {
                        return { maybeSingle: vi.fn().mockResolvedValue({ data: { guest_id: "guest-1" } }) };
                      }

                      throw new Error(`unexpected nested field ${nestedField}`);
                    }),
                  };

                  return new Proxy(roomIdScoped, {
                    get(target, property) {
                      if (property === "then") {
                        return Promise.resolve({ data: [{ guest_id: "guest-1", seat: "host" }] }).then.bind(
                          Promise.resolve({ data: [{ guest_id: "guest-1", seat: "host" }] }),
                        );
                      }

                      return Reflect.get(target, property);
                    },
                  });
                }
                return Promise.resolve({ data: [{ guest_id: "guest-1", seat: "host" }] });
              }),
            })),
          };
        }
        if (table === "room_spectators") {
          return {
            select: vi.fn(() => ({
              eq: vi.fn((field: string, value?: string) => {
                if (field === "room_id" && value === "room-1") {
                  return { eq: vi.fn(() => ({ maybeSingle: vi.fn().mockResolvedValue({ data: null }) })) };
                }
                return Promise.resolve({ data: [] });
              }),
            })),
          };
        }
        if (table === "room_messages") {
          return {
            insert: vi.fn(() => ({
              select: vi.fn(() => ({
                single: vi.fn().mockResolvedValue({
                  data: { id: "m1", guest_id: "guest-1", body: "hi", created_at: "2026-01-01T00:00:00.000Z" },
                  error: null,
                }),
              })),
            })),
          };
        }
        throw new Error(`unexpected table ${table}`);
      }),
    };
    getSupabaseAdminClientMock.mockReturnValue(supabase);
    getGuestSessionIdMock.mockResolvedValue("guest-1");
    const response = await POST(new Request("http://localhost/api/rooms/ABC123/messages", { method: "POST", body: JSON.stringify({ body: "hi" }) }), {
      params: Promise.resolve({ code: "ABC123" }),
    });
    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({
      ok: true,
      messageRecord: { id: "m1", guest_id: "guest-1", body: "hi", created_at: "2026-01-01T00:00:00.000Z", senderRole: "host" },
    });
  });
});
