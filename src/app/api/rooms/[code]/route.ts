import { NextResponse } from "next/server";
import { summarizeRoomState, type RoomPlayerRecord } from "@/lib/rooms/service";
import { getSupabaseAdminClient } from "@/lib/supabase/admin";
import type { LocalGameSession } from "@/domain/katamino/game-state";

interface RoomRouteContext {
  params: Promise<Record<string, string>>;
}

export async function GET(_: Request, context: RoomRouteContext) {
  const params = await context.params;
  const code = params.code;
  const supabase = getSupabaseAdminClient();

  if (!supabase) {
    return NextResponse.json(
      { message: "Supabase server 환경이 아직 설정되지 않았습니다." },
      { status: 503 },
    );
  }

  const { data: room } = await supabase
    .from("rooms")
    .select("id, code, status")
    .eq("code", code)
    .single();

  if (!room) {
    return NextResponse.json({ message: "해당 코드를 가진 방이 없습니다." }, { status: 404 });
  }

  const { data: players } = await supabase
    .from("room_players")
    .select("guest_id, seat")
    .eq("room_id", room.id)
    .order("joined_at", { ascending: true });

  const normalizedPlayers: RoomPlayerRecord[] =
    players?.map((player) => ({
      guestId: player.guest_id,
      seat: player.seat,
    })) ?? [];

  const { data: roomGame } = await supabase
    .from("room_games")
    .select("state_json")
    .eq("room_id", room.id)
    .maybeSingle();

  const gameState = (roomGame?.state_json as LocalGameSession | null | undefined) ?? null;

  const summary = summarizeRoomState(room.code, room.status, normalizedPlayers, gameState);

  return NextResponse.json(summary);
}
