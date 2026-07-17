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

export const PIECE_COLOR_MAP = {
  block01: {
    fill: "bg-rose-500",
    soft: "bg-rose-100",
    border: "border-rose-500",
    text: "text-rose-900",
  },
  block02: {
    fill: "bg-orange-500",
    soft: "bg-orange-100",
    border: "border-orange-500",
    text: "text-orange-900",
  },
  block03: {
    fill: "bg-amber-500",
    soft: "bg-amber-100",
    border: "border-amber-500",
    text: "text-amber-900",
  },
  block04: {
    fill: "bg-lime-500",
    soft: "bg-lime-100",
    border: "border-lime-500",
    text: "text-lime-900",
  },
  block05: {
    fill: "bg-emerald-500",
    soft: "bg-emerald-100",
    border: "border-emerald-500",
    text: "text-emerald-900",
  },
  block06: {
    fill: "bg-teal-500",
    soft: "bg-teal-100",
    border: "border-teal-500",
    text: "text-teal-900",
  },
  block07: {
    fill: "bg-cyan-500",
    soft: "bg-cyan-100",
    border: "border-cyan-500",
    text: "text-cyan-900",
  },
  block08: {
    fill: "bg-sky-500",
    soft: "bg-sky-100",
    border: "border-sky-500",
    text: "text-sky-900",
  },
  block09: {
    fill: "bg-blue-500",
    soft: "bg-blue-100",
    border: "border-blue-500",
    text: "text-blue-900",
  },
  block10: {
    fill: "bg-indigo-500",
    soft: "bg-indigo-100",
    border: "border-indigo-500",
    text: "text-indigo-900",
  },
  block11: {
    fill: "bg-violet-500",
    soft: "bg-violet-100",
    border: "border-violet-500",
    text: "text-violet-900",
  },
  block12: {
    fill: "bg-fuchsia-500",
    soft: "bg-fuchsia-100",
    border: "border-fuchsia-500",
    text: "text-fuchsia-900",
  },
} satisfies Record<PieceId, { fill: string; soft: string; border: string; text: string }>;

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

export function getPieceColor(pieceId: PieceId) {
  return PIECE_COLOR_MAP[pieceId];
}
