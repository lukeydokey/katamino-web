import { NextResponse } from "next/server";
import { createInitialGameSession } from "@/domain/katamino/game-state";
import { getGuestSessionId } from "@/lib/guest-session";
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
    .select("id, code, status")
    .eq("code", body.code)
    .single();

  if (!room) {
    return NextResponse.json({ message: "해당 코드를 가진 방이 없습니다." }, { status: 404 });
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

  const nextState = createInitialGameSession();

  const { error: gameError } = await supabase
    .from("room_games")
    .update({ state_json: nextState, version: 1 })
    .eq("room_id", room.id);

  if (gameError) {
    return NextResponse.json({ message: "리매치 상태 생성에 실패했습니다." }, { status: 500 });
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
