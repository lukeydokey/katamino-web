import { NextResponse } from "next/server";
import { forfeitGame, type LocalGameSession } from "@/domain/katamino/game-state";
import { summarizeRoomState, type RoomPlayerRecord } from "@/lib/rooms/service";
import { isDeadlineExpired } from "@/lib/rooms/service";
import { getSupabaseAdminClient } from "@/lib/supabase/admin";

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
    .select("id, code, status, turn_time_seconds")
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

  const { count: spectatorCount } = await supabase
    .from("room_spectators")
    .select("*", { count: "exact", head: true })
    .eq("room_id", room.id);

  const { data: roomGame } = await supabase
    .from("room_games")
    .select("state_json, version, deadline_at")
    .eq("room_id", room.id)
    .maybeSingle();

  let gameState = (roomGame?.state_json as LocalGameSession | null | undefined) ?? null;
  let roomStatus = room.status;
  let deadlineAt = roomGame?.deadline_at ?? null;

  if (gameState && roomStatus === "playing" && gameState.phase === "playing" && isDeadlineExpired(deadlineAt)) {
    const expiredState = forfeitGame(gameState, gameState.currentTurnSeat);

    await supabase
      .from("room_games")
      .update({ state_json: expiredState, version: (roomGame?.version ?? 0) + 1, deadline_at: null })
      .eq("room_id", room.id)
      .eq("version", roomGame?.version ?? 0);

    await supabase.from("rooms").update({ status: "finished" }).eq("id", room.id);

    gameState = {
      ...expiredState,
      finishedReason: "timeout",
      message: `${gameState.currentTurnSeat} 시간 초과`,
    };
    roomStatus = "finished";
    deadlineAt = null;
  }

  const summary = summarizeRoomState(
    room.code,
    roomStatus,
    normalizedPlayers,
    gameState,
    room.turn_time_seconds,
    deadlineAt,
    spectatorCount ?? 0,
  );

  return NextResponse.json(summary);
}
