import { NextResponse } from "next/server";
import { createInitialGameSession, type LocalGameSession } from "@/domain/katamino/game-state";
import { resolveRoomPlayerRequestContext } from "@/lib/rooms/request-context";
import { computeDeadlineAt } from "@/lib/rooms/service";

interface RematchBody {
  code?: string;
}

export async function POST(request: Request) {
  const body = (await request.json().catch(() => ({}))) as RematchBody;

  if (!body.code) {
    return NextResponse.json({ message: "code가 필요합니다." }, { status: 400 });
  }

  const context = await resolveRoomPlayerRequestContext<{
    id: string;
    code: string;
    status: string;
    turn_time_seconds: number;
  }>({
    code: body.code,
    guestMode: "get",
    roomSelect: "id, code, status, turn_time_seconds",
  });

  if (!context.ok) {
    return context.response;
  }

  const { players, requester, room, supabase } = context;

  if (room.status !== "finished") {
    return NextResponse.json({ message: "종료된 게임에서만 다시 시작할 수 있습니다." }, { status: 409 });
  }

  if (!requester) {
    return NextResponse.json({ message: "방 참가자만 다시 시작할 수 있습니다." }, { status: 403 });
  }

  if (requester.seat !== "host") {
    return NextResponse.json({ message: "host만 다시 시작할 수 있습니다." }, { status: 403 });
  }

  if (players.length !== 2) {
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
