import { NextResponse } from "next/server";
import { ensureGuestSessionId } from "@/lib/guest-session";
import { getAvailableSeat, type RoomPlayerRecord } from "@/lib/rooms/service";
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
  const guestId = await ensureGuestSessionId();

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
    return NextResponse.json({ roomCode: room.code, seat: existingPlayer.seat });
  }

  const seat = getAvailableSeat(normalizedPlayers);

  if (!seat) {
    return NextResponse.json({ message: "이미 가득 찬 방입니다." }, { status: 409 });
  }

  const { error } = await supabase.from("room_players").insert({
    room_id: room.id,
    guest_id: guestId,
    seat,
  });

  if (error) {
    return NextResponse.json({ message: "방 참가에 실패했습니다." }, { status: 500 });
  }

  return NextResponse.json({ roomCode: room.code, seat });
}
