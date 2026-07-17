import { canPlacePiece, createBoard, placePiece } from "@/domain/katamino/board";
import { createPieceMap, rotateMaskClockwise } from "@/domain/katamino/pieces";
import type {
  BoardState,
  PieceId,
  PieceMask,
} from "@/domain/katamino/types";

export interface LocalPieceState {
  id: PieceId;
  initialMask: PieceMask;
  currentMask: PieceMask;
  rotation: number;
}

export interface LocalGameState {
  board: BoardState;
  pieces: Record<PieceId, LocalPieceState>;
  selectedPieceId: PieceId | null;
  usedPieceIds: Set<PieceId>;
  message: string | null;
}

export interface PlacementResult {
  success: boolean;
  state: LocalGameState;
  message: string | null;
}

function buildLocalPieces(): Record<PieceId, LocalPieceState> {
  const pieceMap = createPieceMap();

  return Object.values(pieceMap).reduce<Record<PieceId, LocalPieceState>>(
    (accumulator, piece) => {
      accumulator[piece.id] = {
        id: piece.id,
        initialMask: piece.mask.map((row) => [...row]),
        currentMask: piece.mask.map((row) => [...row]),
        rotation: 0,
      };

      return accumulator;
    },
    {} as Record<PieceId, LocalPieceState>,
  );
}

export function createInitialGameState(): LocalGameState {
  return {
    board: createBoard(),
    pieces: buildLocalPieces(),
    selectedPieceId: null,
    usedPieceIds: new Set<PieceId>(),
    message: null,
  };
}

export function selectPiece(state: LocalGameState, pieceId: PieceId): LocalGameState {
  if (state.usedPieceIds.has(pieceId)) {
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
      currentMask: previousPiece.initialMask.map((row) => [...row]),
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

export function rotateSelectedPiece(state: LocalGameState): LocalGameState {
  if (state.selectedPieceId === null) {
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
  state: LocalGameState,
  x: number,
  y: number,
): PlacementResult {
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
  const nextUsedPieceIds = new Set(state.usedPieceIds);
  nextUsedPieceIds.add(selectedPiece.id);

  const nextState: LocalGameState = {
    board: nextBoard,
    pieces: state.pieces,
    selectedPieceId: null,
    usedPieceIds: nextUsedPieceIds,
    message: `${selectedPiece.id} 배치 완료`,
  };

  return {
    success: true,
    state: nextState,
    message: nextState.message,
  };
}
