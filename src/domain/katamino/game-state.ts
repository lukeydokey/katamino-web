import { canPlacePiece, createBoard, placePiece } from "@/domain/katamino/board";
import { createPieceMap, rotateMaskClockwise } from "@/domain/katamino/pieces";
import type {
  BoardState,
  FinishedReason,
  GamePhase,
  PieceId,
  PieceMask,
  PlayerSeat,
} from "@/domain/katamino/types";

export interface SessionPieceState {
  id: PieceId;
  initialMask: PieceMask;
  currentMask: PieceMask;
  rotation: number;
}

export interface LocalGameSession {
  board: BoardState;
  pieces: Record<PieceId, SessionPieceState>;
  usedPieceIds: PieceId[];
  selectedPieceId: PieceId | null;
  phase: GamePhase;
  currentTurnSeat: PlayerSeat;
  turnNumber: number;
  winnerSeat: PlayerSeat | null;
  finishedReason: FinishedReason | null;
  message: string | null;
}

export interface PlacementResult {
  success: boolean;
  state: LocalGameSession;
  message: string | null;
}

function cloneMask(mask: PieceMask): PieceMask {
  return mask.map((row) => [...row]);
}

function createSessionPieces(): Record<PieceId, SessionPieceState> {
  const pieceMap = createPieceMap();

  return Object.values(pieceMap).reduce<Record<PieceId, SessionPieceState>>(
    (accumulator, piece) => {
      accumulator[piece.id] = {
        id: piece.id,
        initialMask: cloneMask(piece.mask),
        currentMask: cloneMask(piece.mask),
        rotation: 0,
      };

      return accumulator;
    },
    {} as Record<PieceId, SessionPieceState>,
  );
}

function getOppositeSeat(seat: PlayerSeat): PlayerSeat {
  return seat === "host" ? "guest" : "host";
}

export function createInitialGameSession(): LocalGameSession {
  return {
    board: createBoard(),
    pieces: createSessionPieces(),
    usedPieceIds: [],
    selectedPieceId: null,
    phase: "playing",
    currentTurnSeat: "host",
    turnNumber: 1,
    winnerSeat: null,
    finishedReason: null,
    message: null,
  };
}

export function createInitialGameState(): LocalGameSession {
  return createInitialGameSession();
}

export function resetGameSession(): LocalGameSession {
  return createInitialGameSession();
}

export function selectPiece(state: LocalGameSession, pieceId: PieceId): LocalGameSession {
  if (state.phase !== "playing") {
    return {
      ...state,
      message: "이미 종료된 게임입니다.",
    };
  }

  if (state.usedPieceIds.includes(pieceId)) {
    return {
      ...state,
      selectedPieceId: null,
      message: "이미 사용한 블록은 다시 선택할 수 없습니다.",
    };
  }

  const nextPieces = { ...state.pieces };

  if (state.selectedPieceId !== null && state.selectedPieceId !== pieceId) {
    const previousPiece = state.pieces[state.selectedPieceId];
    nextPieces[state.selectedPieceId] = {
      ...previousPiece,
      currentMask: cloneMask(previousPiece.initialMask),
      rotation: 0,
    };
  }

  return {
    ...state,
    pieces: nextPieces,
    selectedPieceId: pieceId,
    message: `${pieceId} 선택됨`,
  };
}

export function rotateSelectedPiece(state: LocalGameSession): LocalGameSession {
  if (state.phase !== "playing" || state.selectedPieceId === null) {
    return state;
  }

  const selectedPiece = state.pieces[state.selectedPieceId];
  const rotatedMask = rotateMaskClockwise(selectedPiece.currentMask);

  return {
    ...state,
    pieces: {
      ...state.pieces,
      [selectedPiece.id]: {
        ...selectedPiece,
        currentMask: rotatedMask,
        rotation: (selectedPiece.rotation + 1) % 4,
      },
    },
    message: `${selectedPiece.id} 회전`,
  };
}

export function placeSelectedPiece(
  state: LocalGameSession,
  x: number,
  y: number,
): PlacementResult {
  if (state.phase !== "playing") {
    return {
      success: false,
      state: {
        ...state,
        message: "이미 종료된 게임입니다.",
      },
      message: "이미 종료된 게임입니다.",
    };
  }

  if (state.selectedPieceId === null) {
    return {
      success: false,
      state: {
        ...state,
        message: "먼저 블록을 선택해야 합니다.",
      },
      message: "먼저 블록을 선택해야 합니다.",
    };
  }

  const selectedPiece = state.pieces[state.selectedPieceId];

  if (!canPlacePiece(state.board, selectedPiece.currentMask, x, y)) {
    return {
      success: false,
      state: {
        ...state,
        message: "현재 위치에는 블록을 놓을 수 없습니다.",
      },
      message: "현재 위치에는 블록을 놓을 수 없습니다.",
    };
  }

  const nextBoard = placePiece(
    state.board,
    selectedPiece.id,
    selectedPiece.currentMask,
    x,
    y,
  );
  const nextUsedPieceIds = [...state.usedPieceIds, selectedPiece.id];

  const nextState: LocalGameSession = {
    ...state,
    board: nextBoard,
    usedPieceIds: nextUsedPieceIds,
    selectedPieceId: null,
    currentTurnSeat: getOppositeSeat(state.currentTurnSeat),
    turnNumber: state.turnNumber + 1,
    message: `${selectedPiece.id} 배치 완료`,
  };

  return {
    success: true,
    state: nextState,
    message: nextState.message,
  };
}

export function forfeitGame(
  state: LocalGameSession,
  forfeitingSeat: PlayerSeat,
): LocalGameSession {
  return {
    ...state,
    phase: "finished",
    winnerSeat: getOppositeSeat(forfeitingSeat),
    finishedReason: "forfeit",
    selectedPieceId: null,
    message: `${forfeitingSeat} 기권`,
  };
}
