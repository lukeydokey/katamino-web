"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { canPlacePiece } from "@/domain/katamino/board";
import {
  clearSelectedPiece,
  createInitialGameState,
  placeSelectedPiece,
  resetGameSession,
  rotateSelectedPiece,
  selectPiece,
} from "@/domain/katamino/game-state";
import type { PieceId } from "@/domain/katamino/types";

function formatPieceLabel(pieceId: PieceId) {
  return pieceId.replace("block", "블록 ");
}

function getPreviewCells(
  mask: number[][],
  x: number,
  y: number,
) {
  const previewCells: Array<{ x: number; y: number }> = [];

  for (let boardX = x - 2; boardX <= x + 2; boardX += 1) {
    for (let boardY = y - 2; boardY <= y + 2; boardY += 1) {
      const maskY = boardY - (y - 2);
      const maskX = boardX - (x - 2);

      if (mask[maskY]?.[maskX] !== 1) {
        continue;
      }

      if (boardX < 0 || boardX > 7 || boardY < 0 || boardY > 7) {
        continue;
      }

      previewCells.push({ x: boardX, y: boardY });
    }
  }

  return previewCells;
}

function PieceShape({
  mask,
  filledClassName,
  emptyClassName,
  cellClassName,
}: {
  mask: number[][];
  filledClassName: string;
  emptyClassName: string;
  cellClassName: string;
}) {
  return (
    <div className="grid grid-cols-5 gap-0.5">
      {mask.flatMap((row, rowIndex) =>
        row.map((cell, columnIndex) => (
          <div
            key={`${rowIndex}-${columnIndex}`}
            className={`${cellClassName} ${cell === 1 ? filledClassName : emptyClassName}`}
          />
        )),
      )}
    </div>
  );
}

