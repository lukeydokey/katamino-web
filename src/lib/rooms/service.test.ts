import { describe, expect, it } from "vitest";
import {
  canStartRoom,
  createInitialRoomSnapshot,
  generateRoomCode,
  getAvailableSeat,
  serializeRoomSnapshot,
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
});
