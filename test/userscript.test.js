const test = require('node:test');
const assert = require('node:assert/strict');
const { normalizeSettings, skillFor, parseClock, moveBudget, opponentThinkTime, responsiveBudget, mouseSpeed, parseVariation, chooseVariation, gameOutcome, analysisCounts, squarePosition, sameGeometry, parseMoves, gameIdFromPath, shouldRequestAnalysis, classifyMoveTimeout, nextBackoffMs, patchEngineSource } = require('../lichess-autoplayer.user.js');

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
test('opening moves have a shorter search and submission delay', () => {
  assert.deepEqual(moveBudget(180000, true), { search: 1600, delay: 175 });
  assert.deepEqual(moveBudget(null, true), { search: 400, delay: 75 });
  assert.deepEqual(moveBudget(0, true), { search: 50, delay: 0 });
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
  assert.equal(mouseSpeed('1+0', 20000), 'quick');
  assert.equal(mouseSpeed('3+0', 15000), 'blitz');
  assert.equal(mouseSpeed('5+3', 30000), 'blitz');
  assert.equal(mouseSpeed('10+0', 30000), 'rapid');
  assert.equal(mouseSpeed('10+0', 14999), 'quick');
});

test('1+0 bullet budget eliminates artificial delay and scales smoothly under low clock', () => {
  const high = moveBudget(55000, false, '1+0');
  const mid = moveBudget(20000, false, '1+0');
  const low = moveBudget(4000, false, '1+0');
  assert.equal(high.delay, 0);
  assert.equal(mid.delay, 0);
  assert.equal(low.delay, 0);
  assert.ok(high.search <= 600 && high.search > mid.search && mid.search > low.search && low.search >= 40);
  const resp = responsiveBudget(30000, false, 900, 350, '1+0');
  assert.equal(resp.delay, 0);
  assert.ok(resp.search >= 40 && resp.search <= 400);
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

test('opponent clock samples account for increment and skip missed turns', () => {
  assert.equal(opponentThinkTime({ ply: 2, clock: 15000 }, { ply: 4, clock: 16000 }, '5+3'), 2000);
  assert.equal(opponentThinkTime({ ply: 2, clock: 15000 }, { ply: 6, clock: 14000 }, '3+0'), null);
  assert.equal(opponentThinkTime({ ply: 2, clock: 15000 }, { ply: 4, clock: null }, '3+0'), null);
});

test('responsive search accounts for submission time and preserves the clock cap', () => {
  assert.deepEqual(responsiveBudget(180000, false, 3000, 1200), { search: 1200, delay: 0 });
  assert.deepEqual(responsiveBudget(180000, false, 300, 1200), { search: 50, delay: 0 });
  assert.deepEqual(responsiveBudget(2200, false, 5000, 1600), { search: 50, delay: 0 });
  assert.deepEqual(responsiveBudget(null, false, null, 1200), { search: 500, delay: 150 });
});

test('recovery helpers prevent duplicate moves and skip analysis on aborted games', () => {
  assert.equal(shouldRequestAnalysis({ ended: true, ply: 0, result: '' }), false);
  assert.equal(shouldRequestAnalysis({ ended: true, ply: 2, result: '1-0' }), false);
  assert.equal(shouldRequestAnalysis({ ended: true, ply: 24, result: '1-0' }), true);
  assert.equal(classifyMoveTimeout({ gameId: 'abcd1234', key: 'k1', retries: 0 }, { id: 'abcd1234', ended: false, key: 'k2', color: 'w', chess: { turn: () => 'b' } }), 'confirmed');
  assert.equal(classifyMoveTimeout({ gameId: 'abcd1234', key: 'k1', retries: 0 }, { id: 'abcd1234', ended: true, key: 'k1' }), 'ended');
  assert.equal(classifyMoveTimeout({ gameId: 'abcd1234', key: 'k1', retries: 0 }, { id: 'abcd1234', ended: false, key: 'k1', color: 'w', chess: { turn: () => 'w' } }), 'retry');
  assert.equal(classifyMoveTimeout({ gameId: 'abcd1234', key: 'k1', retries: 2 }, { id: 'abcd1234', ended: false, key: 'k1', color: 'w', chess: { turn: () => 'w' } }), 'abort');
  assert.equal(classifyMoveTimeout({ gameId: 'abcd1234', key: 'k1', retries: 0 }, { id: 'other999', ended: false, key: 'k1' }), 'stale');
  assert.equal(nextBackoffMs(1, 350, 1500), 350);
  assert.equal(nextBackoffMs(3, 350, 1500), 1400);
  assert.equal(nextBackoffMs(5, 350, 1500), 1500);
});

test('patchEngineSource validates engine payload and rewrites locateFile base URL', () => {
  assert.throws(() => patchEngineSource('<html>502</html>', 'https://cdn.example/'), /empty or invalid/);
  assert.throws(() => patchEngineSource('short', 'https://cdn.example/'), /empty or invalid/);
  const sample = 'var Module={locateFile:function(file){return file},pad:"' + 'x'.repeat(1100) + '"};';
  const patched = patchEngineSource(sample, 'https://cdn.example/sf/');
  assert.ok(patched.includes("locateFile:function(file){return 'https://cdn.example/sf/'+file}"));
});
