"use client";

import { useEffect, useMemo, useState } from "react";
import { getSupabaseBrowserClient } from "@/lib/supabase/browser";
import type { PlayerSeat, RoomStatus } from "@/domain/katamino/types";

interface RoomPlayerRecord {
  guestId: string;
  seat: PlayerSeat;
}

interface RoomSummary {
  roomCode: string;
  status: RoomStatus;
  players: RoomPlayerRecord[];
  canStart: boolean;
}

interface RoomPageClientProps {
  roomCode: string;
  seat: string | undefined;
}

export function RoomPageClient({ roomCode, seat }: RoomPageClientProps) {
  const [message, setMessage] = useState<string | null>(null);
  const [isStarting, setIsStarting] = useState(false);
  const [roomSummary, setRoomSummary] = useState<RoomSummary | null>(null);

  const normalizedSeat = seat === "host" || seat === "guest" ? seat : undefined;
  const playerCount = roomSummary?.players.length ?? 0;
  const canStart = normalizedSeat === "host" && roomSummary?.canStart;

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
    </main>
  );
}
