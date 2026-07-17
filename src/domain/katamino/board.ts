import {
  BOARD_SIZE,
  PIECE_MASK_SIZE,
  type BoardState,
  type PieceId,
  type PieceMask,
} from "@/domain/katamino/types";

export function createBoard(): BoardState {
  return Array.from({ length: BOARD_SIZE }, () =>
    Array.from({ length: BOARD_SIZE }, () => null),
  );
}

export function canPlacePiece(
  board: BoardState,
  mask: PieceMask,
  x: number,
  y: number,
): boolean {
  let horizontalCount = 0;

  for (let boardX = x - 2; boardX <= x + 2; boardX += 1) {
    let verticalCount = 0;

    for (let boardY = y - 2; boardY <= y + 2; boardY += 1) {
      const isFilledCell = mask[verticalCount][horizontalCount] === 1;

      if (boardX < 0 || boardX >= BOARD_SIZE || boardY < 0 || boardY >= BOARD_SIZE) {
        if (isFilledCell) {
          return false;
        }
      } else if (board[boardY][boardX] !== null && isFilledCell) {
        return false;
      }

      verticalCount += 1;
    }

    horizontalCount += 1;
  }

  return true;
}

export function placePiece(
  board: BoardState,
  pieceId: PieceId,
  mask: PieceMask,
  x: number,
  y: number,
): BoardState {
  if (!canPlacePiece(board, mask, x, y)) {
    throw new Error("배치할 수 없는 위치입니다.");
  }

  const nextBoard = board.map((row) => [...row]);
  let horizontalCount = 0;

  for (let boardX = x - 2; boardX <= x + 2; boardX += 1) {
    let verticalCount = 0;

    for (let boardY = y - 2; boardY <= y + 2; boardY += 1) {
      const isFilledCell = mask[verticalCount][horizontalCount] === 1;

      if (
        isFilledCell &&
        boardX >= 0 &&
        boardX < BOARD_SIZE &&
        boardY >= 0 &&
        boardY < BOARD_SIZE
      ) {
        nextBoard[boardY][boardX] = pieceId;
      }

      verticalCount += 1;
    }

    horizontalCount += 1;
  }

  return nextBoard;
}

export function countOccupiedCells(board: BoardState): number {
  return board.flat().filter((cell) => cell !== null).length;
}

export function getFilledCoordinates(mask: PieceMask) {
  const coordinates: Array<{ x: number; y: number }> = [];

  for (let y = 0; y < PIECE_MASK_SIZE; y += 1) {
    for (let x = 0; x < PIECE_MASK_SIZE; x += 1) {
      if (mask[y][x] === 1) {
        coordinates.push({ x, y });
      }
    }
  }

  return coordinates;
}
