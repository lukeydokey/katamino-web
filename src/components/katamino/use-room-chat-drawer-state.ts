import { useCallback, useEffect, useMemo, useRef, useState } from "react";

interface UseRoomChatDrawerStateOptions {
  messageIds: string[];
}

export interface RoomChatDrawerState {
  isChatDrawerOpen: boolean;
  showParticipants: boolean;
  lastSeenMessageId: string | null;
  unreadMessageCount: number;
  chatScrollRef: React.RefObject<HTMLDivElement | null>;
  handleChatScroll: (scrollTop: number, scrollHeight: number, clientHeight: number) => void;
  syncLatestMessage: () => void;
  markMessageSeen: (messageId: string | null) => void;
  stickChatToBottom: () => void;
  openChatDrawer: () => void;
  closeChatDrawer: () => void;
  toggleParticipants: () => void;
}

export function useRoomChatDrawerState(
  options: UseRoomChatDrawerStateOptions,
): RoomChatDrawerState {
  const { messageIds } = options;
  const [isChatDrawerOpen, setIsChatDrawerOpen] = useState(false);
  const [showParticipants, setShowParticipants] = useState(false);
  const [lastSeenMessageId, setLastSeenMessageId] = useState<string | null>(null);
  const chatScrollRef = useRef<HTMLDivElement | null>(null);
  const shouldStickChatToBottomRef = useRef(true);
  const lastSeenMessageIdRef = useRef<string | null>(null);

  const latestMessageId = messageIds.at(-1) ?? null;

  const markLatestSeen = useCallback(() => {
    lastSeenMessageIdRef.current = latestMessageId;
    setLastSeenMessageId(latestMessageId);
  }, [latestMessageId]);

  const markMessageSeen = useCallback((messageId: string | null) => {
    lastSeenMessageIdRef.current = messageId;
    setLastSeenMessageId(messageId);
  }, []);

  const syncLatestMessage = useCallback(() => {
    if (!latestMessageId) {
      return;
    }

    if (lastSeenMessageIdRef.current === null || isChatDrawerOpen) {
      markLatestSeen();
    }
  }, [isChatDrawerOpen, latestMessageId, markLatestSeen]);

  const unreadMessageCount = useMemo(() => {
    if (isChatDrawerOpen || messageIds.length === 0) {
      return 0;
    }

    if (!lastSeenMessageId) {
      return messageIds.length;
    }

    const lastSeenIndex = messageIds.findIndex((messageId) => messageId === lastSeenMessageId);

    if (lastSeenIndex < 0) {
      return messageIds.length;
    }

    return Math.max(0, messageIds.length - lastSeenIndex - 1);
  }, [isChatDrawerOpen, lastSeenMessageId, messageIds]);

  const openChatDrawer = useCallback(() => {
    setIsChatDrawerOpen(true);
    markLatestSeen();
  }, [markLatestSeen]);

  const closeChatDrawer = useCallback(() => {
    setIsChatDrawerOpen(false);
  }, []);

  const toggleParticipants = useCallback(() => {
    setShowParticipants((current) => !current);
  }, []);

  const handleChatScroll = useCallback((scrollTop: number, scrollHeight: number, clientHeight: number) => {
    shouldStickChatToBottomRef.current = scrollHeight - scrollTop - clientHeight < 40;
  }, []);

  const stickChatToBottom = useCallback(() => {
    shouldStickChatToBottomRef.current = true;
  }, []);

  useEffect(() => {
    if (!chatScrollRef.current || !shouldStickChatToBottomRef.current) {
      return;
    }

    chatScrollRef.current.scrollTop = chatScrollRef.current.scrollHeight;
  }, [messageIds]);

  return {
    isChatDrawerOpen,
    showParticipants,
    lastSeenMessageId,
    unreadMessageCount,
    chatScrollRef,
    handleChatScroll,
    syncLatestMessage,
    markMessageSeen,
    stickChatToBottom,
    openChatDrawer,
    closeChatDrawer,
    toggleParticipants,
  };
}
