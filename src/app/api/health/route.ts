import { NextResponse } from "next/server";
import {
  isRoomBackendReady,
  resolveRoomRequestContext,
} from "@/lib/rooms/request-context";

export async function GET() {
  const context = await resolveRoomRequestContext({ guestMode: "skip" });

  if (!context.ok) {
    return context.response;
  }

  const backendReady = await isRoomBackendReady(context.supabase);

  if (!backendReady) {
    return NextResponse.json(
      { message: "현재는 온라인 룸 기능을 사용할 수 없습니다." },
      { status: 503 },
    );
  }

  return NextResponse.json({ ok: true });
}
