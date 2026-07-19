# Katamino Web

브라우저에서 플레이할 수 있는 Katamino 웹 버전 프로젝트입니다.

레거시 C# WinForms 1:1 Katamino 게임을 기준으로, 게임 규칙을 순수 TypeScript 도메인으로 분리하고 `Next.js + Supabase + Vercel` 구조로 재구현하는 것이 목표입니다.

## 현재 상태

- `Next.js` App Router 기반 프론트엔드 / room UI / local play UI 운영 중
- Katamino 블록 데이터, 회전, 배치 규칙을 순수 TypeScript 도메인으로 분리 완료
- 단일 브라우저 로컬 플레이와 온라인 room 플레이 둘 다 가능
- room 기능 현재 범위:
  - 방 생성 / 코드 입장 / direct-link 입장
  - guest 우선 입장, 자리 없으면 spectator fallback
  - pre-game guest ↔ spectator 전환
  - turn timer / forfeit / timeout / rematch
  - spectator chat 참여
  - 실시간 room 동기화 + reconnect/catch-up 보강
- 홈 화면에 게임 설명 패널 추가 완료
- room 화면 UX 개선 반영:
  - board 중심 레이아웃
  - turn / activity / endgame 안내 강화
  - participant / presence 표시 강화
  - chat drawer + unread badge 반영
- `Vitest` 단위 테스트 + room 포함 `Playwright` E2E 운영 중
- production 배포 및 반복 검증 루프 운영 중

## 접속 링크

- Production: `https://katamino-web.vercel.app`
- Preview는 Vercel 배포마다 바뀌므로 `vercel` / GitHub PR에서 확인

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
- server-issued guest session cookie + `Supabase` 저장 구조
- `Vercel`

## 디렉터리 개요

```text
src/
  app/                     # Next.js App Router
  components/katamino/     # UI 컴포넌트
  domain/katamino/         # 게임 규칙/상태 도메인
  test/                    # 테스트 설정
e2e/                       # Playwright E2E (local smoke + room flow)
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

### Supabase 로컬 명령어

```bash
npm run supabase:start
npm run supabase:status
npm run supabase:stop
```

```bash
npm run supabase:typegen
```

> 로컬 Supabase 스택 실행에는 `Docker Desktop`이 필요합니다.

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
- 초기에는 회원가입 없이도 바로 플레이 가능한 guest 식별 방식을 사용
- 과도한 매치메이킹, 랭킹, 관전, 리플레이는 뒤로 미룸

## 앞으로 남은 큰 작업

1. room presence를 더 정교하게 다듬기
   - true disconnect / background / reconnect 상태 구분
   - participant 상태 표현 세분화
2. room component를 더 작게 분리하기
   - `room-page-client.tsx`의 header / board / status / chat drawer 분리
3. room E2E를 더 촘촘하게 확장하기
   - role switch / unread badge / spectator fallback / reconnect edge case
4. endgame / retention polish 추가 다듬기
   - replay motivation / activity history / rematch clarity 강화
5. 시각 polish 후속 작업
   - spacing / hierarchy / motion / badge tone refinement

## 배포 체크리스트

- [x] `README.md` 최신 상태 유지
- [x] `.env.example` 최신 상태 유지
- [x] `npm run lint` 통과
- [x] `npm run test` 통과
- [x] `npm run test:e2e` 통과
- [x] `npm run build` 통과
- [x] Supabase 환경 변수 설정 완료
- [x] Vercel 프로젝트 연결 완료
- [x] Production 배포 완료

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
