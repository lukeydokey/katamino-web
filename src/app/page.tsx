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
      </section>

      <RoomEntry />

      <LocalGame />
    </main>
  );
}
