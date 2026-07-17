import { describe, expect, it } from "vitest";
import { verifyGuestSessionValue } from "@/lib/guest-session";

describe("guest session signature", () => {
  it("서명된 값이 아니면 null을 반환한다", () => {
    expect(verifyGuestSessionValue("plain-uuid", "secret-key")).toBeNull();
  });

  it("서명이 변조되면 null을 반환한다", () => {
    const value = "guest-id.invalid-signature";
    expect(verifyGuestSessionValue(value, "secret-key")).toBeNull();
  });
});
