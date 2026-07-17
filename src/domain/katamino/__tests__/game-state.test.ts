import { describe, expect, it } from "vitest";
import {
  createInitialGameState,
  placeSelectedPiece,
  rotateSelectedPiece,
  selectPiece,
} from "@/domain/katamino/game-state";

describe("katamino local game state", () => {
  it("초기 상태는 블록이 선택되지 않은 빈 보드다", () => {
    const state = createInitialGameState();

    expect(state.selectedPieceId).toBe(null);
    expect(state.usedPieceIds.size).toBe(0);
    expect(state.board.flat().every((cell) => cell === null)).toBe(true);
  });

  it("블록 선택 시 selectedPieceId가 갱신된다", () => {
    const nextState = selectPiece(createInitialGameState(), "block03");

    expect(nextState.selectedPieceId).toBe("block03");
  });

  it("선택된 블록은 회전할 수 있다", () => {
    const selectedState = selectPiece(createInitialGameState(), "block03");
    const rotatedState = rotateSelectedPiece(selectedState);

    expect(rotatedState.pieces.block03.rotation).toBe(1);
  });

  it("유효한 위치에 배치하면 보드와 usedPieceIds가 갱신된다", () => {
    const selectedState = selectPiece(createInitialGameState(), "block12");
    const result = placeSelectedPiece(selectedState, 3, 3);

    expect(result.success).toBe(true);
    expect(result.state.board[3][3]).toBe("block12");
    expect(result.state.usedPieceIds.has("block12")).toBe(true);
    expect(result.state.selectedPieceId).toBe(null);
  });

  it("유효하지 않은 위치에 배치하면 실패 메시지를 반환한다", () => {
    const selectedState = selectPiece(createInitialGameState(), "block01");
    const result = placeSelectedPiece(selectedState, 0, 0);

    expect(result.success).toBe(false);
    expect(result.message).toBe("현재 위치에는 블록을 놓을 수 없습니다.");
  });

  it("이미 사용한 블록은 다시 선택할 수 없다", () => {
    const selectedState = selectPiece(createInitialGameState(), "block12");
    const placedResult = placeSelectedPiece(selectedState, 3, 3);
    const reselectedState = selectPiece(placedResult.state, "block12");

    expect(reselectedState.selectedPieceId).toBe(null);
  });
});
