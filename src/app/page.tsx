import { LocalGame } from "@/components/katamino/local-game";

export default function Home() {
  return (
    <main className="mx-auto flex min-h-screen w-full max-w-6xl flex-col gap-8 px-6 py-10">
      <section className="flex flex-col gap-3">
        <p className="text-sm font-semibold tracking-[0.2em] text-[var(--accent)] uppercase">
          Katamino Web
        </p>
        <div className="flex flex-col gap-2">
          <h1 className="text-4xl font-bold tracking-tight">Katamino 웹 재구현</h1>
          <p className="max-w-3xl text-base leading-7 text-black/70">
            레거시 C# WinForms 버전을 기준으로 게임 규칙을 TypeScript로 분리하고,
            이후 Vercel + Supabase 구조로 확장할 수 있도록 준비하는 첫 번째 스캐폴드다.
          </p>
        </div>
      </section>

      <LocalGame />
    </main>
  );
}
