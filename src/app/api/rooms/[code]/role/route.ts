import { NextResponse } from "next/server";
import { ensureGuestSessionId } from "@/lib/guest-session";
import { canEnterGuestSeat, type RoomPlayerRecord } from "@/lib/rooms/service";
import { getSupabaseAdminClient } from "@/lib/supabase/admin";

interface RoomRoleRouteContext {
  params: Promise<Record<string, string>>;
}

type TargetRole = "player" | "spectator";

export async function POST(request: Request, context: RoomRoleRouteContext) {
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

  const body = (await request.json().catch(() => ({}))) as { targetRole?: TargetRole };

  if (body.targetRole !== "player" && body.targetRole !== "spectator") {
    return NextResponse.json({ message: "targetRole이 필요합니다." }, { status: 400 });
  }

  const { data: room } = await supabase.from("rooms").select("id, code, status").eq("code", code).single();

  if (!room) {
    return NextResponse.json({ message: "해당 코드를 가진 방이 없습니다." }, { status: 404 });
  }

  if (room.status === "playing") {
    return NextResponse.json({ message: "게임 진행 중에는 역할을 바꿀 수 없습니다." }, { status: 409 });
  }

  const { data: players } = await supabase.from("room_players").select("guest_id, seat").eq("room_id", room.id);
  const normalizedPlayers: RoomPlayerRecord[] =
    players?.map((player) => ({ guestId: player.guest_id, seat: player.seat })) ?? [];
  const existingPlayer = normalizedPlayers.find((player) => player.guestId === guestId);

  if (body.targetRole === "spectator") {
    if (existingPlayer?.seat === "host") {
      return NextResponse.json({ message: "HOST는 관전으로 전환할 수 없습니다." }, { status: 403 });
    }

    if (existingPlayer?.seat === "guest") {
      const { error: deletePlayerError } = await supabase
        .from("room_players")
        .delete()
        .eq("room_id", room.id)
        .eq("guest_id", guestId);

      if (deletePlayerError) {
        return NextResponse.json({ message: "관전 전환에 실패했습니다." }, { status: 500 });
      }
    }

    const { error: upsertSpectatorError } = await supabase.from("room_spectators").upsert({
      room_id: room.id,
      guest_id: guestId,
    });

    if (upsertSpectatorError) {
      return NextResponse.json({ message: "관전 전환에 실패했습니다." }, { status: 500 });
    }

    return NextResponse.json({ ok: true, roomCode: room.code, role: "spectator" });
  }

  if (existingPlayer?.seat === "host") {
    return NextResponse.json({ ok: true, roomCode: room.code, role: "player", seat: "host" });
  }

  if (existingPlayer?.seat === "guest") {
    return NextResponse.json({ ok: true, roomCode: room.code, role: "player", seat: "guest" });
  }

  if (!canEnterGuestSeat(room.status, normalizedPlayers)) {
    return NextResponse.json({ message: "현재 guest 좌석에 참가할 수 없습니다." }, { status: 409 });
  }

  const { error: deleteSpectatorError } = await supabase
    .from("room_spectators")
    .delete()
    .eq("room_id", room.id)
    .eq("guest_id", guestId);

  if (deleteSpectatorError) {
    return NextResponse.json({ message: "guest 전환 준비에 실패했습니다." }, { status: 500 });
  }

  const { error: insertPlayerError } = await supabase.from("room_players").insert({
    room_id: room.id,
    guest_id: guestId,
    seat: "guest",
  });

  if (insertPlayerError) {
    return NextResponse.json({ message: "guest 자리 참가에 실패했습니다." }, { status: 500 });
  }

  return NextResponse.json({ ok: true, roomCode: room.code, role: "player", seat: "guest" });
}
