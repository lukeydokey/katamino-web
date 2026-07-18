"use client";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { canPlacePiece } from "@/domain/katamino/board";
import { getPieceColor, rotateMaskClockwise } from "@/domain/katamino/pieces";
import { getSupabaseBrowserClient } from "@/lib/supabase/browser";
import type { LocalGameSession } from "@/domain/katamino/game-state";
import type { RealtimeChannel } from "@supabase/supabase-js";
import type { PieceId, PieceMask, PlayerSeat, RoomStatus } from "@/domain/katamino/types";

interface RoomPlayerRecord {
  guestId: string;
  seat: PlayerSeat;
}

interface RoomSummary {
  roomCode: string;
  status: RoomStatus;
  players: RoomPlayerRecord[];
  spectators: Array<{ guestId: string }>;
  canStart: boolean;
  gameState: LocalGameSession | null;
  turnTimeSeconds: number;
  deadlineAt: string | null;
  spectatorCount: number;
}

interface RoomPageClientProps {
  roomCode: string;
  seat: string | undefined;
  viewerRole: "player" | "spectator" | "viewer";
  guestId?: string;
}

interface RoomMessage {
  id: string;
  guest_id: string;
  body: string;
  created_at: string;
  senderRole: "host" | "guest" | "spectator";
}

type SidebarPanel = "status" | "tray" | "chat";

interface ActivityItem {
  id: string;
  body: string;
  createdAt: string;
}

type RealtimeStatus = "connecting" | "live" | "reconnecting";

function PieceShape({
  mask,
  filledClassName,
  emptyClassName,
  cellClassName,
}: {
  mask: number[][];
  filledClassName: string;
  emptyClassName: string;
  cellClassName: string;
}) {
  return (
    <div className="grid grid-cols-5 gap-0.5">
      {mask.flatMap((row, rowIndex) =>
        row.map((cell, columnIndex) => (
          <div
            key={`${rowIndex}-${columnIndex}`}
            className={`${cellClassName} ${cell === 1 ? filledClassName : emptyClassName}`}
          />
        )),
      )}
    </div>
  );
}

function RoleBadge({
  shortLabel,
  label,
}: {
  shortLabel: string;
  label: string;
}) {
  return (
    <span className="inline-flex items-center gap-2 rounded-full border border-[var(--line)] bg-white px-3 py-1 text-xs font-semibold tracking-[0.08em] text-black/70 uppercase">
      <span className="inline-flex h-5 min-w-5 items-center justify-center rounded-full border border-[var(--line)] bg-[var(--surface-strong)] px-1 text-[11px] leading-none text-black/80">
        {shortLabel}
      </span>
      <span>{label}</span>
    </span>
  );
}

function PeopleIcon() {
  return (
    <svg aria-hidden="true" viewBox="0 0 20 20" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="1.8">
      <path d="M7 8.25a2.75 2.75 0 1 0 0-5.5 2.75 2.75 0 0 0 0 5.5Z" />
      <path d="M2.75 15.75c0-2.35 1.9-4.25 4.25-4.25s4.25 1.9 4.25 4.25" />
      <path d="M14 8.25a2.25 2.25 0 1 0 0-4.5" />
      <path d="M12.75 11.75c1.9.23 3.5 1.59 4 3.42" />
    </svg>
  );
}

function getPreviewCells(mask: number[][], x: number, y: number) {
  const previewCells: Array<{ x: number; y: number }> = [];

  for (let boardX = x - 2; boardX <= x + 2; boardX += 1) {
    for (let boardY = y - 2; boardY <= y + 2; boardY += 1) {
      const maskY = boardY - (y - 2);
      const maskX = boardX - (x - 2);

      if (mask[maskY]?.[maskX] !== 1) {
        continue;
      }

      if (boardX < 0 || boardX > 7 || boardY < 0 || boardY > 7) {
        continue;
      }

      previewCells.push({ x: boardX, y: boardY });
    }
  }

  return previewCells;
}

