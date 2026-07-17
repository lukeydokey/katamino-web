import { describe, expect, it } from "vitest";
import {
  createPieceMap,
  getLegacyPieces,
  rotateMaskClockwise,
} from "@/domain/katamino/pieces";

const expectedLegacyMasks = {
  block01: ["00000", "00000", "11111", "00000", "00000"],
  block02: ["00010", "00010", "00010", "00110", "00000"],
  block03: ["00000", "01111", "00010", "00000", "00000"],
  block04: ["00000", "11000", "01110", "00000", "00000"],
  block05: ["00000", "01000", "01000", "01110", "00000"],
  block06: ["00000", "00000", "01110", "01100", "00000"],
  block07: ["00000", "00000", "01010", "01110", "00000"],
  block08: ["00000", "01100", "00100", "00110", "00000"],
  block09: ["00000", "01100", "00110", "00100", "00000"],
  block10: ["00000", "00100", "00100", "01110", "00000"],
  block11: ["00000", "00110", "01100", "01000", "00000"],
  block12: ["00000", "00100", "01110", "00100", "00000"],
} as const;

function serializeMask(mask: number[][]) {
  return mask.map((row) => row.join(""));
}

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

  it("12개 블록 마스크가 모두 레거시 텍스트와 일치한다", () => {
    const pieceMap = createPieceMap();

    for (const [pieceId, expectedMask] of Object.entries(expectedLegacyMasks)) {
      expect(serializeMask(pieceMap[pieceId as keyof typeof pieceMap].mask)).toEqual(expectedMask);
    }
  });
});
