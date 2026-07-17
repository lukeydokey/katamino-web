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

      <section className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_320px]">
        <article className="rounded-3xl border border-[var(--line)] bg-[var(--surface)] p-6 shadow-sm">
          <div className="mb-4 flex items-center justify-between">
            <div>
              <h2 className="text-xl font-semibold">게임 보드</h2>
              <p className="text-sm text-black/60">다음 단계에서 8x8 보드와 배치 로직이 들어온다.</p>
            </div>
            <span className="rounded-full bg-[var(--surface-strong)] px-3 py-1 text-xs font-medium text-black/70">
              준비 중
            </span>
          </div>

          <div className="grid aspect-square max-w-[640px] grid-cols-8 gap-2 rounded-2xl bg-[var(--surface-strong)] p-4">
            {Array.from({ length: 64 }).map((_, index) => (
              <div
                key={index}
                className="rounded-lg border border-[var(--line)] bg-[var(--surface)]"
              />
            ))}
          </div>
        </article>

        <aside className="rounded-3xl border border-[var(--line)] bg-[var(--surface)] p-6 shadow-sm">
          <div className="mb-4 flex items-center justify-between">
            <div>
              <h2 className="text-xl font-semibold">작업 메모</h2>
              <p className="text-sm text-black/60">A안 기준으로 먼저 로컬 플레이 가능한 구조를 만든다.</p>
            </div>
          </div>

          <ol className="flex list-decimal flex-col gap-3 pl-5 text-sm leading-6 text-black/75">
            <li>Next.js + TypeScript 앱 셸 정리</li>
            <li>Katamino 규칙을 순수 TypeScript 모듈로 분리</li>
            <li>단일 브라우저에서 로컬 배치 플레이 구현</li>
            <li>그 다음 Supabase Realtime 기반 1:1 동기화 추가</li>
          </ol>

          <div className="mt-6 rounded-2xl bg-[var(--surface-strong)] p-4 text-sm leading-6 text-black/70">
            지금 단계에서는 주사위, 타이머, 멀티플레이, 오디오, 원본 에셋 이식은 아직 포함하지 않는다.
          </div>
        </aside>
      </section>
    </main>
  );
}
