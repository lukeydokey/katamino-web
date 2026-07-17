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

  if (!guestId) {
    return NextResponse.json({ message: "guest 세션 생성에 실패했습니다." }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
