import type { LocalGameSession } from "@/domain/katamino/game-state";
import { createInitialGameSession } from "@/domain/katamino/game-state";
import type { PlayerSeat, RoomStatus } from "@/domain/katamino/types";

export interface RoomPlayerRecord {
  guestId: string;
  seat: PlayerSeat;
}

export interface RoomSnapshotSummary {
  roomCode: string;
  status: RoomStatus;
  players: RoomPlayerRecord[];
  canStart: boolean;
  gameState: LocalGameSession | null;
  turnTimeSeconds: number;
  deadlineAt: string | null;
  spectatorCount: number;
}

const ROOM_CODE_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";

export function generateRoomCode(random = Math.random, length = 6) {
  let code = "";

  for (let index = 0; index < length; index += 1) {
    const alphabetIndex = Math.floor(random() * ROOM_CODE_ALPHABET.length);
    code += ROOM_CODE_ALPHABET[alphabetIndex];
  }

  return code;
}

export function getAvailableSeat(players: RoomPlayerRecord[]): PlayerSeat | null {
  const seats = new Set(players.map((player) => player.seat));

  if (!seats.has("host")) {
    return "host";
  }

  if (!seats.has("guest")) {
    return "guest";
  }

  return null;
}

export function canStartRoom(status: RoomStatus, players: RoomPlayerRecord[]) {
  return status === "waiting" && players.length === 2 && getAvailableSeat(players) === null;
}

export function createInitialRoomSnapshot() {
  return createInitialGameSession();
}

export function serializeRoomSnapshot() {
  return JSON.parse(JSON.stringify(createInitialRoomSnapshot()));
}

export function summarizeRoomState(
  roomCode: string,
  status: RoomStatus,
  players: RoomPlayerRecord[],
  gameState: LocalGameSession | null,
  turnTimeSeconds: number,
  deadlineAt: string | null,
  spectatorCount: number,
): RoomSnapshotSummary {
  return {
    roomCode,
    status,
    players,
    canStart: canStartRoom(status, players),
    gameState,
    turnTimeSeconds,
    deadlineAt,
    spectatorCount,
  };
}

export function computeDeadlineAt(turnTimeSeconds: number) {
  if (turnTimeSeconds <= 0) {
    return null;
  }

  return new Date(Date.now() + turnTimeSeconds * 1000).toISOString();
}

export function isDeadlineExpired(deadlineAt: string | null) {
  if (!deadlineAt) {
    return false;
  }

  return new Date(deadlineAt).getTime() <= Date.now();
}
