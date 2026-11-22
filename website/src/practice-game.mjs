import { Chess } from 'chess.js';

export function createPracticeGame(fen) {
  const board = new Chess(fen);
  let queued = null;

  function play(move) {
    const legal = board.moves({ verbose: true }).find(candidate =>
      candidate.from === move.from && candidate.to === move.to &&
      candidate.promotion === move.promotion
    );
    return legal ? board.move(move) : null;
  }

  return {
    board,
    get queued() { return queued; },
    cancel() { queued = null; },
    reset() {
      board.reset();
      queued = null;
    },
    playerMove(move) {
      if (board.isGameOver()) return null;
      if (board.turn() === 'w') return play(move);
      if (move.from !== move.to && board.get(move.from)?.color === 'w') {
        queued = { ...move };
      }
      return null;
    },
    opponentMove(move) {
      if (board.turn() !== 'b' || board.isGameOver() || !play(move)) return null;
      const pending = queued;
      queued = null;
      if (!pending) return 'Opponent moved.';
      if (board.isGameOver()) return 'Game ended. Premove cleared.';
      return play(pending) ? 'Premove played.' : 'Premove cleared because it was no longer legal.';
    },
  };
}

export function opponentDelay(legalCount, remainingMs) {
  const target = legalCount === 1 ? 300 : Math.min(1600, 450 + legalCount * 30);
  return Math.min(target, Math.max(0, remainingMs - 100));
}
