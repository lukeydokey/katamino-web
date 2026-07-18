import { NextResponse } from "next/server";
import { getGuestSessionId } from "@/lib/guest-session";
import { getSupabaseAdminClient } from "@/lib/supabase/admin";

interface RoomMessagesRouteContext {
  params: Promise<Record<string, string>>;
}

type SenderRole = "host" | "guest" | "spectator";

async function buildSenderRoleMap(
  supabase: NonNullable<Awaited<ReturnType<typeof getSupabaseAdminClient>>>,
  roomId: string,
) {
  const [playersResult, spectatorsResult] = await Promise.all([
    supabase
      .from("room_players")
      .select("guest_id, seat")
      .eq("room_id", roomId),
    supabase
      .from("room_spectators")
      .select("guest_id")
      .eq("room_id", roomId),
  ]);

  const senderRoleMap = new Map<string, SenderRole>();

  for (const player of playersResult.data ?? []) {
    senderRoleMap.set(player.guest_id, player.seat as SenderRole);
  }

  for (const spectator of spectatorsResult.data ?? []) {
    if (!senderRoleMap.has(spectator.guest_id)) {
      senderRoleMap.set(spectator.guest_id, "spectator");
    }
  }

  return senderRoleMap;
}

export async function GET(_: Request, context: RoomMessagesRouteContext) {
  const params = await context.params;
  const code = params.code;
  const supabase = getSupabaseAdminClient();

  if (!supabase) {
    return NextResponse.json({ message: "Supabase server 환경이 아직 설정되지 않았습니다." }, { status: 503 });
  }

  const { data: room } = await supabase.from("rooms").select("id").eq("code", code).single();

  if (!room) {
    return NextResponse.json({ message: "해당 코드를 가진 방이 없습니다." }, { status: 404 });
  }

  const senderRoleMap = await buildSenderRoleMap(supabase, room.id);

  const { data: messages } = await supabase
    .from("room_messages")
    .select("id, guest_id, body, created_at")
    .eq("room_id", room.id)
    .order("created_at", { ascending: true })
    .limit(50);

  return NextResponse.json({
    messages:
      messages?.map((message) => ({
        ...message,
        senderRole: senderRoleMap.get(message.guest_id) ?? "spectator",
      })) ?? [],
  });
}

export async function POST(request: Request, context: RoomMessagesRouteContext) {
  const params = await context.params;
  const code = params.code;
  const supabase = getSupabaseAdminClient();

  if (!supabase) {
    return NextResponse.json({ message: "Supabase server 환경이 아직 설정되지 않았습니다." }, { status: 503 });
  }

  const guestId = await getGuestSessionId();

  if (!guestId) {
    return NextResponse.json({ message: "인증된 guest 세션이 필요합니다." }, { status: 401 });
  }

  const body = (await request.json()) as { body?: string };

  if (!body.body?.trim()) {
    return NextResponse.json({ message: "메시지를 입력해 주세요." }, { status: 400 });
  }

  const { data: room } = await supabase.from("rooms").select("id").eq("code", code).single();

  if (!room) {
    return NextResponse.json({ message: "해당 코드를 가진 방이 없습니다." }, { status: 404 });
  }

  const { data: player } = await supabase
    .from("room_players")
    .select("guest_id")
    .eq("room_id", room.id)
    .eq("guest_id", guestId)
    .maybeSingle();

  const { data: spectator } = await supabase
    .from("room_spectators")
    .select("guest_id")
    .eq("room_id", room.id)
    .eq("guest_id", guestId)
    .maybeSingle();

  if (!player && !spectator) {
    return NextResponse.json({ message: "룸 참가자나 관전자만 채팅할 수 있습니다." }, { status: 403 });
  }

  const senderRoleMap = await buildSenderRoleMap(supabase, room.id);

  const { data: insertedMessage, error } = await supabase
    .from("room_messages")
    .insert({
      room_id: room.id,
      guest_id: guestId,
      body: body.body.trim(),
    })
    .select("id, guest_id, body, created_at")
    .single();

  if (error) {
    return NextResponse.json({ message: "메시지 전송에 실패했습니다." }, { status: 500 });
  }

  return NextResponse.json({
    ok: true,
    messageRecord: insertedMessage
      ? {
          ...insertedMessage,
          senderRole: senderRoleMap.get(insertedMessage.guest_id) ?? "spectator",
        }
      : null,
  });
}
