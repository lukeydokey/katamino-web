import { NextResponse } from "next/server";
import { getSupabaseAdminClient } from "@/lib/supabase/admin";
import { generateRoomCode } from "@/lib/rooms/service";
import { getCurrentGuestId } from "@/lib/supabase/auth";

export async function POST() {
  const supabase = getSupabaseAdminClient();

  if (!supabase) {
    return NextResponse.json(
      { message: "Supabase server 환경이 아직 설정되지 않았습니다." },
      { status: 503 },
    );
  }

  const currentGuest = await getCurrentGuestId();

  if (!currentGuest.ok) {
    return NextResponse.json({ message: "인증된 guest 세션이 필요합니다." }, { status: 401 });
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
    guest_id: currentGuest.guestId,
    seat: "host",
  });

  if (playerError) {
    return NextResponse.json({ message: "호스트 참가 처리에 실패했습니다." }, { status: 500 });
  }

  return NextResponse.json({ roomCode: room.code, seat: "host" });
}
