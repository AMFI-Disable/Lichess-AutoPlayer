import { createPracticeGame, opponentDelay } from './practice-game.mjs';

const game = createPracticeGame();
const board = document.querySelector('#board');
const status = document.querySelector('#status');
const cancel = document.querySelector('#cancel');
const promotion = document.querySelector('#promotion');
const pieces = { wp: '♙', wn: '♘', wb: '♗', wr: '♖', wq: '♕', wk: '♔',
  bp: '♟', bn: '♞', bb: '♝', br: '♜', bq: '♛', bk: '♚' };
const names = { p: 'pawn', n: 'knight', b: 'bishop', r: 'rook', q: 'queen', k: 'king' };
const values = { p: 1, n: 3, b: 3, r: 5, q: 9 };
let selected = null;
let timer;
let remaining = 180000;
const squares = [];

function render(message = '') {
  for (const [square, button] of squares) {
    const piece = game.board.get(square);
    button.textContent = piece ? pieces[piece.color + piece.type] : '';
    const description = piece ? `${piece.color === 'w' ? 'White' : 'Black'} ${names[piece.type]}` : 'empty';
    button.setAttribute('aria-label', `${square}, ${description}`);
    button.setAttribute('aria-pressed', String(square === selected));
    button.classList.toggle('selected', square === selected);
    button.classList.toggle('queued', square === game.queued?.from || square === game.queued?.to);
  }
  cancel.disabled = !game.queued;
  const turn = game.board.isCheckmate() ? 'Checkmate.' : game.board.isGameOver() ? 'Draw.' :
    remaining <= 0 ? 'Black ran out of time.' : game.board.turn() === 'w' ? 'White to move.' : 'Black is thinking.';
  const queued = game.queued ? ` Queued: ${game.queued.from} to ${game.queued.to}.` : '';
  status.textContent = [message, turn + queued].filter(Boolean).join(' ');
}

function scheduleOpponent() {
  if (timer !== undefined || remaining <= 0 || game.board.turn() !== 'b' || game.board.isGameOver()) return;
  const moves = game.board.moves({ verbose: true });
  const score = move => (values[move.captured] ?? 0) + (values[move.promotion] ?? 0);
  const best = Math.max(...moves.map(score));
  const candidates = moves.filter(move => score(move) === best);
  const { from, to, promotion } = candidates[Math.floor(Math.random() * candidates.length)];
  const started = performance.now();
  timer = setTimeout(() => {
    timer = undefined;
    remaining -= performance.now() - started;
    if (remaining <= 0) {
      game.cancel();
      render();
      return;
    }
    selected = null;
    render(game.opponentMove({ from, to, promotion }) ?? '');
    scheduleOpponent();
  }, opponentDelay(moves.length, remaining));
}

for (let rank = 8; rank >= 1; rank--) {
  for (const [file, letter] of [...'abcdefgh'].entries()) {
    const square = letter + rank;
    const button = document.createElement('button');
    button.type = 'button';
    button.className = `square ${(file + rank) % 2 === 0 ? 'light' : 'dark'}`;
    button.addEventListener('click', () => {
      if (game.board.isGameOver() || remaining <= 0) return;
      const piece = game.board.get(square);
      if (selected === square) selected = null;
      else if (piece?.color === 'w') selected = square;
      else if (selected) {
        const move = { from: selected, to: square };
        if (game.board.get(selected)?.type === 'p' && rank === 8) move.promotion = promotion.value;
        game.playerMove(move);
        selected = null;
      }
      render();
      scheduleOpponent();
    });
    squares.push([square, button]);
    board.append(button);
  }
}

cancel.addEventListener('click', () => { game.cancel(); selected = null; render('Premove canceled.'); });
document.querySelector('#reset').addEventListener('click', () => {
  clearTimeout(timer);
  timer = undefined;
  remaining = 180000;
  selected = null;
  game.reset();
  render();
});
render();
