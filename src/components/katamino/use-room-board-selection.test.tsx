import { act, renderHook } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { useRoomBoardSelection } from "./use-room-board-selection";

describe("useRoomBoardSelection", () => {
  it("전체 선택 해제 시 선택, 회전, 미리보기 상태를 모두 초기화한다", () => {
    const { result } = renderHook(() => useRoomBoardSelection());

    act(() => {
      result.current.togglePieceSelection("block03");
      result.current.rotateSelectionClockwise();
      result.current.setHoveredBoardCell({ x: 2, y: 3 });
      result.current.setPendingPlacementCell({ x: 4, y: 5 });
    });

    act(() => {
      result.current.clearSelection();
    });

    expect(result.current.selectedPieceId).toBe(null);
    expect(result.current.rotation).toBe(0);
    expect(result.current.hoveredBoardCell).toBe(null);
    expect(result.current.pendingPlacementCell).toBe(null);
  });

  it("회전 시 pendingPlacementCell만 지우고 선택과 hover는 유지한다", () => {
    const { result } = renderHook(() => useRoomBoardSelection());

    act(() => {
      result.current.togglePieceSelection("block05");
      result.current.setHoveredBoardCell({ x: 1, y: 1 });
      result.current.setPendingPlacementCell({ x: 6, y: 6 });
      result.current.rotateSelectionClockwise();
    });

    expect(result.current.selectedPieceId).toBe("block05");
    expect(result.current.rotation).toBe(1);
    expect(result.current.hoveredBoardCell).toEqual({ x: 1, y: 1 });
    expect(result.current.pendingPlacementCell).toBe(null);
  });

  it("다른 조각을 선택하면 회전과 미리보기 상태를 초기화한 뒤 새 조각을 선택한다", () => {
    const { result } = renderHook(() => useRoomBoardSelection());

    act(() => {
      result.current.togglePieceSelection("block02");
      result.current.rotateSelectionClockwise();
      result.current.rotateSelectionClockwise();
      result.current.setHoveredBoardCell({ x: 0, y: 7 });
      result.current.setPendingPlacementCell({ x: 3, y: 2 });
    });

    act(() => {
      result.current.togglePieceSelection("block08");
    });

    expect(result.current.selectedPieceId).toBe("block08");
    expect(result.current.rotation).toBe(0);
    expect(result.current.hoveredBoardCell).toBe(null);
    expect(result.current.pendingPlacementCell).toBe(null);
  });

  it("같은 조각을 다시 선택하면 선택 상태를 해제한다", () => {
    const { result } = renderHook(() => useRoomBoardSelection());

    act(() => {
      result.current.togglePieceSelection("block11");
      result.current.rotateSelectionClockwise();
      result.current.setHoveredBoardCell({ x: 5, y: 4 });
      result.current.setPendingPlacementCell({ x: 5, y: 4 });
    });

    act(() => {
      result.current.togglePieceSelection("block11");
    });

    expect(result.current.selectedPieceId).toBe(null);
    expect(result.current.rotation).toBe(0);
    expect(result.current.hoveredBoardCell).toBe(null);
    expect(result.current.pendingPlacementCell).toBe(null);
  });
});
