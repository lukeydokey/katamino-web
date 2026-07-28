import { useCallback, useState } from "react";
import type { Dispatch, SetStateAction } from "react";
import type { PieceId, Point } from "@/domain/katamino/types";

export interface RoomBoardSelectionState {
  selectedPieceId: PieceId | null;
  rotation: number;
  hoveredBoardCell: Point | null;
  pendingPlacementCell: Point | null;
  setHoveredBoardCell: Dispatch<SetStateAction<Point | null>>;
  setPendingPlacementCell: Dispatch<SetStateAction<Point | null>>;
  clearSelection: () => void;
  rotateSelectionClockwise: () => void;
  togglePieceSelection: (pieceId: PieceId) => void;
}

export function useRoomBoardSelection(): RoomBoardSelectionState {
  const [selectedPieceId, setSelectedPieceId] = useState<PieceId | null>(null);
  const [rotation, setRotation] = useState(0);
  const [hoveredBoardCell, setHoveredBoardCell] = useState<Point | null>(null);
  const [pendingPlacementCell, setPendingPlacementCell] = useState<Point | null>(null);

  const clearSelection = useCallback(() => {
    setSelectedPieceId(null);
    setRotation(0);
    setHoveredBoardCell(null);
    setPendingPlacementCell(null);
  }, []);

  const rotateSelectionClockwise = useCallback(() => {
    setRotation((current) => (current + 1) % 4);
    setPendingPlacementCell(null);
  }, []);

  const togglePieceSelection = useCallback((pieceId: PieceId) => {
    setSelectedPieceId((current) => (current === pieceId ? null : pieceId));
    setRotation(0);
    setHoveredBoardCell(null);
    setPendingPlacementCell(null);
  }, []);

  return {
    selectedPieceId,
    rotation,
    hoveredBoardCell,
    pendingPlacementCell,
    setHoveredBoardCell,
    setPendingPlacementCell,
    clearSelection,
    rotateSelectionClockwise,
    togglePieceSelection,
  };
}
