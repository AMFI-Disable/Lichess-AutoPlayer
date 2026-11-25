const test = require('node:test');
const assert = require('node:assert/strict');
const { spawn } = require('node:child_process');
const { resolveStockfishCommand } = require('../server/engine-bridge');

test('resolveStockfishCommand finds a runnable Stockfish engine after npm install', () => {
  const resolved = resolveStockfishCommand();
  assert.ok(resolved, 'Expected resolveStockfishCommand() to find a Stockfish binary or npm engine');
  assert.ok(resolved.command, 'Expected resolved.command to be non-empty');
});

test('resolved Stockfish engine responds to UCI handshake', async () => {
  const resolved = resolveStockfishCommand();
  assert.ok(resolved);

  const output = await new Promise((resolve, reject) => {
    const child = spawn(resolved.command, resolved.args);
    let buf = '';
    const timer = setTimeout(() => {
      child.kill();
      reject(new Error(`Stockfish UCI handshake timed out. Output so far:\n${buf}`));
    }, 10000);

    child.stdout.on('data', chunk => {
      buf += chunk.toString();
      if (buf.includes('readyok')) {
        clearTimeout(timer);
        try { child.stdin.write('quit\n'); } catch {}
        child.kill();
        resolve(buf);
      }
    });
    child.on('error', err => {
      clearTimeout(timer);
      reject(err);
    });
    child.stdin.write('uci\nisready\n');
  });

  assert.match(output, /uciok/);
  assert.match(output, /readyok/);
});

test('verifyEngine reports a meaningful error when the engine cannot be started', async () => {
  const { verifyEngine } = require('../server/engine-bridge');
  await assert.rejects(
    verifyEngine({ command: '/nonexistent/stockfish-binary', args: [] }, 5000),
    /Could not start Stockfish/
  );
});

test('verifyEngine reports the stalled stage instead of waiting forever', async () => {
  const { verifyEngine } = require('../server/engine-bridge');
  await assert.rejects(
    verifyEngine({ command: process.execPath, args: ['-e', 'setInterval(() => {}, 1000)'] }, 500),
    /did not answer during uci \(waiting for uciok\) within 500 ms/
  );
});

test('verifyEngine reports an engine that exits early', async () => {
  const { verifyEngine } = require('../server/engine-bridge');
  await assert.rejects(
    verifyEngine({ command: process.execPath, args: ['-e', 'process.exit(3)'] }, 5000),
    /exited with code 3/
  );
});

test('npm run check:engine succeeds with the bundled engine', () => {
  const { spawnSync } = require('node:child_process');
  const result = spawnSync(process.execPath, ['server/engine-bridge.js', '--check'], { encoding: 'utf8', timeout: 30000 });
  assert.equal(result.status, 0, result.stderr);
  assert.match(result.stdout, /Stockfish OK/);
});

test('bridge answers a WebSocket analysis request end to end', async (t) => {
  const { spawn } = require('node:child_process');
  const WebSocket = require('ws');
  const port = 18000 + Math.floor(Math.random() * 1000);
  const bridge = spawn(process.execPath, ['server/engine-bridge.js'], { env: { ...process.env, PORT: String(port) }, stdio: ['ignore', 'pipe', 'pipe'] });
  t.after(() => bridge.kill());
  await new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error('bridge did not start')), 20000);
    bridge.stdout.on('data', d => { if (String(d).includes('running on')) { clearTimeout(timer); resolve(); } });
    bridge.on('close', code => { clearTimeout(timer); reject(new Error(`bridge exited with ${code}`)); });
  });
  const reply = await new Promise((resolve, reject) => {
    const ws = new WebSocket(`ws://127.0.0.1:${port}`);
    const timer = setTimeout(() => { ws.close(); reject(new Error('no bestmove')); }, 20000);
    ws.on('open', () => ws.send(JSON.stringify({ type: 'analyze', depth: 5 })));
    ws.on('message', m => { const p = JSON.parse(m); if (p.type === 'bestmove') { clearTimeout(timer); ws.close(); resolve(p.data); } });
    ws.on('error', reject);
  });
  assert.match(reply, /^bestmove [a-h][1-8][a-h][1-8]/);
});
