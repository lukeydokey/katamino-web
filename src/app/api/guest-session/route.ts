import { NextResponse } from "next/server";
import { ensureGuestSessionId } from "@/lib/guest-session";
import { readServerSupabaseEnv } from "@/lib/env";

export async function POST() {
  const env = readServerSupabaseEnv();

  if (!env) {
    return NextResponse.json(
      { message: "Supabase server 환경이 아직 설정되지 않았습니다." },
      { status: 503 },
    );
  }

  const guestId = await ensureGuestSessionId();

  return NextResponse.json({ guestId, ok: true });
}
