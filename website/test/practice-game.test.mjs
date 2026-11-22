import test from 'node:test';
import assert from 'node:assert/strict';
import { createPracticeGame, opponentDelay } from '../src/practice-game.mjs';

const move = (from, to, promotion) => ({ from, to, promotion });

test('queued recapture plays against the resulting position', () => {
  const game = createPracticeGame();
  game.playerMove(move('e2', 'e4'));
  game.opponentMove(move('d7', 'd5'));
  game.playerMove(move('d2', 'd3'));
  game.playerMove(move('d3', 'e4'));
  assert.equal(game.opponentMove(move('d5', 'e4')), 'Premove played.');
  assert.equal(game.board.get('e4').color, 'w');
  assert.equal(game.queued, null);
});

test('illegal queued move clears without altering the board', () => {
  const game = createPracticeGame();
  game.playerMove(move('e2', 'e4'));
  game.playerMove(move('e4', 'd5'));
  assert.match(game.opponentMove(move('a7', 'a6')), /no longer legal/);
  assert.equal(game.board.get('e4').type, 'p');
  assert.equal(game.board.turn(), 'w');
  assert.equal(game.queued, null);
});

test('replacing, canceling, and resetting clear the previous choice', () => {
  const game = createPracticeGame();
  game.playerMove(move('e2', 'e4'));
  game.playerMove(move('g1', 'f3'));
  game.playerMove(move('b1', 'c3'));
  assert.equal(game.queued.from, 'b1');
  game.cancel();
  assert.equal(game.opponentMove(move('a7', 'a6')), 'Opponent moved.');
  game.playerMove(move('g1', 'f3'));
  game.playerMove(move('b1', 'c3'));
  game.reset();
  assert.equal(game.queued, null);
  assert.equal(game.board.history().length, 0);
});

test('queued promotion remembers the selected piece', () => {
  const game = createPracticeGame('7k/P7/8/8/8/8/8/7K b - - 0 1');
  game.playerMove(move('a7', 'a8', 'r'));
  assert.equal(game.opponentMove(move('h8', 'g7')), 'Premove played.');
  assert.equal(game.board.get('a8').type, 'r');
});

test('a checkmating reply clears the queue', () => {
  const game = createPracticeGame();
  game.playerMove(move('f2', 'f3'));
  game.opponentMove(move('e7', 'e5'));
  game.playerMove(move('g2', 'g4'));
  game.playerMove(move('a2', 'a3'));
  assert.match(game.opponentMove(move('d8', 'h4')), /Game ended/);
  assert.equal(game.queued, null);
});

test('forced replies have shorter delays and the delay respects the clock', () => {
  assert.ok(opponentDelay(1, 5000) < opponentDelay(20, 5000));
  assert.equal(opponentDelay(20, 250), 150);
  assert.equal(opponentDelay(20, 50), 0);
});
