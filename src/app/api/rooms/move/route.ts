import { NextResponse } from "next/server";
import { canPlacePiece, placePiece } from "@/domain/katamino/board";
import type { LocalGameSession } from "@/domain/katamino/game-state";
import { rotateMaskClockwise } from "@/domain/katamino/pieces";
import type { PieceMask, PlayerSeat } from "@/domain/katamino/types";
import { getGuestSessionId } from "@/lib/guest-session";
import { getSupabaseAdminClient } from "@/lib/supabase/admin";

interface MoveBody {
  code?: string;
  pieceId?: string;
  rotation?: number;
  x?: number;
  y?: number;
}

function buildRotatedMask(mask: PieceMask, rotation: number) {
  let nextMask = mask.map((row) => [...row]);

  for (let index = 0; index < rotation; index += 1) {
    nextMask = rotateMaskClockwise(nextMask);
  }

  return nextMask;
}

function getOppositeSeat(seat: PlayerSeat): PlayerSeat {
  return seat === "host" ? "guest" : "host";
}

export async function POST(request: Request) {
  const supabase = getSupabaseAdminClient();

  if (!supabase) {
    return NextResponse.json(
      { message: "Supabase server 환경이 아직 설정되지 않았습니다." },
      { status: 503 },
    );
  }

  const guestId = await getGuestSessionId();

  if (!guestId) {
    return NextResponse.json({ message: "인증된 guest 세션이 필요합니다." }, { status: 401 });
  }

  const body = (await request.json()) as MoveBody;

  if (
    !body.code ||
    !body.pieceId ||
    typeof body.rotation !== "number" ||
    typeof body.x !== "number" ||
    typeof body.y !== "number"
  ) {
    return NextResponse.json({ message: "필수 move 정보가 부족합니다." }, { status: 400 });
  }

  const { data: room } = await supabase
    .from("rooms")
    .select("id, code, status")
    .eq("code", body.code)
    .single();

  if (!room) {
    return NextResponse.json({ message: "해당 코드를 가진 방이 없습니다." }, { status: 404 });
  }

  if (room.status !== "playing") {
    return NextResponse.json({ message: "아직 진행 중인 게임이 아닙니다." }, { status: 409 });
  }

  const { data: players } = await supabase
    .from("room_players")
    .select("guest_id, seat")
    .eq("room_id", room.id);

  const requester = players?.find((player) => player.guest_id === guestId);

  if (!requester) {
    return NextResponse.json({ message: "방 참가자만 둘 수 있습니다." }, { status: 403 });
  }

  const { data: roomGame } = await supabase
    .from("room_games")
    .select("state_json, version")
    .eq("room_id", room.id)
    .single();

  const gameState = roomGame?.state_json as LocalGameSession | undefined;

  if (!roomGame || !gameState) {
    return NextResponse.json({ message: "게임 상태를 찾을 수 없습니다." }, { status: 404 });
  }

  if (gameState.phase !== "playing") {
    return NextResponse.json({ message: "이미 종료된 게임입니다." }, { status: 409 });
  }

  if (gameState.currentTurnSeat !== requester.seat) {
    return NextResponse.json({ message: "현재는 상대 턴입니다." }, { status: 409 });
  }

  if (gameState.usedPieceIds.includes(body.pieceId as never)) {
    return NextResponse.json({ message: "이미 사용한 블록입니다." }, { status: 409 });
  }

  const piece = gameState.pieces[body.pieceId as keyof typeof gameState.pieces];

  if (!piece) {
    return NextResponse.json({ message: "존재하지 않는 블록입니다." }, { status: 400 });
  }

  const rotatedMask = buildRotatedMask(piece.initialMask, body.rotation % 4);

  if (!canPlacePiece(gameState.board, rotatedMask, body.x, body.y)) {
    return NextResponse.json({ message: "현재 위치에는 블록을 놓을 수 없습니다." }, { status: 409 });
  }

  const nextBoard = placePiece(gameState.board, piece.id, rotatedMask, body.x, body.y);
  const nextState: LocalGameSession = {
    ...gameState,
    board: nextBoard,
    usedPieceIds: [...gameState.usedPieceIds, piece.id],
    currentTurnSeat: getOppositeSeat(gameState.currentTurnSeat),
    turnNumber: gameState.turnNumber + 1,
    selectedPieceId: null,
    message: `${piece.id} 배치 완료`,
    pieces: {
      ...gameState.pieces,
      [piece.id]: {
        ...piece,
        currentMask: rotatedMask,
        rotation: body.rotation % 4,
      },
    },
  };

  const { data: updatedGame, error } = await supabase
    .from("room_games")
    .update({ state_json: nextState, version: roomGame.version + 1 })
    .eq("room_id", room.id)
    .eq("version", roomGame.version)
    .select("version")
    .maybeSingle();

  if (error) {
    return NextResponse.json({ message: "게임 상태 저장에 실패했습니다." }, { status: 500 });
  }

  if (!updatedGame) {
    return NextResponse.json({ message: "다른 플레이어의 변경이 먼저 반영되었습니다. 다시 시도해 주세요." }, { status: 409 });
  }

  return NextResponse.json({ ok: true, state: nextState });
}
