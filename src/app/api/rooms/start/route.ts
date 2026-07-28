import { NextResponse } from "next/server";
import { resolveRoomRequestContext } from "@/lib/rooms/request-context";
import {
  canStartRoom,
  computeDeadlineAt,
  createInitialRoomSnapshot,
  type RoomPlayerRecord,
} from "@/lib/rooms/service";

export async function POST(request: Request) {
  const body = (await request.json().catch(() => ({}))) as { code?: string };
  const context = await resolveRoomRequestContext({ guestMode: "get" });

  if (!context.ok) {
    return context.response;
  }

  const { guestId, supabase } = context;

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

  const { data: players } = await supabase
    .from("room_players")
    .select("guest_id, seat")
    .eq("room_id", room.id);

  const normalizedPlayers: RoomPlayerRecord[] =
    players?.map((player) => ({
      guestId: player.guest_id,
      seat: player.seat,
    })) ?? [];

  const requester = normalizedPlayers.find((player) => player.guestId === guestId);

  if (!requester) {
    return NextResponse.json({ message: "방 참가자만 게임을 시작할 수 있습니다." }, { status: 403 });
  }

  if (requester.seat !== "host") {
    return NextResponse.json({ message: "host만 게임을 시작할 수 있습니다." }, { status: 403 });
  }

  if (!canStartRoom(room.status, normalizedPlayers)) {
    return NextResponse.json({ message: "현재 상태에서는 게임을 시작할 수 없습니다." }, { status: 409 });
  }

  const deadlineAt = computeDeadlineAt(room.turn_time_seconds);
  const snapshot = createInitialRoomSnapshot();
  const { error: gameError } = await supabase.from("room_games").upsert({
    room_id: room.id,
    state_json: snapshot,
    version: 1,
    deadline_at: deadlineAt,
  });

  if (gameError) {
    return NextResponse.json({ message: "게임 상태 생성에 실패했습니다." }, { status: 500 });
  }

  const { error: roomError } = await supabase
    .from("rooms")
    .update({ status: "playing" })
    .eq("id", room.id);

  if (roomError) {
    await supabase.from("room_games").delete().eq("room_id", room.id);
    return NextResponse.json({ message: "방 상태 변경에 실패했습니다." }, { status: 500 });
  }

  return NextResponse.json({ roomCode: room.code, started: true });
}
