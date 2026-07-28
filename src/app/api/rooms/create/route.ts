import { NextResponse } from "next/server";
import { resolveRoomRequestContext } from "@/lib/rooms/request-context";
import { generateRoomCode } from "@/lib/rooms/service";

interface CreateRoomBody {
  turnTimeSeconds?: number;
}

export async function POST(request: Request) {
  const context = await resolveRoomRequestContext({ guestMode: "ensure" });

  if (!context.ok) {
    return context.response;
  }

  const { guestId, supabase } = context;

  const body = (await request.json().catch(() => ({}))) as CreateRoomBody;
  const turnTimeSeconds =
    typeof body.turnTimeSeconds === "number" && body.turnTimeSeconds >= 0 ? body.turnTimeSeconds : 0;

  const code = generateRoomCode();
  const { data: room, error: roomError } = await supabase
    .from("rooms")
    .insert({ code, status: "waiting", turn_time_seconds: turnTimeSeconds })
    .select("id, code, status")
    .single();

  if (roomError || !room) {
    return NextResponse.json({ message: "방 생성에 실패했습니다." }, { status: 500 });
  }

  const { error: playerError } = await supabase.from("room_players").insert({
    room_id: room.id,
    guest_id: guestId,
    seat: "host",
  });

  if (playerError) {
    await supabase.from("rooms").delete().eq("id", room.id);
    return NextResponse.json({ message: "호스트 참가 처리에 실패했습니다." }, { status: 500 });
  }

  return NextResponse.json({ roomCode: room.code, seat: "host", turnTimeSeconds });
}
