import { NextResponse } from "next/server";
import { getSupabaseAdminClient } from "@/lib/supabase/admin";
import { generateRoomCode } from "@/lib/rooms/service";

export async function POST(request: Request) {
  const supabase = getSupabaseAdminClient();

  if (!supabase) {
    return NextResponse.json(
      { message: "Supabase server 환경이 아직 설정되지 않았습니다." },
      { status: 503 },
    );
  }

  const body = (await request.json()) as { guestId?: string };

  if (!body.guestId) {
    return NextResponse.json({ message: "guestId가 필요합니다." }, { status: 400 });
  }

  const code = generateRoomCode();
  const { data: room, error: roomError } = await supabase
    .from("rooms")
    .insert({ code, status: "waiting" })
    .select("id, code, status")
    .single();

  if (roomError || !room) {
    return NextResponse.json({ message: "방 생성에 실패했습니다." }, { status: 500 });
  }

  const { error: playerError } = await supabase.from("room_players").insert({
    room_id: room.id,
    guest_id: body.guestId,
    seat: "host",
  });

  if (playerError) {
    return NextResponse.json({ message: "호스트 참가 처리에 실패했습니다." }, { status: 500 });
  }

  return NextResponse.json({ roomCode: room.code, seat: "host" });
}
