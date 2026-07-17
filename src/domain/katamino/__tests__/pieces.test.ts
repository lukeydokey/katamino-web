import { describe, expect, it } from "vitest";
import {
  createPieceMap,
  getLegacyPieces,
  rotateMaskClockwise,
} from "@/domain/katamino/pieces";

describe("katamino piece definitions", () => {
  it("레거시 기준 12개의 블록을 제공한다", () => {
    const pieces = getLegacyPieces();

    expect(pieces).toHaveLength(12);
  });

  it("모든 블록은 정확히 5칸을 차지한다", () => {
    const pieces = getLegacyPieces();

    for (const piece of pieces) {
      expect(piece.occupiedCells).toHaveLength(5);
    }
  });

  it("block01은 가운데 줄 5칸 직선 형태다", () => {
    const pieceMap = createPieceMap();

    expect(pieceMap.block01.mask).toEqual([
      [0, 0, 0, 0, 0],
      [0, 0, 0, 0, 0],
      [1, 1, 1, 1, 1],
      [0, 0, 0, 0, 0],
      [0, 0, 0, 0, 0],
    ]);
  });

  it("block12는 십자 형태를 유지한다", () => {
    const pieceMap = createPieceMap();

    expect(pieceMap.block12.mask).toEqual([
      [0, 0, 0, 0, 0],
      [0, 0, 1, 0, 0],
      [0, 1, 1, 1, 0],
      [0, 0, 1, 0, 0],
      [0, 0, 0, 0, 0],
    ]);
  });

  it("회전을 4번 적용하면 원래 형태로 돌아온다", () => {
    const pieceMap = createPieceMap();

    let rotated = pieceMap.block08.mask;

    for (let index = 0; index < 4; index += 1) {
      rotated = rotateMaskClockwise(rotated);
    }

    expect(rotated).toEqual(pieceMap.block08.mask);
  });
});
