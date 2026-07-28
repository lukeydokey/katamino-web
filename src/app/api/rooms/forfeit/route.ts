import { NextResponse } from "next/server";
import { forfeitGame, type LocalGameSession } from "@/domain/katamino/game-state";
import { resolveRoomPlayerRequestContext } from "@/lib/rooms/request-context";

interface ForfeitBody {
  code?: string;
}

export async function POST(request: Request) {
  const body = (await request.json().catch(() => ({}))) as ForfeitBody;

  if (!body.code) {
    return NextResponse.json({ message: "code가 필요합니다." }, { status: 400 });
  }

  const context = await resolveRoomPlayerRequestContext<{
    id: string;
    code: string;
    status: string;
  }>({
    code: body.code,
    guestMode: "get",
    roomSelect: "id, code, status",
  });

  if (!context.ok) {
    return context.response;
  }

  const { requester, room, supabase } = context;

  if (!requester) {
    return NextResponse.json({ message: "방 참가자만 기권할 수 있습니다." }, { status: 403 });
  }

  const { data: roomGame } = await supabase
    .from("room_games")
    .select("state_json, version")
    .eq("room_id", room.id)
    .single();

  const gameState = roomGame?.state_json as LocalGameSession | undefined;

  if (!roomGame || !gameState) {
    return NextResponse.json({ message: "게임 상태를 찾을 수 없습니다." }, { status: 404 });
  }

  if (gameState.phase !== "playing") {
    return NextResponse.json({ message: "이미 종료된 게임입니다." }, { status: 409 });
  }

  const nextState = forfeitGame(gameState, requester.seat);

  const { data: updatedGame, error: gameError } = await supabase
    .from("room_games")
    .update({ state_json: nextState, version: roomGame.version + 1 })
    .eq("room_id", room.id)
    .eq("version", roomGame.version)
    .select("version")
    .maybeSingle();

  if (gameError) {
    return NextResponse.json({ message: "기권 처리에 실패했습니다." }, { status: 500 });
  }

  if (!updatedGame) {
    return NextResponse.json({ message: "다른 플레이어의 변경이 먼저 반영되었습니다. 다시 시도해 주세요." }, { status: 409 });
  }

  const { error: roomError } = await supabase
    .from("rooms")
    .update({ status: "finished" })
    .eq("id", room.id);

  if (roomError) {
    return NextResponse.json({ message: "방 상태 종료 처리에 실패했습니다." }, { status: 500 });
  }

  return NextResponse.json({ ok: true, state: nextState });
}
