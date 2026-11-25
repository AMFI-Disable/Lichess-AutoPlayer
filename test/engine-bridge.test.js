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
