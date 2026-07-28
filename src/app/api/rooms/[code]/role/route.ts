import { NextResponse } from "next/server";
import { resolveRoomPlayerRequestContext } from "@/lib/rooms/request-context";
import { canEnterGuestSeat } from "@/lib/rooms/service";
import type { RoomStatus } from "@/domain/katamino/types";

interface RoomRoleRouteContext {
  params: Promise<Record<string, string>>;
}

type TargetRole = "player" | "spectator";

export async function POST(request: Request, context: RoomRoleRouteContext) {
  const params = await context.params;
  const code = params.code;

  const body = (await request.json().catch(() => ({}))) as { targetRole?: TargetRole };

  if (body.targetRole !== "player" && body.targetRole !== "spectator") {
    return NextResponse.json({ message: "targetRole이 필요합니다." }, { status: 400 });
  }

  const roomContext = await resolveRoomPlayerRequestContext<{
    id: string;
    code: string;
    status: string;
  }>({
    code,
    guestMode: "ensure",
    roomSelect: "id, code, status",
  });

  if (!roomContext.ok) {
    return roomContext.response;
  }

  const { guestId, players, requester: existingPlayer, room, supabase } = roomContext;

  if (room.status === "playing") {
    return NextResponse.json({ message: "게임 진행 중에는 역할을 바꿀 수 없습니다." }, { status: 409 });
  }

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

  if (!canEnterGuestSeat(room.status as RoomStatus, players)) {
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
