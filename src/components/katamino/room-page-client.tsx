"use client";

import { useState } from "react";

interface RoomPageClientProps {
  roomCode: string;
  seat: string | undefined;
}

export function RoomPageClient({ roomCode, seat }: RoomPageClientProps) {
  const [message, setMessage] = useState<string | null>(null);
  const [isStarting, setIsStarting] = useState(false);

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

      setMessage(payload.started ? "게임 시작 준비가 완료되었습니다." : "게임 상태를 확인해주세요.");
    } finally {
      setIsStarting(false);
    }
  }

  return (
    <main className="mx-auto flex min-h-screen w-full max-w-5xl flex-col gap-8 px-6 py-10">
      <section className="rounded-3xl border border-[var(--line)] bg-[var(--surface)] p-6 shadow-sm">
        <p className="text-sm font-semibold tracking-[0.2em] text-[var(--accent)] uppercase">
          Room Lobby
        </p>
        <h1 className="mt-2 text-3xl font-bold tracking-tight">룸 {roomCode}</h1>
        <p className="mt-3 text-sm leading-6 text-black/65">
          현재 좌석: <strong>{seat ?? "미확인"}</strong>
        </p>

        <div className="mt-6 rounded-2xl bg-[var(--surface-strong)] p-4 text-sm leading-6 text-black/75">
          이 화면은 room lifecycle 기반을 검증하기 위한 첫 번째 lobby UI입니다. 다음 단계에서 실제 참여자 목록, 준비 상태, 게임 동기화가 추가됩니다.
        </div>

        <div className="mt-6 flex flex-wrap gap-3">
          <button
            type="button"
            onClick={() => void startRoom()}
            disabled={isStarting}
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
