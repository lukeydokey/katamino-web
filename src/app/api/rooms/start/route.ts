import { NextResponse } from "next/server";
import {
  canStartRoom,
  createInitialRoomSnapshot,
  type RoomPlayerRecord,
} from "@/lib/rooms/service";
import { getCurrentGuestId } from "@/lib/supabase/auth";
import { getSupabaseAdminClient } from "@/lib/supabase/admin";

export async function POST(request: Request) {
  const supabase = getSupabaseAdminClient();

  if (!supabase) {
    return NextResponse.json(
      { message: "Supabase server 환경이 아직 설정되지 않았습니다." },
      { status: 503 },
    );
  }

  const body = (await request.json()) as { code?: string };
  const currentGuest = await getCurrentGuestId();

  if (!currentGuest.ok) {
    return NextResponse.json({ message: "인증된 guest 세션이 필요합니다." }, { status: 401 });
  }

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

  const normalizedPlayers: RoomPlayerRecord[] =
    players?.map((player) => ({
      guestId: player.guest_id,
      seat: player.seat,
    })) ?? [];

  const requester = normalizedPlayers.find((player) => player.guestId === currentGuest.guestId);

  if (!requester) {
    return NextResponse.json({ message: "방 참가자만 게임을 시작할 수 있습니다." }, { status: 403 });
  }

  if (requester.seat !== "host") {
    return NextResponse.json({ message: "host만 게임을 시작할 수 있습니다." }, { status: 403 });
  }

  if (!canStartRoom(room.status, normalizedPlayers)) {
    return NextResponse.json({ message: "현재 상태에서는 게임을 시작할 수 없습니다." }, { status: 409 });
  }

  const snapshot = createInitialRoomSnapshot();
  const { error: gameError } = await supabase.from("room_games").upsert({
    room_id: room.id,
    state_json: snapshot,
    version: 1,
  });

  if (gameError) {
    return NextResponse.json({ message: "게임 상태 생성에 실패했습니다." }, { status: 500 });
  }

  const { error: roomError } = await supabase
    .from("rooms")
    .update({ status: "playing" })
    .eq("id", room.id);

  if (roomError) {
    return NextResponse.json({ message: "방 상태 변경에 실패했습니다." }, { status: 500 });
  }

  return NextResponse.json({ roomCode: room.code, started: true });
}
