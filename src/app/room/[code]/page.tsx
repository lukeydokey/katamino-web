import { getGuestSessionId } from "@/lib/guest-session";
import { getSupabaseAdminClient } from "@/lib/supabase/admin";
import { RoomPageClient } from "@/components/katamino/room-page-client";

interface RoomPageProps {
  params: Promise<{ code: string }>;
}

export default async function RoomPage({ params }: RoomPageProps) {
  const { code } = await params;
  const supabase = getSupabaseAdminClient();
  const guestId = await getGuestSessionId();

  let seat: string | undefined;

  if (supabase && guestId) {
    const { data: room } = await supabase.from("rooms").select("id").eq("code", code).single();

    if (room) {
      const { data: player } = await supabase
        .from("room_players")
        .select("seat")
        .eq("room_id", room.id)
        .eq("guest_id", guestId)
        .single();

      seat = player?.seat;
    }
  }

  return <RoomPageClient roomCode={code} seat={seat} />;
}
