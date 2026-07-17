"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { canPlacePiece } from "@/domain/katamino/board";
import { rotateMaskClockwise } from "@/domain/katamino/pieces";
import { getSupabaseBrowserClient } from "@/lib/supabase/browser";
import type { LocalGameSession } from "@/domain/katamino/game-state";
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
}

interface RoomPageClientProps {
  roomCode: string;
  seat: string | undefined;
}

export function RoomPageClient({ roomCode, seat }: RoomPageClientProps) {
  const [message, setMessage] = useState<string | null>(null);
  const [isStarting, setIsStarting] = useState(false);
  const [roomSummary, setRoomSummary] = useState<RoomSummary | null>(null);
  const [selectedPieceId, setSelectedPieceId] = useState<PieceId | null>(null);
  const [rotation, setRotation] = useState(0);
  const [hoveredBoardCell, setHoveredBoardCell] = useState<{ x: number; y: number } | null>(null);
  const selectedPieceIdRef = useRef<PieceId | null>(null);

  const normalizedSeat = seat === "host" || seat === "guest" ? seat : undefined;
  const playerCount = roomSummary?.players.length ?? 0;
  const canStart = normalizedSeat === "host" && roomSummary?.canStart;
  const gameState = roomSummary?.gameState ?? null;
  const selectedPiece = selectedPieceId && gameState ? gameState.pieces[selectedPieceId] : null;

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

  const canPlaceAtHoveredCell =
    gameState && previewMask && hoveredBoardCell
      ? canPlacePiece(gameState.board, previewMask, hoveredBoardCell.x, hoveredBoardCell.y)
      : false;

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

  useEffect(() => {
    selectedPieceIdRef.current = selectedPieceId;
  }, [selectedPieceId]);

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
      setRoomSummary(payload);

      const currentSelectedPieceId = selectedPieceIdRef.current;

      if (currentSelectedPieceId && payload.gameState?.usedPieceIds.includes(currentSelectedPieceId)) {
        setSelectedPieceId(null);
        setRotation(0);
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
      .on("presence", { event: "sync" }, () => {
        void fetchRoomSummary();
      });

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
    };
  }, [normalizedSeat, roomCode]);

  async function startRoom() {
    setIsStarting(true);
    setMessage(null);

    const client = getSupabaseBrowserClient();

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

      await client
        ?.channel(`room:${roomCode}`)
        .send({
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

    await getSupabaseBrowserClient()
      ?.channel(`room:${roomCode}`)
      .send({
        type: "broadcast",
        event: "room-updated",
        payload: {
          roomCode,
          status: "playing",
        },
      });
  }

  return (
    <main className="mx-auto flex min-h-screen w-full max-w-5xl flex-col gap-8 px-6 py-10">
      <section className="rounded-3xl border border-[var(--line)] bg-[var(--surface)] p-6 shadow-sm">
        <p className="text-sm font-semibold tracking-[0.2em] text-[var(--accent)] uppercase">
          Online Room
        </p>
        <h1 className="mt-2 text-3xl font-bold tracking-tight">룸 {roomCode}</h1>
        <p className="mt-3 text-sm leading-6 text-black/65">
          현재 좌석: <strong>{seat ?? "미확인"}</strong>
        </p>
        <p className="mt-2 text-sm leading-6 text-black/65">
          현재 상태: <strong>{roomStatusLabel}</strong>
        </p>
        <p className="mt-2 text-sm leading-6 text-black/65">
          참여 인원: <strong>{playerCount} / 2</strong>
        </p>

        <div className="mt-6 rounded-2xl bg-[var(--surface-strong)] p-4 text-sm leading-6 text-black/75">
          같은 룸에 두 명이 모이면 host가 게임을 시작할 수 있습니다. 상대가 들어올 때까지 잠시 기다려 주세요.
        </div>

        <ul className="mt-4 space-y-2 text-sm text-black/70">
          {roomSummary?.players.map((player) => (
            <li key={`${player.guestId}-${player.seat}`} className="rounded-xl border border-[var(--line)] bg-white px-4 py-3">
              {player.seat === "host" ? "HOST" : "GUEST"} 입장 완료
            </li>
          ))}
        </ul>

        <div className="mt-6 flex flex-wrap gap-3">
          <button
            type="button"
            onClick={() => void startRoom()}
            disabled={isStarting || !canStart}
            className="rounded-2xl bg-[var(--accent)] px-5 py-3 text-sm font-semibold text-[var(--accent-foreground)] disabled:cursor-not-allowed disabled:opacity-50"
          >
            게임 시작 요청
          </button>
        </div>

        {message ? <p className="mt-4 text-sm text-[var(--accent)]">{message}</p> : null}
      </section>

      {gameState ? (
        <section className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_320px]">
          <article className="rounded-3xl border border-[var(--line)] bg-[var(--surface)] p-6 shadow-sm">
            <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
              <div>
                <h2 className="text-xl font-semibold">공유 게임 보드</h2>
                <p className="text-sm text-black/60">
                  {canPlayTurn
                    ? "지금은 내 차례입니다. 블록을 선택하고 놓을 위치를 정해 보세요."
                    : "상대 차례입니다. 보드 상태가 자동으로 갱신됩니다."}
                </p>
              </div>

              <button
                type="button"
                onClick={() => setRotation((current) => (current + 1) % 4)}
                disabled={!canPlayTurn || !selectedPieceId}
                className="rounded-full bg-[var(--accent)] px-4 py-2 text-sm font-medium text-[var(--accent-foreground)] disabled:cursor-not-allowed disabled:opacity-50"
              >
                선택 블록 회전
              </button>
            </div>

            <div className="grid aspect-square max-w-[640px] grid-cols-8 gap-2 rounded-2xl bg-[var(--surface-strong)] p-4">
              {gameState.board.map((row, y) =>
                row.map((cell, x) => {
                  const isFilled = cell !== null;

                  return (
                    <button
                      key={`${x}-${y}`}
                      type="button"
                      onMouseEnter={() => setHoveredBoardCell({ x, y })}
                      onFocus={() => setHoveredBoardCell({ x, y })}
                      onMouseLeave={() => setHoveredBoardCell(null)}
                      onClick={() => void placeMove(x, y)}
                      disabled={!canPlayTurn || !selectedPieceId}
                      className={`flex items-center justify-center rounded-lg border text-xs font-medium transition ${
                        isFilled
                          ? "border-[var(--accent)] bg-[var(--accent)]/15 text-[var(--accent)]"
                          : hoveredBoardCell?.x === x && hoveredBoardCell?.y === y && selectedPieceId
                            ? canPlaceAtHoveredCell
                              ? "border-emerald-500 bg-emerald-100 text-emerald-800"
                              : "border-rose-500 bg-rose-100 text-rose-700"
                            : "border-[var(--line)] bg-[var(--surface)] hover:bg-[var(--surface-strong)]"
                      } disabled:cursor-not-allowed disabled:opacity-80`}
                      aria-label={`${x},${y} 칸`}
                    >
                      {cell ? cell.slice(-2) : ""}
                    </button>
                  );
                }),
              )}
            </div>
          </article>

          <aside className="flex flex-col gap-4 rounded-3xl border border-[var(--line)] bg-[var(--surface)] p-6 shadow-sm">
            <section className="flex flex-col gap-2">
              <h2 className="text-xl font-semibold">현재 상태</h2>
              <p className="text-sm text-black/60">
                {message ?? (canPlayTurn ? "둘 블록을 선택하세요." : "상대의 수를 기다리는 중입니다.")}
              </p>
              <p className="text-sm text-black/70">
                선택된 블록: {selectedPieceId ? selectedPieceId.replace("block", "블록 ") : "없음"}
              </p>
              <p className="text-sm text-black/70">
                현재 턴: {gameState.currentTurnSeat === "host" ? "HOST" : "GUEST"}
              </p>
            </section>

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
                      disabled={isUsed || !canPlayTurn}
                      onClick={() => {
                        setSelectedPieceId((current) => (current === piece.id ? null : piece.id));
                        setRotation(0);
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
                    </button>
                  );
                })}
              </div>
            </section>
          </aside>
        </section>
      ) : null}
    </main>
  );
}
