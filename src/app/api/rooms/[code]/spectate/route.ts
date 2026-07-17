import { NextResponse } from "next/server";
import { ensureGuestSessionId } from "@/lib/guest-session";
import { getSupabaseAdminClient } from "@/lib/supabase/admin";

interface RoomSpectateRouteContext {
  params: Promise<Record<string, string>>;
}

export async function POST(_: Request, context: RoomSpectateRouteContext) {
  const params = await context.params;
  const code = params.code;
  const supabase = getSupabaseAdminClient();

  if (!supabase) {
    return NextResponse.json({ message: "Supabase server 환경이 아직 설정되지 않았습니다." }, { status: 503 });
  }

  const guestId = await ensureGuestSessionId();

  if (!guestId) {
    return NextResponse.json({ message: "인증된 guest 세션이 필요합니다." }, { status: 401 });
  }

  const { data: room } = await supabase.from("rooms").select("id, code").eq("code", code).single();

  if (!room) {
    return NextResponse.json({ message: "해당 코드를 가진 방이 없습니다." }, { status: 404 });
  }

  const { data: existingPlayer } = await supabase
    .from("room_players")
    .select("guest_id")
    .eq("room_id", room.id)
    .eq("guest_id", guestId)
    .maybeSingle();

  if (existingPlayer) {
    return NextResponse.json({ roomCode: room.code, role: "player" });
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
