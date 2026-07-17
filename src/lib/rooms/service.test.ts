import { describe, expect, it } from "vitest";
import {
  canStartRoom,
  computeDeadlineAt,
  createInitialRoomSnapshot,
  generateRoomCode,
  getAvailableSeat,
  isDeadlineExpired,
  serializeRoomSnapshot,
  summarizeRoomState,
} from "@/lib/rooms/service";

describe("room service helpers", () => {
  it("룸 코드는 기본적으로 6자리다", () => {
    expect(generateRoomCode(() => 0)).toHaveLength(6);
  });

  it("룸 코드는 헷갈리기 쉬운 문자를 제외한 알파벳에서 생성된다", () => {
    expect(generateRoomCode(() => 0)).toBe("AAAAAA");
  });

  it("빈 방에는 host 좌석이 먼저 배정된다", () => {
    expect(getAvailableSeat([])).toBe("host");
  });

  it("host가 있으면 guest 좌석이 배정된다", () => {
    expect(getAvailableSeat([{ guestId: "g1", seat: "host" }])).toBe("guest");
  });

  it("좌석이 가득 차면 null을 반환한다", () => {
    expect(
      getAvailableSeat([
        { guestId: "g1", seat: "host" },
        { guestId: "g2", seat: "guest" },
      ]),
    ).toBeNull();
  });

  it("waiting 상태에서 두 명이 모두 있으면 게임을 시작할 수 있다", () => {
    expect(
      canStartRoom("waiting", [
        { guestId: "g1", seat: "host" },
        { guestId: "g2", seat: "guest" },
      ]),
    ).toBe(true);
  });

  it("초기 room snapshot은 직렬화 가능해야 한다", () => {
    expect(serializeRoomSnapshot()).toEqual(createInitialRoomSnapshot());
  });

  it("room summary는 시작 가능 여부를 함께 계산한다", () => {
    expect(
      summarizeRoomState("ABC123", "waiting", [
        { guestId: "g1", seat: "host" },
        { guestId: "g2", seat: "guest" },
      ], createInitialRoomSnapshot(), 30, "2026-07-18T00:00:00.000Z"),
    ).toEqual({
      roomCode: "ABC123",
      status: "waiting",
      players: [
        { guestId: "g1", seat: "host" },
        { guestId: "g2", seat: "guest" },
      ],
      canStart: true,
      gameState: createInitialRoomSnapshot(),
      turnTimeSeconds: 30,
      deadlineAt: "2026-07-18T00:00:00.000Z",
    });
  });

  it("deadline helper는 타이머가 없으면 null을 반환한다", () => {
    expect(computeDeadlineAt(0)).toBeNull();
  });

  it("deadline helper는 타이머가 있으면 ISO 날짜를 만든다", () => {
    expect(computeDeadlineAt(30)).toMatch(/T/);
  });

  it("deadline 만료 여부를 판단한다", () => {
    expect(isDeadlineExpired(null)).toBe(false);
    expect(isDeadlineExpired("2000-01-01T00:00:00.000Z")).toBe(true);
  });
});
