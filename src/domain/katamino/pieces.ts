import {
  PIECE_MASK_SIZE,
  type BinaryCell,
  type PieceDefinition,
  type PieceId,
  type PieceMask,
} from "@/domain/katamino/types";

const LEGACY_PIECE_MASKS = {
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
} satisfies Record<PieceId, string[]>;

function parseMask(rows: string[]): PieceMask {
  return rows.map((row) =>
    row.split("").map((cell) => (cell === "1" ? 1 : 0) as BinaryCell),
  );
}

function getOccupiedCells(mask: PieceMask) {
  return mask.flatMap((row, y) =>
    row.flatMap((cell, x) => (cell === 1 ? [{ x, y }] : [])),
  );
}

export function rotateMaskClockwise(mask: PieceMask): PieceMask {
  const rotated = Array.from({ length: PIECE_MASK_SIZE }, () =>
    Array.from({ length: PIECE_MASK_SIZE }, () => 0 as BinaryCell),
  );

  for (let y = 0; y < PIECE_MASK_SIZE; y += 1) {
    for (let x = 0; x < PIECE_MASK_SIZE; x += 1) {
      const targetRow = x;
      const targetColumn = PIECE_MASK_SIZE - 1 - y;

      rotated[targetRow][targetColumn] = mask[y][x];
    }
  }

  return rotated;
}

export function getLegacyPieces(): PieceDefinition[] {
  return (Object.entries(LEGACY_PIECE_MASKS) as [PieceId, string[]][]).map(
    ([id, rows]) => {
      const mask = parseMask(rows);

      return {
        id,
        mask,
        occupiedCells: getOccupiedCells(mask),
      };
    },
  );
}

export function createPieceMap(): Record<PieceId, PieceDefinition> {
  return getLegacyPieces().reduce<Record<PieceId, PieceDefinition>>(
    (accumulator, piece) => {
      accumulator[piece.id] = piece;
      return accumulator;
    },
    {} as Record<PieceId, PieceDefinition>,
  );
}
