"use client";

import { useEffect, useMemo, useRef, useState } from "react";
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
}

interface RoomMessage {
  id: string;
  guest_id: string;
  body: string;
  created_at: string;
  senderRole: "host" | "guest" | "spectator";
}

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

export function RoomPageClient({ roomCode, seat, viewerRole }: RoomPageClientProps) {
  const [message, setMessage] = useState<string | null>(null);
  const [isStarting, setIsStarting] = useState(false);
  const [messages, setMessages] = useState<RoomMessage[]>([]);
  const [chatInput, setChatInput] = useState("");
  const [roomSummary, setRoomSummary] = useState<RoomSummary | null>(null);
  const [selectedPieceId, setSelectedPieceId] = useState<PieceId | null>(null);
  const [rotation, setRotation] = useState(0);
  const [hoveredBoardCell, setHoveredBoardCell] = useState<{ x: number; y: number } | null>(null);
  const [pendingPlacementCell, setPendingPlacementCell] = useState<{ x: number; y: number } | null>(null);
  const [isCoarsePointer, setIsCoarsePointer] = useState(false);
  const [nowTick, setNowTick] = useState(() => Date.now());
  const selectedPieceIdRef = useRef<PieceId | null>(null);
  const roomSummaryRef = useRef<RoomSummary | null>(null);
  const roomChannelRef = useRef<RealtimeChannel | null>(null);
  const boardArticleRef = useRef<HTMLElement | null>(null);

  const normalizedSeat = seat === "host" || seat === "guest" ? seat : undefined;
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
  const canChat = viewerRole === "player" || viewerRole === "spectator";

  const seatLabel = normalizedSeat === "host" ? "HOST" : normalizedSeat === "guest" ? "GUEST" : "미확인";

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
    if (!isFinishedRoom || !gameState?.winnerSeat) {
      return null;
    }

    if (gameState.winnerSeat === normalizedSeat) {
      return "승리";
    }

    return "패배";
  }, [gameState?.winnerSeat, isFinishedRoom, normalizedSeat]);

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
    let active = true;

    async function fetchMessages() {
      const response = await fetch(`/api/rooms/${roomCode}/messages`, {
        method: "GET",
        cache: "no-store",
      });

      if (!active || !response.ok) {
        return;
      }

      const payload = (await response.json()) as { messages: RoomMessage[] };

      setMessages(payload.messages ?? []);
    }

    void fetchMessages();

    return () => {
      active = false;
    };
  }, [roomCode]);

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

    async function fetchRoomSummary() {
      const response = await fetch(`/api/rooms/${roomCode}`, {
        method: "GET",
        cache: "no-store",
      });

      if (!active || !response.ok) {
        return;
      }

      const payload = (await response.json()) as RoomSummary;
      const previousSummary = roomSummaryRef.current;
      setRoomSummary(payload);

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
    }

    void fetchRoomSummary();

    const intervalId = window.setInterval(() => {
      void fetchRoomSummary();
    }, 2500);

    const channel = client
      ?.channel(`room:${roomCode}`, {
        config: {
          presence: {
            key: normalizedSeat ?? crypto.randomUUID(),
          },
        },
      })
      .on("broadcast", { event: "room-updated" }, () => {
        void fetchRoomSummary();
      })
      .on("broadcast", { event: "chat-updated" }, async () => {
        const response = await fetch(`/api/rooms/${roomCode}/messages`, {
          method: "GET",
          cache: "no-store",
        });

        if (!response.ok) {
          return;
        }

        const payload = (await response.json()) as { messages: RoomMessage[] };
        setMessages(payload.messages ?? []);
      })
      .on("presence", { event: "sync" }, () => {
        void fetchRoomSummary();
      });

    roomChannelRef.current = channel ?? null;

    channel?.subscribe(async (status) => {
      if (status === "SUBSCRIBED") {
        await channel.track({
          roomCode,
          seat: normalizedSeat ?? "observer",
          onlineAt: new Date().toISOString(),
        });
      }
    });

    return () => {
      active = false;
      window.clearInterval(intervalId);
      channel?.unsubscribe();
      roomChannelRef.current = null;
    };
  }, [normalizedSeat, roomCode]);

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
    if (viewerRole !== "player" || !canPlayTurn || !selectedPieceId) {
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
        return "HOST";
      case "guest":
        return "GUEST";
      default:
        return "SPECTATOR";
    }
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

        <div className="mt-6 grid grid-cols-2 gap-3 md:grid-cols-4">
          <div className="rounded-2xl border border-[var(--line)] bg-white px-3 py-3 sm:px-4 sm:py-4">
            <p className="text-xs font-semibold tracking-[0.14em] text-black/45 uppercase">내 좌석</p>
            <p className="mt-2 text-lg font-semibold">{seatLabel}</p>
          </div>
          <div className="rounded-2xl border border-[var(--line)] bg-white px-3 py-3 sm:px-4 sm:py-4">
            <p className="text-xs font-semibold tracking-[0.14em] text-black/45 uppercase">방 상태</p>
            <p className="mt-2 text-lg font-semibold">{roomStatusLabel}</p>
          </div>
          <div className="rounded-2xl border border-[var(--line)] bg-white px-3 py-3 sm:px-4 sm:py-4">
            <p className="text-xs font-semibold tracking-[0.14em] text-black/45 uppercase">참여 인원</p>
            <p className="mt-2 text-lg font-semibold">{playerCount} / 2</p>
          </div>
          <div className="rounded-2xl border border-[var(--line)] bg-white px-3 py-3 sm:px-4 sm:py-4">
            <p className="text-xs font-semibold tracking-[0.14em] text-black/45 uppercase">관전자</p>
            <p className="mt-2 text-lg font-semibold">{spectatorCount}명</p>
          </div>
          <div className="rounded-2xl border border-[var(--line)] bg-white px-3 py-3 sm:px-4 sm:py-4 md:col-span-4">
            <p className="text-xs font-semibold tracking-[0.14em] text-black/45 uppercase">턴 시간 제한</p>
            <p className="mt-2 text-lg font-semibold">
              {roomSummary?.turnTimeSeconds ? `${roomSummary.turnTimeSeconds}초` : "제한 없음"}
            </p>
          </div>
        </div>

        <div className="mt-6 rounded-2xl bg-[var(--surface-strong)] p-4 text-sm leading-6 text-black/75">
          {roomHint}
        </div>

        {resultLabel ? (
          <div className="mt-4 rounded-2xl border border-[var(--line)] bg-white px-4 py-4">
            <p className="text-xs font-semibold tracking-[0.14em] text-black/45 uppercase">결과</p>
            <p className="mt-2 text-2xl font-bold text-[var(--accent)]">{resultLabel}</p>
          </div>
        ) : null}

        <ul className="mt-4 space-y-2 text-sm text-black/70">
          {roomSummary?.players.map((player) => (
            <li key={`${player.guestId}-${player.seat}`} className="rounded-xl border border-[var(--line)] bg-white px-4 py-3">
              <span className="font-semibold">{player.seat === "host" ? "HOST" : "GUEST"}</span>
              <span className="ml-2 text-black/60">입장 완료</span>
            </li>
          ))}
          {viewerRole === "spectator" ? (
            <li className="rounded-xl border border-[var(--line)] bg-white px-4 py-3">
              <span className="font-semibold">SPECTATOR</span>
              <span className="ml-2 text-black/60">관전 중</span>
            </li>
          ) : null}
        </ul>

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
                    {viewerRole === "spectator"
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
                  disabled={viewerRole !== "player" || !canPlayTurn || !selectedPieceId}
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
                        disabled={viewerRole !== "player" || !canPlayTurn || !selectedPieceId}
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
                        {cell ? "" : ""}
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

          <aside className="flex flex-col gap-4 rounded-3xl border border-[var(--line)] bg-[var(--surface)] p-4 shadow-sm sm:p-6 lg:col-start-2">
            <section className="flex flex-col gap-3">
              <h2 className="text-xl font-semibold">현재 상태</h2>
              <p className="min-h-12 text-sm text-black/60">
                {message ?? (viewerRole === "spectator" ? "관전 중입니다. 현재 게임 상태를 확인하고 채팅에 참여할 수 있습니다." : gameState ? canPlayTurn ? "둘 블록을 선택하세요." : "상대의 수를 기다리는 중입니다." : roomHint)}
              </p>
              {gameState ? (
                <>
                  <div className="rounded-2xl border border-[var(--line)] bg-white px-4 py-3">
                    <p className="text-xs font-semibold tracking-[0.14em] text-black/45 uppercase">현재 턴</p>
                    <p className="mt-2 text-base font-semibold">{gameState.currentTurnSeat === "host" ? "HOST" : "GUEST"}</p>
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

                {isPlayingRoom && viewerRole === "player" ? (
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
              </div>
            </section>

            {gameState ? (
              <section className="flex flex-col gap-3">
                <h3 className="text-lg font-semibold">블록 트레이</h3>
                <div className="grid grid-cols-2 gap-2">
                  {Object.values(gameState.pieces).map((piece) => {
                    const isUsed = gameState.usedPieceIds.includes(piece.id);
                    const isSelected = selectedPieceId === piece.id;

                    return (
                      <button
                        key={piece.id}
                        type="button"
                        disabled={viewerRole !== "player" || isUsed || !canPlayTurn}
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
                          <div className="text-xs opacity-80">{isUsed ? "사용 완료" : `${rotation * 90}°`}</div>
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

            <section className="flex flex-col gap-3">
              <div>
                <h3 className="text-lg font-semibold">실시간 채팅</h3>
                <p className="text-sm text-black/60">Enter로 전송하고, Shift+Enter로 줄바꿈할 수 있습니다.</p>
              </div>

              <div className="max-h-64 space-y-2 overflow-y-auto rounded-2xl border border-[var(--line)] bg-white p-3 text-sm text-black/75">
                {messages.length > 0 ? (
                  messages.map((chat) => (
                    <div key={chat.id} className="rounded-xl bg-[var(--surface-strong)] px-3 py-2">
                      <div className="flex items-center justify-between gap-3">
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
