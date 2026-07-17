# Katamino Web

브라우저에서 플레이할 수 있는 Katamino 웹 버전 프로젝트입니다.

레거시 C# WinForms 1:1 Katamino 게임을 기준으로, 게임 규칙을 순수 TypeScript 도메인으로 분리하고 `Next.js + Supabase + Vercel` 구조로 재구현하는 것이 목표입니다.

## 현재 상태

- `Next.js` App Router 기반 프론트엔드 스캐폴드 완료
- Katamino 블록 데이터/회전/배치 규칙을 TypeScript 도메인으로 분리 완료
- 단일 브라우저에서 블록 선택/회전/배치가 가능한 로컬 플레이 UI 구현 완료
- `Vitest` 단위 테스트 + `Playwright` smoke test 구성 완료
- Supabase 연동, 룸 생성/참가, Realtime 멀티플레이, 배포는 아직 진행 중

## 기술 스택

### 프론트엔드
- `Next.js 16`
- `React 19`
- `TypeScript`
- `Tailwind CSS v4`

### 테스트
- `Vitest`
- `Testing Library`
- `Playwright`

### 목표 백엔드/배포
- `Supabase Postgres`
- `Supabase Realtime`
- `Supabase Auth (anonymous/guest 중심)`
- `Vercel`

## 디렉터리 개요

```text
src/
  app/                     # Next.js App Router
  components/katamino/     # UI 컴포넌트
  domain/katamino/         # 게임 규칙/상태 도메인
  test/                    # 테스트 설정
e2e/                       # Playwright E2E smoke test
docs/temp/                 # 레거시 참고 자료 (gitignore)
docs/plan/                 # 로컬 계획 문서 (gitignore)
```

## 로컬 실행

### 1. 의존성 설치

```bash
npm install
```

### 2. 개발 서버 실행

```bash
npm run dev
```

기본 접속 주소:

- `http://localhost:3000`

## 테스트 및 검증 명령어

### 정적 검사

```bash
npm run lint
```

### 단위 테스트

```bash
npm run test
```

### E2E smoke test

```bash
npm run test:e2e
```

### 프로덕션 빌드 검증

```bash
npm run build
```

## 환경 변수

실제 값은 `.env.local` 또는 Vercel / Supabase 환경 변수에 넣고, 예시는 `.env.example`을 참고합니다.

현재 기준으로 사용할 예정인 주요 변수:

- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `SUPABASE_SERVICE_ROLE_KEY`

## 아키텍처 방향

### 현재 선택안
- 프론트엔드: `Next.js`
- 백엔드/상태 저장: `Supabase`
- 배포: `Vercel`

### 의도
- 게임 규칙은 프레임워크와 분리된 순수 TypeScript로 유지
- 멀티플레이는 레거시 TCP loopback을 포팅하지 않고, Supabase Realtime 기반 룸 동기화로 재설계
- 초기에는 guest/anonymous 기반 식별만 사용
- 과도한 매치메이킹, 랭킹, 관전, 리플레이는 뒤로 미룸

## 앞으로 남은 큰 작업

1. 로컬 상태를 멀티플레이 가능한 직렬화 가능한 세션 모델로 확장
2. Supabase 프로젝트 초기화 및 스키마 작성
3. guest/anonymous 세션 연결
4. 방 생성 / 참가 / 시작 흐름 추가
5. Realtime 멀티플레이 동기화 구현
6. 배포 문서 확정 및 Vercel 배포

## 배포 전 체크리스트

- [ ] `README.md` 최신 상태 유지
- [ ] `.env.example` 최신 상태 유지
- [ ] `npm run lint` 통과
- [ ] `npm run test` 통과
- [ ] `npm run test:e2e` 통과
- [ ] `npm run build` 통과
- [ ] Supabase 환경 변수 설정 완료
- [ ] Vercel 프로젝트 연결 완료

## 레거시 참고

레거시 원본은 `docs/temp/Katamino_v12/` 아래에 있습니다.

우선적으로 참고할 파일:

- `Game_form.cs`
- `Block.cs`
- `DiceGame.cs`

## 작업 원칙

- 문서와 주석은 가능하면 한글 우선
- 라이브러리/API 이름, 코드 심볼, CLI 명령어는 원문 유지
- 구현은 가능하면 작은 PR 단위로 쪼개서 리뷰/보완/merge 루프 유지
