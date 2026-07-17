"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

type SessionStatus =
  | "checking"
  | "disabled"
  | "ready"
  | "failed";

export function RoomEntry() {
  const router = useRouter();
  const [sessionStatus, setSessionStatus] = useState<SessionStatus>("checking");
  const [joinCode, setJoinCode] = useState("");
  const [turnTimeSeconds, setTurnTimeSeconds] = useState(0);
  const [message, setMessage] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    let mounted = true;

    async function bootstrap() {
      const response = await fetch("/api/guest-session", {
        method: "POST",
      });

      const payload = (await response.json()) as { message?: string; ok?: boolean };

      if (!mounted) {
        return;
      }

      if (response.ok && payload.ok) {
        setSessionStatus("ready");
        setMessage("준비가 끝났습니다. 방을 만들거나 룸 코드로 참가해 보세요.");
        return;
      }

      if (response.status === 503) {
        setSessionStatus("disabled");
        setMessage(payload.message ?? "현재는 온라인 룸 기능을 사용할 수 없습니다.");
        return;
      }

      setSessionStatus("failed");
      setMessage(payload.message ?? "준비 중 문제가 발생했습니다. 잠시 후 다시 시도해 주세요.");
    }

    void bootstrap();

    return () => {
      mounted = false;
    };
  }, []);

  async function createRoom() {
    setIsSubmitting(true);
    setMessage(null);

    try {
      const response = await fetch("/api/rooms/create", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ turnTimeSeconds }),
      });
      const payload = (await response.json()) as { message?: string; roomCode?: string; seat?: string; turnTimeSeconds?: number };

      if (!response.ok || !payload.roomCode) {
        setMessage(payload.message ?? "방 생성에 실패했습니다.");
        return;
      }

      router.push(`/room/${payload.roomCode}?seat=${payload.seat ?? "host"}`);
    } finally {
      setIsSubmitting(false);
    }
  }

  async function joinRoom() {
    setIsSubmitting(true);
    setMessage(null);

    try {
      const response = await fetch("/api/rooms/join", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ code: joinCode.trim().toUpperCase() }),
      });
      const payload = (await response.json()) as { message?: string; roomCode?: string; seat?: string };

      if (!response.ok || !payload.roomCode) {
        setMessage(payload.message ?? "방 참가에 실패했습니다.");
        return;
      }

      router.push(`/room/${payload.roomCode}?seat=${payload.seat ?? "guest"}`);
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <section className="rounded-3xl border border-[var(--line)] bg-[var(--surface)] p-6 shadow-sm">
      <div className="flex flex-col gap-3">
        <div>
          <h2 className="text-xl font-semibold">온라인 룸 진입</h2>
          <p className="text-sm leading-6 text-black/65">
            새 방을 만들고 상대를 기다리거나, 받은 룸 코드로 바로 참가할 수 있습니다.
          </p>
        </div>

        <div className="rounded-2xl bg-[var(--surface-strong)] p-4 text-sm leading-6 text-black/75">
          <strong className="font-semibold">세션 상태:</strong>{" "}
          {sessionStatus === "checking" && "준비 중"}
          {sessionStatus === "disabled" && "비활성화"}
          {sessionStatus === "ready" && "준비 완료"}
          {sessionStatus === "failed" && "실패"}
        </div>

        {message ? <p className="text-sm text-[var(--accent)]">{message}</p> : null}

        <div className="grid gap-4 md:grid-cols-[1fr_auto]">
          <input
            value={joinCode}
            onChange={(event) => setJoinCode(event.target.value)}
            placeholder="룸 코드 입력"
            className="rounded-2xl border border-[var(--line)] bg-white px-4 py-3 text-sm outline-none focus:border-[var(--accent)]"
          />

          <button
            type="button"
            onClick={() => void joinRoom()}
            disabled={sessionStatus !== "ready" || isSubmitting || joinCode.trim().length < 4}
            className="rounded-2xl border border-[var(--line)] bg-white px-5 py-3 text-sm font-semibold disabled:cursor-not-allowed disabled:opacity-50"
          >
            방 참가하기
          </button>
        </div>

        <div className="flex flex-col gap-2">
          <label className="text-sm font-medium text-black/70" htmlFor="turn-time-seconds">
            턴 시간 제한
          </label>
          <select
            id="turn-time-seconds"
            value={turnTimeSeconds}
            onChange={(event) => setTurnTimeSeconds(Number(event.target.value))}
            className="rounded-2xl border border-[var(--line)] bg-white px-4 py-3 text-sm outline-none focus:border-[var(--accent)]"
          >
            <option value={0}>제한 없음</option>
            <option value={30}>30초</option>
            <option value={60}>60초</option>
            <option value={120}>120초</option>
          </select>
        </div>

        <button
          type="button"
          onClick={() => void createRoom()}
          disabled={sessionStatus !== "ready" || isSubmitting}
          className="rounded-2xl bg-[var(--accent)] px-5 py-3 text-sm font-semibold text-[var(--accent-foreground)] disabled:cursor-not-allowed disabled:opacity-50"
        >
          새 방 만들기
        </button>
      </div>
    </section>
  );
}