export function RoomPageClient({ roomCode, seat, viewerRole, guestId }: RoomPageClientProps) {
  const [message, setMessage] = useState<string | null>(null);
  const [isStarting, setIsStarting] = useState(false);
  const [messages, setMessages] = useState<RoomMessage[]>([]);
  const [activityItems, setActivityItems] = useState<ActivityItem[]>([]);
  const [chatInput, setChatInput] = useState("");
  const [roomSummary, setRoomSummary] = useState<RoomSummary | null>(null);
  const [roleOverride, setRoleOverride] = useState<RoomPageClientProps["viewerRole"] | null>(null);
  const [seatOverride, setSeatOverride] = useState<string | undefined>(undefined);
  const [isResolvingEntry, setIsResolvingEntry] = useState(false);
  const [isSwitchingRole, setIsSwitchingRole] = useState(false);
  const [selectedPieceId, setSelectedPieceId] = useState<PieceId | null>(null);
  const [rotation, setRotation] = useState(0);
  const [hoveredBoardCell, setHoveredBoardCell] = useState<{ x: number; y: number } | null>(null);
  const [pendingPlacementCell, setPendingPlacementCell] = useState<{ x: number; y: number } | null>(null);
  const [isCoarsePointer, setIsCoarsePointer] = useState(false);
  const [activeSidebarPanel, setActiveSidebarPanel] = useState<SidebarPanel>("status");
  const [showParticipants, setShowParticipants] = useState(false);
  const [realtimeStatus, setRealtimeStatus] = useState<RealtimeStatus>("connecting");
  const [reconnectNonce, setReconnectNonce] = useState(0);
  const [nowTick, setNowTick] = useState(() => Date.now());
  const selectedPieceIdRef = useRef<PieceId | null>(null);
  const roomSummaryRef = useRef<RoomSummary | null>(null);
  const roomChannelRef = useRef<RealtimeChannel | null>(null);
  const boardArticleRef = useRef<HTMLElement | null>(null);
  const chatScrollRef = useRef<HTMLDivElement | null>(null);
  const shouldStickChatToBottomRef = useRef(true);
  const realtimeStatusRef = useRef<RealtimeStatus>("connecting");
  const reconnectTimerRef = useRef<number | null>(null);

  const joinedPlayer = guestId ? roomSummary?.players.find((player) => player.guestId === guestId) : undefined;
  const joinedSpectator = guestId ? roomSummary?.spectators.find((spectator) => spectator.guestId === guestId) : undefined;
  const effectiveViewerRole =
    roleOverride ?? (joinedPlayer ? "player" : joinedSpectator ? "spectator" : viewerRole);
  const effectiveSeat = seatOverride ?? joinedPlayer?.seat ?? seat;
  const normalizedSeat = effectiveSeat === "host" || effectiveSeat === "guest" ? effectiveSeat : undefined;
  const playerCount = roomSummary?.players.length ?? 0;
  const canStart = normalizedSeat === "host" && roomSummary?.canStart;
  const gameState = roomSummary?.gameState ?? null;
  const selectedPiece = selectedPieceId && gameState ? gameState.pieces[selectedPieceId] : null;
  const isWaitingRoom = roomSummary?.status === "waiting";
  const isPlayingRoom = roomSummary?.status === "playing";
  const isFinishedRoom = roomSummary?.status === "finished" || gameState?.phase === "finished";

  const previewMask = useMemo(() => {
    if (!selectedPiece) {
      return null;
    }

    let nextMask: PieceMask = selectedPiece.initialMask.map((row) => [...row]);

    for (let index = 0; index < rotation; index += 1) {
      nextMask = rotateMaskClockwise(nextMask);
    }

    return nextMask;
  }, [rotation, selectedPiece]);

  const activePreviewCell = isCoarsePointer ? pendingPlacementCell : hoveredBoardCell;
  const canPlaceAtHoveredCell =
    gameState && previewMask && activePreviewCell
      ? canPlacePiece(gameState.board, previewMask, activePreviewCell.x, activePreviewCell.y)
      : false;
  const previewCells =
    previewMask && activePreviewCell
      ? getPreviewCells(previewMask, activePreviewCell.x, activePreviewCell.y)
      : [];
  const previewCellMap = new Map(previewCells.map((cell) => [`${cell.x}-${cell.y}`, cell]));

  const roomStatusLabel = useMemo(() => {
    if (!roomSummary) {
      return "불러오는 중";
    }

    if (roomSummary.status === "waiting") {
      return "대기 중";
    }

    if (roomSummary.status === "playing") {
      return "진행 중";
    }

    return "종료됨";
  }, [roomSummary]);

  const canPlayTurn = gameState && normalizedSeat === gameState.currentTurnSeat;
  const spectatorCount = roomSummary?.spectatorCount ?? 0;
  const canChat = effectiveViewerRole === "player" || effectiveViewerRole === "spectator";
  const showTrayPanel = Boolean(gameState);
  const resolvedSidebarPanel = !showTrayPanel && activeSidebarPanel === "tray" ? "status" : activeSidebarPanel;

  const seatLabel = normalizedSeat === "host" ? "HOST" : normalizedSeat === "guest" ? "GUEST" : effectiveViewerRole === "spectator" ? "SPECTATOR" : "미확인";

  const roomHeadline = useMemo(() => {
    if (!roomSummary) {
      return "룸 상태를 불러오는 중입니다.";
    }

    if (isWaitingRoom) {
      return canStart ? "상대가 모두 들어왔습니다. 게임을 시작할 수 있습니다." : "상대가 방에 들어오기를 기다리는 중입니다.";
    }

    if (isPlayingRoom) {
      return canPlayTurn ? "지금은 내 차례입니다. 둘 블록과 위치를 정해 보세요." : "상대 차례입니다. 보드가 자동으로 갱신됩니다.";
    }

    return "현재 게임이 종료된 상태입니다.";
  }, [canPlayTurn, canStart, isPlayingRoom, isWaitingRoom, roomSummary]);

  const roomHint = useMemo(() => {
    if (!roomSummary) {
      return "잠시만 기다리면 최신 상태를 불러옵니다.";
    }

    if (isWaitingRoom) {
      return normalizedSeat === "host"
        ? "룸 코드를 공유하고 상대가 참가하면 바로 시작할 수 있습니다."
        : "호스트가 게임을 시작하면 자동으로 보드가 열립니다.";
    }

    if (isPlayingRoom) {
      return normalizedSeat === gameState?.currentTurnSeat
        ? "블록을 선택하고 보드 위에 올리면 배치 가능 여부를 바로 확인할 수 있습니다."
        : "상대가 수를 두면 이 화면도 곧바로 갱신됩니다.";
    }

    return normalizedSeat === "host"
      ? "같은 상대와 바로 다시 시작할 수 있습니다. 준비가 되면 다시 시작해 보세요."
      : "호스트가 다시 시작하면 곧 새 판이 열립니다.";
  }, [gameState?.currentTurnSeat, isPlayingRoom, isWaitingRoom, normalizedSeat, roomSummary]);

  const resultLabel = useMemo(() => {
    if (!isFinishedRoom) {
      return null;
    }

    if (!normalizedSeat) {
      return effectiveViewerRole === "spectator" ? "관전 완료" : "게임 종료";
    }

    if (!gameState?.winnerSeat) {
      return "게임 종료";
    }

    if (gameState.winnerSeat === normalizedSeat) {
      return "승리";
    }

    return "패배";
  }, [effectiveViewerRole, gameState?.winnerSeat, isFinishedRoom, normalizedSeat]);

  const finishedReasonLabel = useMemo(() => {
    switch (gameState?.finishedReason) {
      case "forfeit":
        return "기권으로 종료";
      case "timeout":
        return "시간 초과로 종료";
      case "completed":
        return "정상 종료";
      default:
        return null;
    }
  }, [gameState?.finishedReason]);

  const turnCountLabel = useMemo(() => {
    if (!gameState?.turnNumber) {
      return null;
    }

    return `${Math.max(0, gameState.turnNumber - 1)}수 진행`;
  }, [gameState?.turnNumber]);

  const nextStepLabel = useMemo(() => {
    if (!isFinishedRoom) {
      return null;
    }

    if (effectiveViewerRole === "spectator") {
      return "다음 판이 열리면 같은 방에서 계속 관전할 수 있습니다.";
    }

    if (!normalizedSeat) {
      return "방 상태를 지켜보며 다음 진행을 기다려 주세요.";
    }

    if (normalizedSeat === "host") {
      return "준비가 되면 같은 룸에서 다시 시작해 다음 판을 바로 열 수 있습니다.";
    }

    return "호스트가 다시 시작하면 같은 방에서 다음 판이 자동으로 열립니다.";
  }, [effectiveViewerRole, isFinishedRoom, normalizedSeat]);

  const messageToneClass = useMemo(() => {
    if (!message) {
      return "border-[var(--line)] bg-white text-black/70";
    }

    if (message.includes("실패") || message.includes("불가")) {
      return "border-rose-200 bg-rose-50 text-rose-700";
    }

    if (message.includes("완료") || message.includes("복사") || message.includes("시작")) {
      return "border-emerald-200 bg-emerald-50 text-emerald-700";
    }

    return "border-[var(--line)] bg-white text-black/70";
  }, [message]);

  const realtimeStatusLabel =
    realtimeStatus === "live" ? "실시간 연결됨" : realtimeStatus === "reconnecting" ? "재연결 중" : "연결 중";

  const remainingSeconds = (() => {
    if (!roomSummary?.deadlineAt) {
      return null;
    }

    return Math.max(0, Math.ceil((new Date(roomSummary.deadlineAt).getTime() - nowTick) / 1000));
  })();

  const timerUrgencyClass =
    remainingSeconds === null
      ? "text-black/70"
      : remainingSeconds <= 5
        ? "text-rose-700"
        : remainingSeconds <= 10
          ? "text-amber-700"
          : "text-emerald-700";

  useEffect(() => {
    if (!roomSummary?.deadlineAt) {
      return;
    }

    const intervalId = window.setInterval(() => {
      setNowTick(Date.now());
    }, 1000);

    return () => {
      window.clearInterval(intervalId);
    };
  }, [roomSummary?.deadlineAt]);

  useEffect(() => {
    const mediaQuery = window.matchMedia("(pointer: coarse)");

    const syncPointerType = () => {
      setIsCoarsePointer(mediaQuery.matches);
    };

    syncPointerType();
    mediaQuery.addEventListener("change", syncPointerType);

    return () => {
      mediaQuery.removeEventListener("change", syncPointerType);
    };
  }, []);

  async function copyRoomCode() {
    try {
      await navigator.clipboard.writeText(roomCode);
      setMessage("룸 코드를 복사했습니다.");
    } catch {
      setMessage("룸 코드 복사에 실패했습니다.");
    }
  }

  useEffect(() => {
    selectedPieceIdRef.current = selectedPieceId;
  }, [selectedPieceId]);

  useEffect(() => {
    roomSummaryRef.current = roomSummary;
  }, [roomSummary]);

  useEffect(() => {
    realtimeStatusRef.current = realtimeStatus;
  }, [realtimeStatus]);

  const fetchMessages = useCallback(async () => {
    const response = await fetch(`/api/rooms/${roomCode}/messages`, {
      method: "GET",
      cache: "no-store",
    });

    if (!response.ok) {
      return false;
    }

    const payload = (await response.json()) as { messages: RoomMessage[] };
    setMessages(payload.messages ?? []);
    return true;
  }, [roomCode]);

  const fetchRoomSummary = useCallback(async () => {
    const response = await fetch(`/api/rooms/${roomCode}`, {
      method: "GET",
      cache: "no-store",
    });

    if (!response.ok) {
      return false;
    }

    const payload = (await response.json()) as RoomSummary;
    const previousSummary = roomSummaryRef.current;
    setRoomSummary(payload);

    if (previousSummary) {
      const previousSeats = new Set(previousSummary.players.map((player) => player.seat));
      const nextSeats = new Set(payload.players.map((player) => player.seat));

      if (!previousSeats.has("guest") && nextSeats.has("guest")) {
        setActivityItems((current) => [
          ...current.slice(-7),
          { id: `${Date.now()}-guest-join`, body: "GUEST가 입장했습니다.", createdAt: new Date().toISOString() },
        ]);
      }

      if (previousSeats.has("guest") && !nextSeats.has("guest")) {
        setActivityItems((current) => [
          ...current.slice(-7),
          { id: `${Date.now()}-guest-leave`, body: "GUEST가 자리를 비웠습니다.", createdAt: new Date().toISOString() },
        ]);
      }

      const spectatorDelta = payload.spectatorCount - previousSummary.spectatorCount;

      if (spectatorDelta !== 0) {
        setActivityItems((current) => [
          ...current.slice(-7),
          {
            id: `${Date.now()}-spectator-delta`,
            body:
              spectatorDelta > 0
                ? `관전자 ${spectatorDelta}명이 입장했습니다.`
                : `관전자 ${Math.abs(spectatorDelta)}명이 퇴장했습니다.`,
            createdAt: new Date().toISOString(),
          },
        ]);
      }
    }

    const currentSelectedPieceId = selectedPieceIdRef.current;
    const turnNumberReset =
      previousSummary?.gameState && payload.gameState
        ? payload.gameState.turnNumber < previousSummary.gameState.turnNumber
        : false;

    if (
      currentSelectedPieceId &&
      (payload.gameState?.usedPieceIds.includes(currentSelectedPieceId) ||
        payload.status !== "playing" ||
        payload.gameState?.phase !== "playing" ||
        turnNumberReset)
    ) {
      setSelectedPieceId(null);
      setRotation(0);
      setHoveredBoardCell(null);
      setPendingPlacementCell(null);
    }

    return true;
  }, [roomCode]);

  const refetchRoomAndMessages = useCallback(async () => {
    await Promise.all([fetchRoomSummary(), fetchMessages()]);
  }, [fetchMessages, fetchRoomSummary]);

  const scheduleReconnect = useCallback(() => {
    if (reconnectTimerRef.current !== null) {
      return;
    }

    reconnectTimerRef.current = window.setTimeout(() => {
      reconnectTimerRef.current = null;
      setReconnectNonce((current) => current + 1);
    }, 1200);
  }, []);

  useEffect(() => {
    if (!chatScrollRef.current || !shouldStickChatToBottomRef.current) {
      return;
    }

    chatScrollRef.current.scrollTop = chatScrollRef.current.scrollHeight;
  }, [messages]);

  useEffect(() => {
    const articleElement = boardArticleRef.current;

    if (!articleElement) {
      return;
    }

    const handleWheel = (event: WheelEvent) => {
      if (!selectedPieceId || !canPlayTurn) {
        return;
      }

      event.preventDefault();
      setRotation((current) => (current + 1) % 4);
      setPendingPlacementCell(null);
    };

    articleElement.addEventListener("wheel", handleWheel, { passive: false });

    return () => {
      articleElement.removeEventListener("wheel", handleWheel);
    };
  }, [canPlayTurn, selectedPieceId]);

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key !== "Escape") {
        return;
      }

      setSelectedPieceId(null);
      setRotation(0);
      setHoveredBoardCell(null);
      setPendingPlacementCell(null);
    };

    window.addEventListener("keydown", handleKeyDown);

    return () => {
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, []);

  useEffect(() => {
    let active = true;
    const client = getSupabaseBrowserClient();

    const initialSyncTimerId = window.setTimeout(() => {
      void refetchRoomAndMessages();
    }, 0);

    const intervalId = window.setInterval(() => {
      if (realtimeStatusRef.current !== "live") {
        void refetchRoomAndMessages();
      }
    }, 4000);

    const channel = client
      ?.channel(`room:${roomCode}`, {
        config: {
          presence: {
            key: normalizedSeat ?? crypto.randomUUID(),
          },
        },
      })
      .on("broadcast", { event: "room-updated" }, () => {
        void refetchRoomAndMessages();
      })
      .on("broadcast", { event: "chat-updated" }, async () => {
        await fetchMessages();
      })
      .on("presence", { event: "sync" }, () => {
        void refetchRoomAndMessages();
      });

    roomChannelRef.current = channel ?? null;

    channel?.subscribe(async (status) => {
      if (!active) {
        return;
      }

      if (status === "SUBSCRIBED") {
        setRealtimeStatus("live");

        if (reconnectTimerRef.current !== null) {
          window.clearTimeout(reconnectTimerRef.current);
          reconnectTimerRef.current = null;
        }

        await channel.track({
          roomCode,
          seat: normalizedSeat ?? "observer",
          role: effectiveViewerRole,
          onlineAt: new Date().toISOString(),
        });
        await refetchRoomAndMessages();
        return;
      }

      if (status === "CHANNEL_ERROR" || status === "TIMED_OUT" || status === "CLOSED") {
        setRealtimeStatus("reconnecting");
        scheduleReconnect();
      }
    });

    const handleVisibilityOrOnline = () => {
      if (document.visibilityState === "hidden") {
        return;
      }

      void refetchRoomAndMessages();

      if (realtimeStatusRef.current !== "live") {
        scheduleReconnect();
      }
    };

    window.addEventListener("online", handleVisibilityOrOnline);
    document.addEventListener("visibilitychange", handleVisibilityOrOnline);

    return () => {
      active = false;
      window.clearTimeout(initialSyncTimerId);
      window.clearInterval(intervalId);
      window.removeEventListener("online", handleVisibilityOrOnline);
      document.removeEventListener("visibilitychange", handleVisibilityOrOnline);

      if (reconnectTimerRef.current !== null) {
        window.clearTimeout(reconnectTimerRef.current);
        reconnectTimerRef.current = null;
      }

      channel?.unsubscribe();
      roomChannelRef.current = null;
    };
  }, [effectiveViewerRole, normalizedSeat, refetchRoomAndMessages, roomCode, scheduleReconnect, reconnectNonce, fetchMessages]);

  useEffect(() => {
    if (effectiveViewerRole !== "viewer" || isResolvingEntry) {
      return;
    }

    let cancelled = false;

    async function autoEnterRoom() {
      setIsResolvingEntry(true);

      try {
        const response = await fetch("/api/rooms/join", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ code: roomCode }),
        });

        const payload = (await response.json()) as { message?: string; role?: "player" | "spectator"; seat?: string };

        if (cancelled) {
          return;
        }

        if (!response.ok || !payload.role) {
          setMessage(payload.message ?? "방 입장에 실패했습니다.");
          return;
        }

        setRoleOverride(payload.role);
        setSeatOverride(payload.seat);
        setMessage(payload.role === "player" ? "guest 자리로 참가했습니다." : "관전으로 입장했습니다.");
      } finally {
        if (!cancelled) {
          setIsResolvingEntry(false);
        }
      }
    }

    void autoEnterRoom();

    return () => {
      cancelled = true;
    };
  }, [effectiveViewerRole, isResolvingEntry, roomCode]);

  async function startRoom() {
    setIsStarting(true);
    setMessage(null);

    try {
      const response = await fetch("/api/rooms/start", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ code: roomCode }),
      });
      const payload = (await response.json()) as { message?: string; started?: boolean };

      if (!response.ok) {
        setMessage(payload.message ?? "게임 시작에 실패했습니다.");
        return;
      }

      await roomChannelRef.current?.send({
          type: "broadcast",
          event: "room-updated",
          payload: {
            roomCode,
            status: "playing",
          },
        });

      setMessage(payload.started ? "게임 시작 준비가 완료되었습니다." : "게임 상태를 확인해주세요.");
    } finally {
      setIsStarting(false);
    }
  }

  async function forfeitRoom() {
    setMessage(null);

    const response = await fetch("/api/rooms/forfeit", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ code: roomCode }),
    });

    const payload = (await response.json()) as { message?: string; state?: LocalGameSession; ok?: boolean };

    if (!response.ok) {
      setMessage(payload.message ?? "기권 처리에 실패했습니다.");
      return;
    }

    setSelectedPieceId(null);
    setRotation(0);
    setHoveredBoardCell(null);
    setPendingPlacementCell(null);

    setRoomSummary((current) =>
      current
        ? {
            ...current,
            status: "finished",
            canStart: false,
            gameState: payload.state ?? current.gameState,
          }
        : current,
    );

    await roomChannelRef.current?.send({
      type: "broadcast",
      event: "room-updated",
      payload: {
        roomCode,
        status: "finished",
      },
    });
  }

  async function requestRematch() {
    setMessage(null);

    const response = await fetch("/api/rooms/rematch", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ code: roomCode }),
    });

    const payload = (await response.json()) as { message?: string; state?: LocalGameSession; ok?: boolean };

    if (!response.ok) {
      setMessage(payload.message ?? "다시 시작에 실패했습니다.");
      return;
    }

    setSelectedPieceId(null);
    setRotation(0);
    setHoveredBoardCell(null);
    setPendingPlacementCell(null);
    setRoomSummary((current) =>
      current
        ? {
            ...current,
            status: "playing",
            canStart: false,
            gameState: payload.state ?? current.gameState,
          }
        : current,
    );

    await roomChannelRef.current?.send({
      type: "broadcast",
      event: "room-updated",
      payload: {
        roomCode,
        status: "playing",
      },
    });
  }

  async function switchRoomRole(targetRole: "player" | "spectator") {
    setIsSwitchingRole(true);
    setMessage(null);

    try {
      const response = await fetch(`/api/rooms/${roomCode}/role`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ targetRole }),
      });

      const payload = (await response.json()) as {
        message?: string;
        role?: "player" | "spectator";
        seat?: string;
      };

      if (!response.ok || !payload.role) {
        setMessage(payload.message ?? "역할 전환에 실패했습니다.");
        return;
      }

      setRoleOverride(payload.role);
      setSeatOverride(payload.seat);
      setMessage(payload.role === "player" ? "guest 자리로 전환했습니다." : "관전 상태로 전환했습니다.");
      await roomChannelRef.current?.send({
        type: "broadcast",
        event: "room-updated",
        payload: {
          roomCode,
          status: roomSummary?.status ?? "waiting",
        },
      });
    } finally {
      setIsSwitchingRole(false);
    }
  }

  async function placeMove(x: number, y: number) {
    if (!selectedPieceId) {
      return;
    }

    setMessage(null);

    const response = await fetch("/api/rooms/move", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        code: roomCode,
        pieceId: selectedPieceId,
        rotation,
        x,
        y,
      }),
    });

    const payload = (await response.json()) as { message?: string; state?: LocalGameSession; ok?: boolean };

    if (!response.ok) {
      setMessage(payload.message ?? "블록 배치에 실패했습니다.");
      return;
    }

    setSelectedPieceId(null);
    setRotation(0);
    setHoveredBoardCell(null);
    setPendingPlacementCell(null);
    setRoomSummary((current) =>
      current
        ? {
            ...current,
            gameState: payload.state ?? current.gameState,
            status: "playing",
            canStart: false,
          }
        : current,
    );

    await roomChannelRef.current?.send({
        type: "broadcast",
        event: "room-updated",
        payload: {
          roomCode,
          status: "playing",
        },
      });
  }

  async function sendMessage() {
    const body = chatInput.trim();

    if (!body) {
      return;
    }

    const response = await fetch(`/api/rooms/${roomCode}/messages`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ body }),
    });

    const payload = (await response.json()) as {
      message?: string;
      ok?: boolean;
      messageRecord?: RoomMessage | null;
    };

    if (!response.ok || !payload.ok) {
      setMessage(payload.message ?? "채팅 전송에 실패했습니다.");
      return;
    }

    setChatInput("");
    const messageRecord = payload.messageRecord;
    shouldStickChatToBottomRef.current = true;

    if (messageRecord) {
      setMessages((current) => [...current, messageRecord]);
    }

    await roomChannelRef.current?.send({
      type: "broadcast",
      event: "chat-updated",
      payload: { roomCode },
    });
  }

  async function handleChatKeyDown(event: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (event.nativeEvent.isComposing) {
      return;
    }

    if (event.key === "Enter" && !event.shiftKey) {
      event.preventDefault();
      await sendMessage();
    }
  }

  async function handleBoardCellClick(x: number, y: number) {
    if (effectiveViewerRole !== "player" || !canPlayTurn || !selectedPieceId) {
      return;
    }

    if (isCoarsePointer) {
      if (!pendingPlacementCell || pendingPlacementCell.x !== x || pendingPlacementCell.y !== y) {
        setPendingPlacementCell({ x, y });
        return;
      }
    }

    await placeMove(x, y);
  }

  function formatSenderRole(senderRole: RoomMessage["senderRole"]) {
    switch (senderRole) {
      case "host":
        return "HOST · H";
      case "guest":
        return "GUEST · G";
      default:
        return "SPECTATOR · S";
    }
  }

  const participantItems = useMemo(() => {
    const playerItems = roomSummary?.players.map((player) => ({
      id: `player-${player.guestId}`,
      label: player.seat === "host" ? "HOST" : "GUEST",
      shortLabel: player.seat === "host" ? "H" : "G",
      isYou: player.guestId === guestId,
      detail: player.guestId === guestId ? "나" : "참가 중",
    })) ?? [];

    const spectatorItems = roomSummary?.spectators.map((spectator, index) => ({
      id: `spectator-${spectator.guestId}`,
      label: `SPECTATOR ${index + 1}`,
      shortLabel: "S",
      isYou: spectator.guestId === guestId,
      detail: spectator.guestId === guestId ? "나" : "관전 중",
    })) ?? [];

    return [...playerItems, ...spectatorItems];
  }, [guestId, roomSummary?.players, roomSummary?.spectators]);

  function getSidebarSectionClass(panel: SidebarPanel) {
    const isActive = resolvedSidebarPanel === panel;

    return `${isActive ? "flex" : "hidden"} flex-col gap-3 lg:flex`;
  }

  return (
    <main className="mx-auto flex min-h-screen w-full max-w-5xl flex-col gap-6 px-4 py-6 sm:gap-8 sm:px-6 sm:py-10">
      <section className="rounded-3xl border border-[var(--line)] bg-[var(--surface)] p-4 shadow-sm sm:p-6">
        <p className="text-sm font-semibold tracking-[0.2em] text-[var(--accent)] uppercase">
          Online Room
        </p>
        <div className="mt-2 flex flex-wrap items-start justify-between gap-3">
          <div className="flex flex-col gap-2">
            <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">룸 {roomCode}</h1>
            <p className="text-sm leading-6 text-black/65">{roomHeadline}</p>
          </div>

          <button
            type="button"
            onClick={() => void copyRoomCode()}
            className="rounded-full border border-[var(--line)] bg-white px-4 py-2 text-sm font-medium text-black/75"
          >
            룸 코드 복사
          </button>
        </div>

        <div className="mt-6 flex flex-wrap gap-2 text-sm text-black/70">
          <div className="inline-flex items-center gap-2 rounded-full border border-[var(--line)] bg-white px-4 py-2">
            <span className="text-xs font-semibold tracking-[0.12em] text-black/45 uppercase">좌석</span>
            <span className="font-semibold text-black">{seatLabel}</span>
          </div>
          <div className="inline-flex items-center gap-2 rounded-full border border-[var(--line)] bg-white px-4 py-2">
            <span className="text-xs font-semibold tracking-[0.12em] text-black/45 uppercase">상태</span>
            <span className="font-semibold text-black">{roomStatusLabel}</span>
          </div>
          <div className="inline-flex items-center gap-2 rounded-full border border-[var(--line)] bg-white px-4 py-2">
            <PeopleIcon />
            <span className="font-semibold text-black">{playerCount}</span>
            <span className="text-black/55">/ 2</span>
            <span className="text-black/45">· 관전자 {spectatorCount}</span>
          </div>
          <div className="inline-flex items-center gap-2 rounded-full border border-[var(--line)] bg-white px-4 py-2">
            <span className="text-xs font-semibold tracking-[0.12em] text-black/45 uppercase">턴</span>
            <span className="font-semibold text-black">{roomSummary?.turnTimeSeconds ? `${roomSummary.turnTimeSeconds}초` : "제한 없음"}</span>
          </div>
        </div>

        <div className="mt-6 rounded-2xl bg-[var(--surface-strong)] p-4 text-sm leading-6 text-black/75">
          {roomHint}
        </div>

        {resultLabel ? (
          <div className="mt-4 rounded-2xl border border-[var(--line)] bg-white px-4 py-4">
            <p className="text-xs font-semibold tracking-[0.14em] text-black/45 uppercase">결과</p>
            <p className="mt-2 text-2xl font-bold text-[var(--accent)]">{resultLabel}</p>
            {finishedReasonLabel ? <p className="mt-2 text-sm text-black/65">{finishedReasonLabel}</p> : null}
            {turnCountLabel ? <p className="mt-1 text-sm text-black/55">{turnCountLabel}</p> : null}
            {nextStepLabel ? <p className="mt-3 text-sm leading-6 text-black/70">{nextStepLabel}</p> : null}
          </div>
        ) : null}

      </section>

      {roomSummary ? (
        <section className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_320px]">
          {gameState ? (
            <article
              ref={boardArticleRef}
              className="rounded-3xl border border-[var(--line)] bg-[var(--surface)] p-4 shadow-sm sm:p-6 lg:col-start-1"
            >
              <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
                <div>
                  <h2 className="text-xl font-semibold">공유 게임 보드</h2>
                  <p className="text-sm text-black/60">
                    {effectiveViewerRole === "spectator"
                      ? "관전 중입니다. 보드 상태와 채팅을 실시간으로 확인할 수 있습니다."
                      : canPlayTurn
                        ? "지금은 내 차례입니다. 블록을 선택하고 놓을 위치를 정해 보세요."
                        : "상대 차례입니다. 보드 상태가 자동으로 갱신됩니다."}
                  </p>
                </div>

                <button
                  type="button"
                  onClick={() => {
                    setRotation((current) => (current + 1) % 4);
                    setPendingPlacementCell(null);
                  }}
                  disabled={effectiveViewerRole !== "player" || !canPlayTurn || !selectedPieceId}
                  className="rounded-full bg-[var(--accent)] px-4 py-2 text-sm font-medium text-[var(--accent-foreground)] disabled:cursor-not-allowed disabled:opacity-50"
                >
                  선택 블록 회전
                </button>
              </div>

              <div className="grid aspect-square max-w-[640px] grid-cols-8 gap-1.5 rounded-2xl bg-[var(--surface-strong)] p-3 sm:gap-2 sm:p-4">
                {gameState.board.map((row, y) =>
                  row.map((cell, x) => {
                    const isFilled = cell !== null;
                    const previewKey = `${x}-${y}`;
                    const isPreviewCell = previewCellMap.has(previewKey);

                    return (
                      <button
                        key={`${x}-${y}`}
                        type="button"
                        onMouseEnter={() => !isCoarsePointer && setHoveredBoardCell({ x, y })}
                        onFocus={() => setHoveredBoardCell({ x, y })}
                        onMouseLeave={() => !isCoarsePointer && setHoveredBoardCell(null)}
                        onClick={() => void handleBoardCellClick(x, y)}
                        disabled={effectiveViewerRole !== "player" || !canPlayTurn || !selectedPieceId}
                        className={`flex items-center justify-center rounded-lg border text-xs font-medium transition ${
                          isFilled && cell
                            ? `${getPieceColor(cell).border} ${getPieceColor(cell).soft} ${getPieceColor(cell).text}`
                            : isPreviewCell
                              ? canPlaceAtHoveredCell
                                ? "border-emerald-500 bg-emerald-100 text-emerald-800"
                                : "border-rose-500 bg-rose-100 text-rose-700"
                              : "border-[var(--line)] bg-[var(--surface)] hover:bg-[var(--surface-strong)]"
                        } disabled:cursor-not-allowed disabled:opacity-80`}
                        aria-label={`${x},${y} 칸`}
                      >
                        {cell ? "" : isPreviewCell ? (canPlaceAtHoveredCell ? "○" : "×") : ""}
                      </button>
                    );
                  }),
                )}
              </div>
            </article>
          ) : (
            <article className="rounded-3xl border border-[var(--line)] bg-[var(--surface)] p-4 shadow-sm sm:p-6 lg:col-start-1">
              <div className="flex flex-col gap-4">
                <div>
                  <h2 className="text-xl font-semibold">공유 게임 보드</h2>
                  <p className="mt-2 text-sm leading-6 text-black/60">{roomHeadline}</p>
                </div>
                <div className="rounded-2xl bg-[var(--surface-strong)] p-4 text-sm leading-6 text-black/70">
                  {roomHint}
                </div>
              </div>
            </article>
          )}

          <aside className="flex flex-col gap-4 rounded-3xl border border-[var(--line)] bg-[var(--surface)] p-4 shadow-sm sm:p-6 lg:sticky lg:top-6 lg:col-start-2 lg:self-start">
            <div className="flex flex-wrap gap-2 lg:hidden">
              <button
                type="button"
                onClick={() => setActiveSidebarPanel("status")}
                aria-pressed={resolvedSidebarPanel === "status"}
                className={`rounded-full border px-4 py-2 text-sm font-medium transition ${
                  resolvedSidebarPanel === "status"
                    ? "border-[var(--accent)] bg-[var(--accent)] text-[var(--accent-foreground)]"
                    : "border-[var(--line)] bg-white text-black/70"
                }`}
              >
                상태
              </button>
              {showTrayPanel ? (
                <button
                  type="button"
                  onClick={() => setActiveSidebarPanel("tray")}
                  aria-pressed={resolvedSidebarPanel === "tray"}
                  className={`rounded-full border px-4 py-2 text-sm font-medium transition ${
                    resolvedSidebarPanel === "tray"
                      ? "border-[var(--accent)] bg-[var(--accent)] text-[var(--accent-foreground)]"
                      : "border-[var(--line)] bg-white text-black/70"
                  }`}
                >
                  트레이
                </button>
              ) : null}
              <button
                type="button"
                onClick={() => setActiveSidebarPanel("chat")}
                aria-pressed={resolvedSidebarPanel === "chat"}
                className={`rounded-full border px-4 py-2 text-sm font-medium transition ${
                  resolvedSidebarPanel === "chat"
                    ? "border-[var(--accent)] bg-[var(--accent)] text-[var(--accent-foreground)]"
                    : "border-[var(--line)] bg-white text-black/70"
                }`}
              >
                채팅
              </button>
            </div>

            <section className={getSidebarSectionClass("status")}>
              <h2 className="text-xl font-semibold">현재 상태</h2>
              <div className={`rounded-2xl border px-4 py-3 text-sm leading-6 ${messageToneClass}`}>
                {message ?? (effectiveViewerRole === "spectator" ? "관전 중입니다. 현재 게임 상태를 확인하고 채팅에 참여할 수 있습니다." : gameState ? canPlayTurn ? "둘 블록을 선택하세요." : "상대의 수를 기다리는 중입니다." : roomHint)}
              </div>
              {gameState ? (
                <>
                  <div className="rounded-2xl border border-[var(--line)] bg-white px-4 py-3">
                    <p className="text-xs font-semibold tracking-[0.14em] text-black/45 uppercase">현재 턴</p>
                    <div className="mt-2 flex flex-wrap items-center gap-2">
                      <RoleBadge
                        shortLabel={gameState.currentTurnSeat === "host" ? "H" : "G"}
                        label={gameState.currentTurnSeat === "host" ? "HOST" : "GUEST"}
                      />
                      <span className="text-sm text-black/65">{canPlayTurn ? "내 턴" : "상대 턴"}</span>
                    </div>
                    {remainingSeconds !== null ? (
                      <p className={`mt-2 text-lg font-semibold ${timerUrgencyClass}`}>현재 턴 남은 시간: {remainingSeconds}초</p>
                    ) : null}
                  </div>
                  <div className="rounded-2xl border border-[var(--line)] bg-white px-4 py-3 text-sm text-black/70">
                    <p>선택된 블록: {selectedPieceId ? selectedPieceId.replace("block", "블록 ") : "없음"}</p>
                    <p className="mt-2 min-h-10 text-black/65">
                      {selectedPieceId && activePreviewCell
                        ? `현재 미리보기: (${activePreviewCell.x}, ${activePreviewCell.y}) · ${canPlaceAtHoveredCell ? "배치 가능" : "배치 불가"}`
                        : "블록을 선택하고 보드 위에 올리면 배치 가능 여부를 볼 수 있습니다."}
                    </p>
                  </div>
                </>
              ) : (
                <div className="rounded-2xl border border-[var(--line)] bg-white px-4 py-3 text-sm text-black/70">
                  <p className="text-xs font-semibold tracking-[0.14em] text-black/45 uppercase">방 상태</p>
                  <p className="mt-2 text-base font-semibold">{roomStatusLabel}</p>
                  <p className="mt-2 text-black/65">
                    {normalizedSeat === "host"
                      ? "상대가 참가하면 여기서 바로 게임을 시작할 수 있습니다."
                      : "호스트가 게임을 시작하면 보드와 트레이가 바로 열립니다."}
                  </p>
                </div>
              )}
              <div className="flex flex-wrap gap-3">
                {isWaitingRoom ? (
                  <button
                    type="button"
                    onClick={() => void startRoom()}
                    disabled={isStarting || !canStart}
                    className="rounded-2xl bg-[var(--accent)] px-5 py-3 text-sm font-semibold text-[var(--accent-foreground)] disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    {canStart ? "게임 시작" : normalizedSeat === "host" ? "상대 대기 중" : "호스트 대기 중"}
                  </button>
                ) : null}

                {isPlayingRoom && effectiveViewerRole === "player" ? (
                  <button
                    type="button"
                    onClick={() => void forfeitRoom()}
                    className="rounded-2xl border border-[var(--line)] bg-white px-5 py-3 text-sm font-semibold text-black/75"
                  >
                    기권하기
                  </button>
                ) : null}

                {isFinishedRoom && normalizedSeat === "host" ? (
                  <button
                    type="button"
                    onClick={() => void requestRematch()}
                    className="rounded-2xl bg-[var(--accent)] px-5 py-3 text-sm font-semibold text-[var(--accent-foreground)]"
                  >
                    같은 룸에서 다시 시작
                  </button>
                ) : null}

                {!isPlayingRoom && normalizedSeat === "guest" ? (
                  <button
                    type="button"
                    onClick={() => void switchRoomRole("spectator")}
                    disabled={isSwitchingRole}
                    className="rounded-2xl border border-[var(--line)] bg-white px-5 py-3 text-sm font-semibold text-black/75 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    관전으로 전환
                  </button>
                ) : null}

                {!isPlayingRoom && effectiveViewerRole === "spectator" ? (
                  <button
                    type="button"
                    onClick={() => void switchRoomRole("player")}
                    disabled={isSwitchingRole}
                    className="rounded-2xl border border-[var(--line)] bg-white px-5 py-3 text-sm font-semibold text-black/75 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    guest 자리 참가
                  </button>
                ) : null}
              </div>
            </section>

            {gameState ? (
              <section className={getSidebarSectionClass("tray")}>
                <h3 className="text-lg font-semibold">블록 트레이</h3>
                <div className="grid grid-cols-2 gap-2">
                  {Object.values(gameState.pieces).map((piece) => {
                    const isUsed = gameState.usedPieceIds.includes(piece.id);
                    const isSelected = selectedPieceId === piece.id;

                    return (
                      <button
                        key={piece.id}
                        type="button"
                        disabled={effectiveViewerRole !== "player" || isUsed || !canPlayTurn}
                        onClick={() => {
                          setSelectedPieceId((current) => (current === piece.id ? null : piece.id));
                          setRotation(0);
                          setHoveredBoardCell(null);
                          setPendingPlacementCell(null);
                        }}
                        className={`rounded-2xl border px-3 py-3 text-left text-sm transition ${
                          isUsed
                            ? "cursor-not-allowed border-[var(--line)] bg-black/5 text-black/35"
                            : isSelected
                              ? "border-[var(--accent)] bg-[var(--accent)] text-[var(--accent-foreground)]"
                              : "border-[var(--line)] bg-[var(--surface)] hover:bg-[var(--surface-strong)]"
                        }`}
                      >
                        <div className="mb-2 flex items-start justify-between gap-2">
                          <div className="font-semibold">{piece.id.replace("block", "블록 ")}</div>
                          <div className="text-xs opacity-80">{isUsed ? "사용 완료" : isSelected ? "선택됨" : `${rotation * 90}°`}</div>
                        </div>

                        <PieceShape
                          mask={isSelected && previewMask ? previewMask : piece.currentMask}
                          filledClassName={isSelected ? "bg-white/90" : getPieceColor(piece.id).fill}
                          emptyClassName={isSelected ? "bg-white/20" : "bg-[var(--surface)]"}
                          cellClassName="h-3 w-3 rounded-[4px] border border-[var(--line)]"
                        />
                      </button>
                    );
                  })}
                </div>
              </section>
            ) : null}

            <section className={getSidebarSectionClass("chat")}>
              <div className="flex items-start justify-between gap-3">
                <div>
                  <h3 className="text-lg font-semibold">실시간 채팅</h3>
                  <p className="text-sm text-black/60">Enter로 전송하고, Shift+Enter로 줄바꿈할 수 있습니다.</p>
                  <p className="mt-1 text-xs text-black/45">{realtimeStatusLabel}</p>
                </div>
                <button
                  type="button"
                  onClick={() => setShowParticipants((current) => !current)}
                  className="rounded-full border border-[var(--line)] bg-white px-4 py-2 text-xs font-semibold text-black/70"
                >
                  <span className="inline-flex items-center gap-2">
                    <PeopleIcon />
                    <span>{participantItems.length}</span>
                  </span>
                </button>
              </div>

              {showParticipants ? (
                <div className="space-y-2 rounded-2xl border border-[var(--line)] bg-white p-3 text-sm text-black/75">
                  {participantItems.map((participant) => (
                    <div key={participant.id} className="rounded-xl bg-[var(--surface-strong)] px-3 py-3">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <RoleBadge shortLabel={participant.shortLabel} label={participant.label} />
                        <span className="text-xs text-black/50">{participant.detail}</span>
                      </div>
                    </div>
                  ))}
                </div>
              ) : null}

              <div
                ref={chatScrollRef}
                onScroll={(event) => {
                  const element = event.currentTarget;
                  shouldStickChatToBottomRef.current =
                    element.scrollHeight - element.scrollTop - element.clientHeight < 40;
                }}
                className="max-h-72 space-y-2 overflow-y-auto rounded-2xl border border-[var(--line)] bg-white p-3 text-sm text-black/75 lg:max-h-[40vh]"
              >
                {activityItems.length > 0 ? (
                  <div className="rounded-xl bg-[var(--surface)] px-3 py-3 text-xs text-black/55">
                    <div className="space-y-1">
                      {activityItems.map((item) => (
                        <p key={item.id}>• {item.body}</p>
                      ))}
                    </div>
                  </div>
                ) : null}
                {messages.length > 0 ? (
                  messages.map((chat) => (
                    <div key={chat.id} className="rounded-xl bg-[var(--surface-strong)] px-3 py-2">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <p className="text-xs font-semibold text-black/60">{formatSenderRole(chat.senderRole)}</p>
                        <p className="text-xs text-black/45">{new Date(chat.created_at).toLocaleTimeString("ko-KR", { hour: "2-digit", minute: "2-digit" })}</p>
                      </div>
                      <p className="mt-1 whitespace-pre-wrap break-words">{chat.body}</p>
                    </div>
                  ))
                ) : (
                  <p className="text-sm text-black/50">아직 채팅이 없습니다.</p>
                )}
              </div>

              <div className="flex gap-2">
                <textarea
                  value={chatInput}
                  onChange={(event) => setChatInput(event.target.value)}
                  onKeyDown={(event) => void handleChatKeyDown(event)}
                  placeholder={canChat ? "메시지를 입력하세요" : "채팅 불가"}
                  disabled={!canChat}
                  rows={3}
                  className="min-h-24 flex-1 resize-none rounded-2xl border border-[var(--line)] bg-white px-4 py-3 text-sm outline-none focus:border-[var(--accent)] disabled:cursor-not-allowed disabled:opacity-50"
                />
                <button
                  type="button"
                  onClick={() => void sendMessage()}
                  disabled={!canChat || !chatInput.trim()}
                  className="self-end rounded-2xl bg-[var(--accent)] px-4 py-3 text-sm font-semibold text-[var(--accent-foreground)] disabled:cursor-not-allowed disabled:opacity-50"
                >
                  전송
                </button>
              </div>
            </section>
          </aside>
        </section>
      ) : null}
    </main>
  );
}
