const test = require('node:test');
const assert = require('node:assert/strict');
const { normalizeSettings, skillFor, parseClock, moveBudget, mouseSpeed, parseVariation, chooseVariation, gameOutcome, analysisCounts, squarePosition, sameGeometry, parseMoves, gameIdFromPath } = require('../lichess-autoplayer.user.js');

test('rating slider settings are validated and old presets migrate', () => {
  assert.deepEqual(normalizeSettings({ time: 'bad', limit: -1, strength: 'bad' }), { time: '3+0', limit: '1', strength: 1500, autoAnalysis: true });
  assert.deepEqual(normalizeSettings({ time: '5+3', limit: 5, strength: 1750 }), { time: '5+3', limit: '5', strength: 1750, autoAnalysis: true });
  assert.equal(normalizeSettings({ strength: 'club' }).strength, 1500);
  assert.equal(normalizeSettings({ autoAnalysis: false }).autoAnalysis, false);
  assert.equal(skillFor(1000), 0);
  assert.equal(skillFor(3000), 20);
});
test('clock parses standard and fractional seconds and rejects invalid displays', () => {
  assert.equal(parseClock('3:00'), 180000);
  assert.equal(parseClock('0:09.5'), 9500);
  assert.equal(parseClock('01:23,45'), 83450);
  assert.equal(parseClock('2:99'), null);
  assert.equal(parseClock(''), null);
});
test('search budget shortens as time runs low and remains bounded without a clock', () => {
  assert.deepEqual(moveBudget(null), { search: 500, delay: 150 });
  assert.equal(moveBudget(180000).search, 2000);
  assert.equal(moveBudget(12000).search, 308);
  assert.equal(moveBudget(0).search, 50);
  assert.ok(moveBudget(10000).delay < moveBudget(30000).delay);
  assert.equal(moveBudget(3000).delay, 0);
  assert.ok(moveBudget(3000).search < moveBudget(12000).search);
});
test('board coordinates account for orientation', () => {
  const rect = { left: 10, top: 20, width: 800, height: 800 };
  assert.deepEqual(squarePosition('a1', rect, false), { x: 60, y: 770 });
  assert.deepEqual(squarePosition('a1', rect, true), { x: 760, y: 70 });
  assert.deepEqual(squarePosition('h8', rect, true), { x: 60, y: 770 });
});
test('move parsing fails closed on invalid notation', () => {
  class Chess { move(san) { return san === 'e4'; } }
  assert.ok(parseMoves(['e4+'], Chess));
  assert.throws(() => parseMoves(['invalid'], Chess), /Could not read/);
  assert.throws(() => parseMoves([], null), /failed to load/);
});

test('recognizes player game URLs and rejects lobby and spectator routes', () => {
  assert.equal(gameIdFromPath('/game/DDHABPubK5iR'), 'DDHABPubK5iR');
  assert.equal(gameIdFromPath('/DDHABPubK5iR'), 'DDHABPubK5iR');
  assert.equal(gameIdFromPath('/game/DDHABPubK5iR/black'), 'DDHABPubK5iR');
  assert.equal(gameIdFromPath('/game/DDHABPub'), null);
  assert.equal(gameIdFromPath('/'), null);
});


test('geometry comparison ignores unrelated scrolls and detects board movement', () => {
  const initial = { left: 10, top: 20, width: 600, height: 600, screenX: 0, screenY: 0, outerWidth: 1000, outerHeight: 800 };
  assert.equal(sameGeometry(initial, { ...initial }), true);
  assert.equal(sameGeometry(initial, { ...initial, top: 25 }), false);
  assert.equal(sameGeometry(initial, { ...initial, screenX: 10 }), false);
});

test('engine variations use complete centipawn scores and legal same-depth moves', () => {
  assert.deepEqual(parseVariation('info depth 10 multipv 2 score cp 140 nodes 5 pv d2d4 d7d5'), { depth: 10, rank: 2, score: 140, move: 'd2d4' });
  assert.equal(parseVariation('info depth 10 multipv 1 score mate 3 pv e2e4'), null);
  assert.equal(parseVariation('info depth 10 multipv 1 score cp 20 lowerbound pv e2e4'), null);
  const best = { depth: 10, rank: 1, score: 250, move: 'e2e4' };
  const safe = { depth: 10, rank: 2, score: 180, move: 'd2d4' };
  const unsafe = { depth: 10, rank: 3, score: 20, move: 'g2g4' };
  const legal = ['e2e4', 'd2d4', 'g2g4'];
  assert.equal(chooseVariation('e2e4', legal, [best, safe, unsafe], () => 0), 'd2d4');
  assert.equal(chooseVariation('e2e4', legal, [best, unsafe], () => 0), 'e2e4');
  assert.equal(chooseVariation('e2e4', legal, [best, { ...safe, depth: 9 }], () => 0), 'e2e4');
  assert.equal(chooseVariation('e2e4', legal, [best, safe], () => 0.9), 'e2e4');
  assert.equal(chooseVariation('e2e4', legal, [{ ...best, move: 'g2g4' }, safe], () => 0), 'e2e4');
});

test('pointer profile follows the time control and remaining clock', () => {
  assert.equal(mouseSpeed('1+0', null), 'bullet');
  assert.equal(mouseSpeed('3+0', 15000), 'blitz');
  assert.equal(mouseSpeed('5+3', 30000), 'blitz');
  assert.equal(mouseSpeed('10+0', 30000), 'rapid');
  assert.equal(mouseSpeed('10+0', 14999), 'quick');
});

test('game outcomes and analysis use the player color and preserve unavailable data', () => {
  assert.equal(gameOutcome('1-0', 'w'), 'Win');
  assert.equal(gameOutcome('1-0', 'b'), 'Loss');
  assert.equal(gameOutcome('½-½', 'b'), 'Draw');
  assert.equal(gameOutcome('', 'w'), 'Other');
  const data = { players: { white: { analysis: { inaccuracy: 1, mistake: 2, blunder: 3 } } } };
  assert.deepEqual(analysisCounts(data, 'w'), { inaccuracy: 1, mistake: 2, blunder: 3 });
  assert.equal(analysisCounts(data, 'b'), null);
  assert.equal(analysisCounts({ players: { white: { analysis: { inaccuracy: 1 } } } }, 'w'), null);
});
