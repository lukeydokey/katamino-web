export const BOARD_SIZE = 8;
export const PIECE_MASK_SIZE = 5;

export type BinaryCell = 0 | 1;
export type PieceMask = BinaryCell[][];
export type PieceId =
  | "block01"
  | "block02"
  | "block03"
  | "block04"
  | "block05"
  | "block06"
  | "block07"
  | "block08"
  | "block09"
  | "block10"
  | "block11"
  | "block12";

export interface Point {
  x: number;
  y: number;
}

export interface PieceDefinition {
  id: PieceId;
  mask: PieceMask;
  occupiedCells: Point[];
}

export type BoardCell = PieceId | null;
export type BoardState = BoardCell[][];
