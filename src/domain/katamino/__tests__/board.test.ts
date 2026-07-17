import { describe, expect, it } from "vitest";
import {
  canPlacePiece,
  createBoard,
  placePiece,
} from "@/domain/katamino/board";
import { createPieceMap, rotateMaskClockwise } from "@/domain/katamino/pieces";

describe("katamino board rules", () => {
  it("빈 8x8 보드를 생성한다", () => {
    const board = createBoard();

    expect(board).toHaveLength(8);
    expect(board.every((row) => row.length === 8)).toBe(true);
    expect(board.flat().every((cell) => cell === null)).toBe(true);
  });

  it("가로 5칸 블록을 가운데에 정상 배치할 수 있다", () => {
    const board = createBoard();
    const pieceMap = createPieceMap();

    expect(canPlacePiece(board, pieceMap.block01.mask, 2, 2)).toBe(true);
  });

  it("맵 바깥으로 나가면 배치할 수 없다", () => {
    const board = createBoard();
    const pieceMap = createPieceMap();

    expect(canPlacePiece(board, pieceMap.block01.mask, 0, 0)).toBe(false);
  });

  it("이미 점유된 칸과 겹치면 배치할 수 없다", () => {
    const board = createBoard();
    const pieceMap = createPieceMap();
    const nextBoard = placePiece(board, pieceMap.block01.id, pieceMap.block01.mask, 2, 2);

    expect(canPlacePiece(nextBoard, pieceMap.block12.mask, 2, 2)).toBe(false);
  });

  it("placePiece는 점유 칸에 piece id를 기록한다", () => {
    const board = createBoard();
    const pieceMap = createPieceMap();
    const nextBoard = placePiece(board, pieceMap.block12.id, pieceMap.block12.mask, 3, 3);

    expect(nextBoard[2][3]).toBe("block12");
    expect(nextBoard[3][2]).toBe("block12");
    expect(nextBoard[3][3]).toBe("block12");
    expect(nextBoard[3][4]).toBe("block12");
    expect(nextBoard[4][3]).toBe("block12");
  });

  it("회전된 블록도 같은 규칙으로 배치 가능 여부를 계산한다", () => {
    const board = createBoard();
    const pieceMap = createPieceMap();
    const rotated = rotateMaskClockwise(pieceMap.block01.mask);

    expect(canPlacePiece(board, rotated, 2, 2)).toBe(true);
    expect(canPlacePiece(board, rotated, 7, 7)).toBe(false);
  });
});
