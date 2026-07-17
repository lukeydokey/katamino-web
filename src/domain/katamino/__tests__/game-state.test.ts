import { describe, expect, it } from "vitest";
import {
  createInitialGameSession,
  forfeitGame,
  placeSelectedPiece,
  rotateSelectedPiece,
  selectPiece,
} from "@/domain/katamino/game-state";

describe("katamino local game state", () => {
  it("초기 상태는 블록이 선택되지 않은 빈 보드다", () => {
    const state = createInitialGameSession();

    expect(state.selectedPieceId).toBe(null);
    expect(state.usedPieceIds).toHaveLength(0);
    expect(state.board.flat().every((cell) => cell === null)).toBe(true);
    expect(state.phase).toBe("playing");
    expect(state.currentTurnSeat).toBe("host");
  });

  it("블록 선택 시 selectedPieceId가 갱신된다", () => {
    const nextState = selectPiece(createInitialGameSession(), "block03");

    expect(nextState.selectedPieceId).toBe("block03");
  });

  it("선택된 블록은 회전할 수 있다", () => {
    const selectedState = selectPiece(createInitialGameSession(), "block03");
    const rotatedState = rotateSelectedPiece(selectedState);

    expect(rotatedState.pieces.block03.rotation).toBe(1);
  });

  it("유효한 위치에 배치하면 보드와 usedPieceIds가 갱신된다", () => {
    const selectedState = selectPiece(createInitialGameSession(), "block12");
    const result = placeSelectedPiece(selectedState, 3, 3);

    expect(result.success).toBe(true);
    expect(result.state.board[3][3]).toBe("block12");
    expect(result.state.usedPieceIds).toContain("block12");
    expect(result.state.selectedPieceId).toBe(null);
    expect(result.state.currentTurnSeat).toBe("guest");
    expect(result.state.turnNumber).toBe(2);
  });

  it("유효하지 않은 위치에 배치하면 실패 메시지를 반환한다", () => {
    const selectedState = selectPiece(createInitialGameSession(), "block01");
    const result = placeSelectedPiece(selectedState, 0, 0);

    expect(result.success).toBe(false);
    expect(result.message).toBe("현재 위치에는 블록을 놓을 수 없습니다.");
    expect(result.state.currentTurnSeat).toBe("host");
  });

  it("이미 사용한 블록은 다시 선택할 수 없다", () => {
    const selectedState = selectPiece(createInitialGameSession(), "block12");
    const placedResult = placeSelectedPiece(selectedState, 3, 3);
    const reselectedState = selectPiece(placedResult.state, "block12");

    expect(reselectedState.selectedPieceId).toBe(null);
  });

  it("다른 블록을 선택하면 이전 미배치 블록의 회전 상태가 초기화된다", () => {
    const selectedState = selectPiece(createInitialGameSession(), "block03");
    const rotatedState = rotateSelectedPiece(selectedState);
    const switchedState = selectPiece(rotatedState, "block05");

    expect(switchedState.selectedPieceId).toBe("block05");
    expect(switchedState.pieces.block03.rotation).toBe(0);
    expect(switchedState.pieces.block03.currentMask).toEqual(switchedState.pieces.block03.initialMask);
  });

  it("세션 상태는 JSON 직렬화가 가능해야 한다", () => {
    const state = selectPiece(createInitialGameSession(), "block07");

    expect(() => JSON.stringify(state)).not.toThrow();
  });

  it("기권하면 게임 종료 상태와 승자가 기록된다", () => {
    const state = createInitialGameSession();
    const forfeitedState = forfeitGame(state, "host");

    expect(forfeitedState.phase).toBe("finished");
    expect(forfeitedState.finishedReason).toBe("forfeit");
    expect(forfeitedState.winnerSeat).toBe("guest");
  });
});
