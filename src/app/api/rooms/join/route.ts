import { NextResponse } from "next/server";
import { resolveRoomRequestContext } from "@/lib/rooms/request-context";
import { canEnterGuestSeat, getAvailableSeat, type RoomPlayerRecord } from "@/lib/rooms/service";

export async function POST(request: Request) {
  const body = (await request.json().catch(() => ({}))) as { code?: string };
  const context = await resolveRoomRequestContext({ guestMode: "ensure" });

  if (!context.ok) {
    return context.response;
  }

  const { guestId, supabase } = context;

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

  const existingPlayer = normalizedPlayers.find((player) => player.guestId === guestId);

  if (existingPlayer) {
    return NextResponse.json({ roomCode: room.code, seat: existingPlayer.seat, role: "player" });
  }

  const { data: existingSpectator } = await supabase
    .from("room_spectators")
    .select("guest_id")
    .eq("room_id", room.id)
    .eq("guest_id", guestId)
    .maybeSingle();

  if (existingSpectator) {
    return NextResponse.json({ roomCode: room.code, role: "spectator" });
  }

  if (canEnterGuestSeat(room.status, normalizedPlayers)) {
    const seat = getAvailableSeat(normalizedPlayers);

    if (seat !== "guest") {
      return NextResponse.json({ message: "guest 좌석을 확인하는 중 문제가 발생했습니다." }, { status: 409 });
    }

    const { error } = await supabase.from("room_players").insert({
      room_id: room.id,
      guest_id: guestId,
      seat,
    });

    if (error) {
      return NextResponse.json({ message: "방 참가에 실패했습니다." }, { status: 500 });
    }

    return NextResponse.json({ roomCode: room.code, seat, role: "player" });
  }

  const { error } = await supabase.from("room_spectators").upsert({
    room_id: room.id,
    guest_id: guestId,
  });

  if (error) {
    return NextResponse.json({ message: "관전 참가에 실패했습니다." }, { status: 500 });
  }

  return NextResponse.json({ roomCode: room.code, role: "spectator" });
}
