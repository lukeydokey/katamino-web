import { NextResponse } from "next/server";
import { createInitialGameSession, type LocalGameSession } from "@/domain/katamino/game-state";
import { getGuestSessionId } from "@/lib/guest-session";
import { computeDeadlineAt } from "@/lib/rooms/service";
import { getSupabaseAdminClient } from "@/lib/supabase/admin";

interface RematchBody {
  code?: string;
}

export async function POST(request: Request) {
  const supabase = getSupabaseAdminClient();

  if (!supabase) {
    return NextResponse.json(
      { message: "Supabase server 환경이 아직 설정되지 않았습니다." },
      { status: 503 },
    );
  }

  const guestId = await getGuestSessionId();

  if (!guestId) {
    return NextResponse.json({ message: "인증된 guest 세션이 필요합니다." }, { status: 401 });
  }

  const body = (await request.json()) as RematchBody;

  if (!body.code) {
    return NextResponse.json({ message: "code가 필요합니다." }, { status: 400 });
  }

  const { data: room } = await supabase
    .from("rooms")
    .select("id, code, status, turn_time_seconds")
    .eq("code", body.code)
    .single();

  if (!room) {
    return NextResponse.json({ message: "해당 코드를 가진 방이 없습니다." }, { status: 404 });
  }

  if (room.status !== "finished") {
    return NextResponse.json({ message: "종료된 게임에서만 다시 시작할 수 있습니다." }, { status: 409 });
  }

  const { data: players } = await supabase
    .from("room_players")
    .select("guest_id, seat")
    .eq("room_id", room.id);

  const requester = players?.find((player) => player.guest_id === guestId);

  if (!requester) {
    return NextResponse.json({ message: "방 참가자만 다시 시작할 수 있습니다." }, { status: 403 });
  }

  if (requester.seat !== "host") {
    return NextResponse.json({ message: "host만 다시 시작할 수 있습니다." }, { status: 403 });
  }

  if (!players || players.length !== 2) {
    return NextResponse.json({ message: "두 플레이어가 모두 있어야 다시 시작할 수 있습니다." }, { status: 409 });
  }

  const { data: roomGame } = await supabase
    .from("room_games")
    .select("state_json, version")
    .eq("room_id", room.id)
    .single();

  const gameState = roomGame?.state_json as LocalGameSession | undefined;

  if (!roomGame || !gameState || gameState.phase !== "finished") {
    return NextResponse.json({ message: "종료된 게임 상태를 찾을 수 없습니다." }, { status: 409 });
  }

  const nextState = createInitialGameSession();

  const { data: updatedGame, error: gameError } = await supabase
    .from("room_games")
    .update({
      state_json: nextState,
      version: roomGame.version + 1,
      deadline_at: computeDeadlineAt(room.turn_time_seconds),
    })
    .eq("room_id", room.id)
    .eq("version", roomGame.version)
    .select("version")
    .maybeSingle();

  if (gameError) {
    return NextResponse.json({ message: "리매치 상태 생성에 실패했습니다." }, { status: 500 });
  }

  if (!updatedGame) {
    return NextResponse.json({ message: "다른 플레이어의 변경이 먼저 반영되었습니다. 다시 시도해 주세요." }, { status: 409 });
  }

  const { error: roomError } = await supabase
    .from("rooms")
    .update({ status: "playing" })
    .eq("id", room.id);

  if (roomError) {
    return NextResponse.json({ message: "방 상태 초기화에 실패했습니다." }, { status: 500 });
  }

  return NextResponse.json({ ok: true, state: nextState });
}
