import { act, renderHook } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { useRoomChatDrawerState } from "./use-room-chat-drawer-state";

describe("useRoomChatDrawerState", () => {
  it("초기 메시지 동기화는 unread를 만들지 않고 baseline seen 상태를 잡는다", () => {
    const { result } = renderHook(({ messageIds }) => useRoomChatDrawerState({ messageIds }), {
      initialProps: { messageIds: ["m1", "m2"] },
    });

    act(() => {
      result.current.syncLatestMessage();
    });

    expect(result.current.lastSeenMessageId).toBe("m2");
    expect(result.current.unreadMessageCount).toBe(0);
  });

  it("drawer가 닫혀 있으면 새 메시지가 unread로 쌓인다", () => {
    const { result, rerender } = renderHook(({ messageIds }) => useRoomChatDrawerState({ messageIds }), {
      initialProps: { messageIds: ["m1"] },
    });

    act(() => {
      result.current.syncLatestMessage();
    });

    rerender({ messageIds: ["m1", "m2", "m3"] });

    expect(result.current.lastSeenMessageId).toBe("m1");
    expect(result.current.unreadMessageCount).toBe(2);
  });

  it("drawer를 열면 최신 메시지를 seen 처리하고 unread를 지운다", () => {
    const { result, rerender } = renderHook(({ messageIds }) => useRoomChatDrawerState({ messageIds }), {
      initialProps: { messageIds: ["m1"] },
    });

    act(() => {
      result.current.syncLatestMessage();
    });

    rerender({ messageIds: ["m1", "m2"] });

    act(() => {
      result.current.openChatDrawer();
    });

    expect(result.current.isChatDrawerOpen).toBe(true);
    expect(result.current.lastSeenMessageId).toBe("m2");
    expect(result.current.unreadMessageCount).toBe(0);
  });

  it("drawer가 열려 있으면 새 메시지가 자동으로 read 상태가 된다", () => {
    const { result, rerender } = renderHook(({ messageIds }) => useRoomChatDrawerState({ messageIds }), {
      initialProps: { messageIds: ["m1"] },
    });

    act(() => {
      result.current.syncLatestMessage();
      result.current.openChatDrawer();
    });

    rerender({ messageIds: ["m1", "m2"] });

    act(() => {
      result.current.syncLatestMessage();
    });

    expect(result.current.lastSeenMessageId).toBe("m2");
    expect(result.current.unreadMessageCount).toBe(0);
  });
});