export function LocalGame() {
  const [gameState, setGameState] = useState(createInitialGameState);
  const [hoveredBoardCell, setHoveredBoardCell] = useState<{ x: number; y: number } | null>(null);
  const boardArticleRef = useRef<HTMLElement | null>(null);

  const pieceList = useMemo(() => Object.values(gameState.pieces), [gameState.pieces]);
  const selectedPiece = gameState.selectedPieceId
    ? gameState.pieces[gameState.selectedPieceId]
    : null;
  const canPlaceAtHoveredCell =
    selectedPiece && hoveredBoardCell
      ? canPlacePiece(gameState.board, selectedPiece.currentMask, hoveredBoardCell.x, hoveredBoardCell.y)
      : false;
  const previewCells =
    selectedPiece && hoveredBoardCell
      ? getPreviewCells(selectedPiece.currentMask, hoveredBoardCell.x, hoveredBoardCell.y)
      : [];
  const previewCellMap = new Map(previewCells.map((cell) => [`${cell.x}-${cell.y}`, cell]));

  function handleRotate() {
    setGameState((current) => rotateSelectedPiece(current));
  }

  function handleReset() {
    setGameState(resetGameSession());
    setHoveredBoardCell(null);
  }

  useEffect(() => {
    const articleElement = boardArticleRef.current;

    if (!articleElement) {
      return;
    }

    const handleWheel = (event: WheelEvent) => {
      if (!selectedPiece) {
        return;
      }

      event.preventDefault();
      handleRotate();
    };

    articleElement.addEventListener("wheel", handleWheel, { passive: false });

    return () => {
      articleElement.removeEventListener("wheel", handleWheel);
    };
  }, [selectedPiece]);

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key !== "Escape") {
        return;
      }

      setGameState((current) => clearSelectedPiece(current));
      setHoveredBoardCell(null);
    };

    window.addEventListener("keydown", handleKeyDown);

    return () => {
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, []);

  return (
    <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_320px]">
      <article
        ref={boardArticleRef}
        className="rounded-3xl border border-[var(--line)] bg-[var(--surface)] p-6 shadow-sm"
      >
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-xl font-semibold">로컬 플레이 보드</h2>
            <p className="text-sm text-black/60">
              블록을 집은 뒤 보드 위에서 위치를 먼저 확인하고 놓을 수 있습니다. 선택 상태에서는 마우스 휠로 회전하고, 다시 누르거나 Esc로 선택을 해제할 수 있습니다.
            </p>
          </div>

          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={handleRotate}
              disabled={selectedPiece === null}
              className="rounded-full bg-[var(--accent)] px-4 py-2 text-sm font-medium text-[var(--accent-foreground)] disabled:cursor-not-allowed disabled:opacity-50"
            >
              선택 블록 회전
            </button>
            <button
              type="button"
              onClick={handleReset}
              className="rounded-full border border-[var(--line)] bg-white px-4 py-2 text-sm font-medium text-black/75"
            >
              로컬 상태 초기화
            </button>
          </div>
        </div>

        <div className="grid aspect-square max-w-[640px] grid-cols-8 gap-2 rounded-2xl bg-[var(--surface-strong)] p-4">
          {gameState.board.map((row, y) =>
            row.map((cell, x) => {
              const isFilled = cell !== null;
              const previewKey = `${x}-${y}`;
              const isPreviewCell = previewCellMap.has(previewKey);

              return (
                <button
                  key={`${x}-${y}`}
                  type="button"
                  onMouseEnter={() => setHoveredBoardCell({ x, y })}
                  onFocus={() => setHoveredBoardCell({ x, y })}
                  onMouseLeave={() => setHoveredBoardCell(null)}
                  onClick={() =>
                    setGameState((current) => placeSelectedPiece(current, x, y).state)
                  }
                  className={`flex items-center justify-center rounded-lg border text-xs font-medium transition ${
                    isFilled
                      ? "border-[var(--accent)] bg-[var(--accent)]/15 text-[var(--accent)]"
                      : isPreviewCell
                        ? canPlaceAtHoveredCell
                          ? "border-emerald-500 bg-emerald-100 text-emerald-800"
                          : "border-rose-500 bg-rose-100 text-rose-700"
                        : "border-[var(--line)] bg-[var(--surface)] hover:bg-[var(--surface-strong)]"
                  }`}
                  aria-label={`${x},${y} 칸`}
                >
                  {cell ? cell.slice(-2) : ""}
                </button>
              );
            }),
          )}
        </div>
      </article>

      <aside className="flex flex-col gap-4 rounded-3xl border border-[var(--line)] bg-[var(--surface)] p-6 shadow-sm">
        <section className="flex flex-col gap-2">
          <h2 className="text-xl font-semibold">현재 상태</h2>
          <p className="text-sm text-black/60">
            {gameState.message ?? "트레이에서 블록을 선택한 뒤, 보드에서 놓을 위치를 먼저 확인하세요."}
          </p>
          <p className="text-sm text-black/70">
            선택된 블록: {selectedPiece ? formatPieceLabel(selectedPiece.id) : "없음"}
          </p>
          <p className="text-sm text-black/70">
            현재 턴: {gameState.currentTurnSeat === "host" ? "HOST" : "GUEST"}
          </p>
          <p className="text-sm text-black/70">사용 완료 블록 수: {gameState.usedPieceIds.length} / 12</p>
          {selectedPiece && hoveredBoardCell ? (
            <p className="text-sm text-black/65">
              현재 미리보기: ({hoveredBoardCell.x}, {hoveredBoardCell.y}) · {canPlaceAtHoveredCell ? "배치 가능" : "배치 불가"}
            </p>
          ) : null}
        </section>

        <section className="flex flex-col gap-3">
          <h3 className="text-lg font-semibold">블록 트레이</h3>
          <div className="grid grid-cols-2 gap-2">
            {pieceList.map((piece) => {
              const isUsed = gameState.usedPieceIds.includes(piece.id);
              const isSelected = gameState.selectedPieceId === piece.id;

              return (
                <button
                  key={piece.id}
                  type="button"
                  disabled={isUsed}
                    onClick={() => {
                      setGameState((current) =>
                        current.selectedPieceId === piece.id
                          ? clearSelectedPiece(current)
                          : selectPiece(current, piece.id),
                      );
                    }}
                  className={`rounded-2xl border px-3 py-3 text-left text-sm transition ${
                    isUsed
                      ? "cursor-not-allowed border-[var(--line)] bg-black/5 text-black/35"
                      : isSelected
                        ? "border-[var(--accent)] bg-[var(--accent)] text-[var(--accent-foreground)]"
                        : "border-[var(--line)] bg-[var(--surface)] hover:bg-[var(--surface-strong)]"
                  }`}
                >
                  <div className="mb-2 flex items-start justify-between gap-2">
                    <div className="font-semibold">{formatPieceLabel(piece.id)}</div>
                    <div className="text-xs opacity-80">{isUsed ? "사용 완료" : `${piece.rotation * 90}°`}</div>
                  </div>

                  <PieceShape
                    mask={piece.currentMask}
                    filledClassName={isSelected ? "bg-white/90" : "bg-[var(--accent)]"}
                    emptyClassName={isSelected ? "bg-white/20" : "bg-[var(--surface)]"}
                    cellClassName="h-3 w-3 rounded-[4px] border border-[var(--line)]"
                  />
                </button>
              );
            })}
          </div>
        </section>
      </aside>
    </div>
  );
}
