import { beforeEach, describe, expect, it, vi } from "vitest";

const { isRoomBackendReadyMock, resolveRoomRequestContextMock } = vi.hoisted(() => ({
  isRoomBackendReadyMock: vi.fn(),
  resolveRoomRequestContextMock: vi.fn(),
}));

vi.mock("@/lib/rooms/request-context", () => ({
  isRoomBackendReady: isRoomBackendReadyMock,
  resolveRoomRequestContext: resolveRoomRequestContextMock,
}));

import { POST } from "./route";

describe("POST /api/guest-session", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("request context가 실패하면 해당 응답을 그대로 반환한다", async () => {
    resolveRoomRequestContextMock.mockResolvedValue({
      ok: false,
      response: Response.json({ message: "Supabase server 환경이 아직 설정되지 않았습니다." }, { status: 503 }),
    });

    const response = await POST();

    expect(response.status).toBe(503);
    await expect(response.json()).resolves.toEqual({
      message: "Supabase server 환경이 아직 설정되지 않았습니다.",
    });
  });

  it("room backend가 준비되지 않았으면 503을 반환한다", async () => {
    resolveRoomRequestContextMock.mockResolvedValue({
      ok: true,
      supabase: { from: vi.fn() },
      guestId: "guest-1",
    });
    isRoomBackendReadyMock.mockResolvedValue(false);

    const response = await POST();

    expect(response.status).toBe(503);
    await expect(response.json()).resolves.toEqual({
      message: "현재는 온라인 룸 기능을 사용할 수 없습니다.",
    });
  });

  it("session과 room backend가 모두 준비되면 ok를 반환한다", async () => {
    resolveRoomRequestContextMock.mockResolvedValue({
      ok: true,
      supabase: { from: vi.fn() },
      guestId: "guest-1",
    });
    isRoomBackendReadyMock.mockResolvedValue(true);

    const response = await POST();

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({ ok: true });
  });
});
