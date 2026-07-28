import { NextResponse } from "next/server";
import type { RoomPlayerRecord } from "@/lib/rooms/service";
import { ensureGuestSessionId, getGuestSessionId } from "@/lib/guest-session";
import { getSupabaseAdminClient } from "@/lib/supabase/admin";

type RoomGuestMode = "ensure" | "get" | "skip";

type SupabaseAdminClient = NonNullable<ReturnType<typeof getSupabaseAdminClient>>;

interface RoomRequestContextOptions {
  guestMode?: RoomGuestMode;
}

interface RoomRequestContextSuccess {
  ok: true;
  supabase: SupabaseAdminClient;
  guestId: string | null;
}

interface RoomRequestContextFailure {
  ok: false;
  response: NextResponse;
}

export type RoomRequestContextResult =
  | RoomRequestContextSuccess
  | RoomRequestContextFailure;

interface ResolveRoomPlayerRequestContextOptions {
  code: string;
  guestMode: Exclude<RoomGuestMode, "skip">;
  roomSelect: string;
}

interface RoomPlayerRow {
  guest_id: string;
  seat: RoomPlayerRecord["seat"];
}

interface RoomPlayerRequestContextSuccess<TRoom extends { id: string; code: string }> {
  ok: true;
  supabase: SupabaseAdminClient;
  guestId: string;
  room: TRoom;
  players: RoomPlayerRecord[];
  requester: RoomPlayerRecord | null;
}

type RoomPlayerRequestContextResult<TRoom extends { id: string; code: string }> =
  | RoomPlayerRequestContextSuccess<TRoom>
  | RoomRequestContextFailure;

const ROOM_BACKEND_READINESS_PROBES = [
  { table: "rooms", column: "id" },
  { table: "room_players", column: "id" },
  { table: "room_games", column: "id" },
  { table: "room_spectators", column: "room_id" },
  { table: "room_messages", column: "id" },
] as const;

export async function resolveRoomRequestContext(
  options: RoomRequestContextOptions = {},
): Promise<RoomRequestContextResult> {
  const guestMode = options.guestMode ?? "skip";
  const supabase = getSupabaseAdminClient();

  if (!supabase) {
    return {
      ok: false,
      response: NextResponse.json(
        { message: "Supabase server 환경이 아직 설정되지 않았습니다." },
        { status: 503 },
      ),
    };
  }

  let guestId: string | null = null;

  if (guestMode === "ensure") {
    guestId = await ensureGuestSessionId();
  }

  if (guestMode === "get") {
    guestId = await getGuestSessionId();
  }

  if (guestMode !== "skip" && !guestId) {
    return {
      ok: false,
      response: NextResponse.json(
        { message: "인증된 guest 세션이 필요합니다." },
        { status: 401 },
      ),
    };
  }

  return {
    ok: true,
    supabase,
    guestId,
  };
}

export async function resolveRoomPlayerRequestContext<TRoom extends { id: string; code: string }>(
  options: ResolveRoomPlayerRequestContextOptions,
): Promise<RoomPlayerRequestContextResult<TRoom>> {
  const context = await resolveRoomRequestContext({ guestMode: options.guestMode });

  if (!context.ok) {
    return context;
  }

  const { guestId, supabase } = context;
  const roomResult = await supabase
    .from("rooms")
    .select(options.roomSelect)
    .eq("code", options.code)
    .single();

  if (roomResult.error) {
    return {
      ok: false,
      response: NextResponse.json(
        { message: "방 정보를 불러오는 중 문제가 발생했습니다." },
        { status: 500 },
      ),
    };
  }

  const room = roomResult.data as unknown as TRoom | null;

  if (!room) {
    return {
      ok: false,
      response: NextResponse.json({ message: "해당 코드를 가진 방이 없습니다." }, { status: 404 }),
    };
  }

  const playersResult = await supabase
    .from("room_players")
    .select("guest_id, seat")
    .eq("room_id", room.id);

  if (playersResult.error) {
    return {
      ok: false,
      response: NextResponse.json(
        { message: "방 참가 정보를 불러오는 중 문제가 발생했습니다." },
        { status: 500 },
      ),
    };
  }

  const players = playersResult.data as RoomPlayerRow[] | null;

  const normalizedPlayers: RoomPlayerRecord[] =
    players?.map((player) => ({
      guestId: player.guest_id,
      seat: player.seat,
    })) ?? [];

  return {
    ok: true,
    supabase,
    guestId: guestId as string,
    room,
    players: normalizedPlayers,
    requester: normalizedPlayers.find((player) => player.guestId === guestId) ?? null,
  };
}

export async function isRoomBackendReady(
  supabase: SupabaseAdminClient,
): Promise<boolean> {
  try {
    for (const probe of ROOM_BACKEND_READINESS_PROBES) {
      const { error } = await supabase
        .from(probe.table)
        .select(probe.column)
        .limit(1);

      if (error) {
        return false;
      }
    }

    return true;
  } catch {
    return false;
  }
}
