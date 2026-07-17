"use client";

import { useMemo, useState } from "react";
import {
  createInitialGameState,
  placeSelectedPiece,
  rotateSelectedPiece,
  selectPiece,
} from "@/domain/katamino/game-state";
import type { PieceId } from "@/domain/katamino/types";

function formatPieceLabel(pieceId: PieceId) {
  return pieceId.replace("block", "블록 ");
}

export function LocalGame() {
  const [gameState, setGameState] = useState(createInitialGameState);

  const pieceList = useMemo(() => Object.values(gameState.pieces), [gameState.pieces]);
  const selectedPiece = gameState.selectedPieceId
    ? gameState.pieces[gameState.selectedPieceId]
    : null;

  return (
    <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_320px]">
      <article className="rounded-3xl border border-[var(--line)] bg-[var(--surface)] p-6 shadow-sm">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-xl font-semibold">로컬 플레이 보드</h2>
            <p className="text-sm text-black/60">
              블록을 선택하고 회전한 뒤 8x8 보드에 배치할 수 있다.
            </p>
          </div>

          <button
            type="button"
            onClick={() => setGameState((current) => rotateSelectedPiece(current))}
            disabled={selectedPiece === null}
            className="rounded-full bg-[var(--accent)] px-4 py-2 text-sm font-medium text-[var(--accent-foreground)] disabled:cursor-not-allowed disabled:opacity-50"
          >
            선택 블록 회전
          </button>
        </div>

        <div className="grid aspect-square max-w-[640px] grid-cols-8 gap-2 rounded-2xl bg-[var(--surface-strong)] p-4">
          {gameState.board.map((row, y) =>
            row.map((cell, x) => {
              const isFilled = cell !== null;

              return (
                <button
                  key={`${x}-${y}`}
                  type="button"
                  onClick={() =>
                    setGameState((current) => placeSelectedPiece(current, x, y).state)
                  }
                  className={`flex items-center justify-center rounded-lg border text-xs font-medium transition ${
                    isFilled
                      ? "border-[var(--accent)] bg-[var(--accent)]/15 text-[var(--accent)]"
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
            {gameState.message ?? "블록을 선택해서 보드에 놓아보세요."}
          </p>
          <p className="text-sm text-black/70">
            선택된 블록: {selectedPiece ? formatPieceLabel(selectedPiece.id) : "없음"}
          </p>
          <p className="text-sm text-black/70">사용 완료 블록 수: {gameState.usedPieceIds.size} / 12</p>
        </section>

        <section className="flex flex-col gap-3">
          <h3 className="text-lg font-semibold">선택 블록 미리보기</h3>
          <div className="grid w-fit grid-cols-5 gap-1 rounded-2xl bg-[var(--surface-strong)] p-3">
            {(selectedPiece?.currentMask ?? Array.from({ length: 5 }, () => Array.from({ length: 5 }, () => 0))).flatMap(
              (row, rowIndex) =>
                row.map((cell, columnIndex) => (
                  <div
                    key={`${rowIndex}-${columnIndex}`}
                    className={`h-6 w-6 rounded-sm border border-[var(--line)] ${
                      cell === 1 ? "bg-[var(--accent)]" : "bg-[var(--surface)]"
                    }`}
                  />
                )),
            )}
          </div>
        </section>

        <section className="flex flex-col gap-3">
          <h3 className="text-lg font-semibold">블록 트레이</h3>
          <div className="grid grid-cols-2 gap-2">
            {pieceList.map((piece) => {
              const isUsed = gameState.usedPieceIds.has(piece.id);
              const isSelected = gameState.selectedPieceId === piece.id;

              return (
                <button
                  key={piece.id}
                  type="button"
                  disabled={isUsed}
                  onClick={() => setGameState((current) => selectPiece(current, piece.id))}
                  className={`rounded-2xl border px-3 py-3 text-left text-sm transition ${
                    isUsed
                      ? "cursor-not-allowed border-[var(--line)] bg-black/5 text-black/35"
                      : isSelected
                        ? "border-[var(--accent)] bg-[var(--accent)] text-[var(--accent-foreground)]"
                        : "border-[var(--line)] bg-[var(--surface)] hover:bg-[var(--surface-strong)]"
                  }`}
                >
                  <div className="font-semibold">{formatPieceLabel(piece.id)}</div>
                  <div className="text-xs opacity-80">
                    {isUsed ? "사용 완료" : `회전 ${piece.rotation * 90}°`}
                  </div>
                </button>
              );
            })}
          </div>
        </section>
      </aside>
    </div>
  );
}
