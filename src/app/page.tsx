import { LocalGame } from "@/components/katamino/local-game";
import { RoomEntry } from "@/components/katamino/room-entry";

export default function Home() {
  return (
    <main className="mx-auto flex min-h-screen w-full max-w-6xl flex-col gap-8 px-6 py-10">
      <section className="flex flex-col gap-3">
        <p className="text-sm font-semibold tracking-[0.2em] text-[var(--accent)] uppercase">
          Katamino Web
        </p>
        <div className="flex flex-col gap-2">
          <h1 className="text-4xl font-bold tracking-tight">Katamino 온라인</h1>
          <p className="max-w-3xl text-base leading-7 text-black/70">
            블록을 골라 보드에 배치하며 공간을 먼저 채우는 퍼즐 대결을 즐겨보세요.
            혼자 연습할 수도 있고, 룸을 만들어 다른 플레이어와 함께 시작할 수도 있습니다.
          </p>
        </div>

        <details className="group max-w-3xl rounded-3xl border border-[var(--line)] bg-[var(--surface)] p-5 shadow-sm">
          <summary className="cursor-pointer list-none text-sm font-semibold text-[var(--accent)]">
            게임 설명 보기
          </summary>
          <div className="mt-4 grid gap-4 text-sm leading-6 text-black/70 md:grid-cols-3">
            <div className="rounded-2xl bg-[var(--surface-strong)] p-4">
              <p className="font-semibold text-black">1. 블록 선택</p>
              <p className="mt-2">트레이에서 블록을 고르고 회전한 뒤 보드에 둘 위치를 확인합니다.</p>
            </div>
            <div className="rounded-2xl bg-[var(--surface-strong)] p-4">
              <p className="font-semibold text-black">2. 공간 배치</p>
              <p className="mt-2">번갈아 가며 블록을 놓고, 더 유리하게 공간을 선점하는 쪽이 흐름을 잡습니다.</p>
            </div>
            <div className="rounded-2xl bg-[var(--surface-strong)] p-4">
              <p className="font-semibold text-black">3. 온라인 룸</p>
              <p className="mt-2">코드나 링크로 들어오면 guest 자리에 우선 참가하고, 자리가 차 있으면 관전으로 전환됩니다.</p>
            </div>
          </div>
        </details>
      </section>

      <RoomEntry />

      <LocalGame />
    </main>
  );
}
