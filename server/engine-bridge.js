const fs = require('fs');
const path = require('path');
const { spawn, execFileSync } = require('child_process');
const { WebSocketServer } = require('ws');

const PORT = process.env.PORT || 8080;

function findOnPath(binaryName) {
  try {
    const cmd = process.platform === 'win32' ? 'where' : 'which';
    const out = execFileSync(cmd, [binaryName], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] });
    // Ignore npm's own node_modules/.bin shim (added to PATH by `npm run`); the bundled lite build is used instead.
    const first = out.split(/\r?\n/).map(s => s.trim()).find(line => line && !line.includes(`${path.sep}node_modules${path.sep}`));
    return first && fs.existsSync(first) ? first : null;
  } catch {
    return null;
  }
}

function resolveStockfishCommand(repoRoot = path.join(__dirname, '..')) {
  const candidates = [
    process.env.STOCKFISH_PATH,
    path.join(repoRoot, 'stockfish', 'stockfish'),
    path.join(repoRoot, 'stockfish', 'src', 'stockfish'),
    path.join(repoRoot, 'stockfish', 'stockfish-macos-m1-apple-silicon'),
    '/opt/homebrew/bin/stockfish',
    '/usr/local/bin/stockfish',
    '/usr/bin/stockfish',
    findOnPath('stockfish'),
  ].filter(Boolean);

  for (const candidate of candidates) {
    if (fs.existsSync(candidate)) {
      try {
        fs.chmodSync(candidate, 0o755);
      } catch {
        // Ignore chmod errors on system-owned binaries
      }
      return { type: 'binary', command: candidate, args: [] };
    }
  }

  try {
    // The lite single-threaded build initialises in about a second; the CLI wrapper loads the
    // 100 MB multi-threaded build, which can look like an indefinite hang on first connection.
    const pkgScript = require.resolve('stockfish/bin/stockfish-19-lite-single.js', { paths: [repoRoot, __dirname] });
    return { type: 'node', command: process.execPath, args: [pkgScript] };
  } catch {
    return null;
  }
}

/**
 * Starts the resolved engine, performs the UCI handshake and resolves with timing information.
 * Rejects with an Error whose message names the failing stage so users see a real diagnosis.
 */
function verifyEngine(resolved, timeoutMs = 20000) {
  return new Promise((resolve, reject) => {
    const started = Date.now();
    let output = '';
    let errors = '';
    let settled = false;
    let child;
    const finish = (error, value) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      try { child?.stdin.write('quit\n'); } catch {}
      try { child?.kill(); } catch {}
      if (error) reject(error); else resolve(value);
    };
    const timer = setTimeout(() => {
      const stage = output.includes('uciok') ? 'isready (waiting for readyok)' : 'uci (waiting for uciok)';
      finish(new Error(`Stockfish did not answer during ${stage} within ${timeoutMs} ms using ${resolved.command} ${resolved.args.join(' ')}. stderr: ${errors.trim() || 'none'}`));
    }, timeoutMs);
    try {
      child = spawn(resolved.command, resolved.args);
    } catch (err) {
      return finish(new Error(`Could not start Stockfish (${resolved.command}): ${err.message}`));
    }
    child.on('error', err => finish(new Error(`Could not start Stockfish (${resolved.command}): ${err.message}${err.code === 'EACCES' ? ' - the file is not executable' : ''}`)));
    child.on('close', code => finish(new Error(`Stockfish exited with code ${code} before it was ready. stderr: ${errors.trim() || 'none'}`)));
    child.stderr.on('data', chunk => { errors = (errors + chunk.toString()).slice(-1000); });
    child.stdout.on('data', chunk => {
      output += chunk.toString();
      if (output.includes('readyok')) finish(null, { ms: Date.now() - started });
    });
    child.stdin.on('error', () => {});
    child.stdin.write('uci\nisready\n');
  });
}

async function startServer() {
  const resolved = resolveStockfishCommand();
  if (!resolved) {
    console.error('[ERROR] No Stockfish engine found. Run `npm install` in the repository root, install native `stockfish` (for example `brew install stockfish`), or set STOCKFISH_PATH.');
    process.exit(1);
  }
  try {
    const { ms } = await verifyEngine(resolved);
    console.log(`[Bridge Server] Stockfish verified in ${ms} ms (${resolved.command} ${resolved.args.join(' ')})`);
  } catch (err) {
    console.error(`[ERROR] Stockfish failed to initialise: ${err.message}`);
    process.exit(1);
  }

  const wss = new WebSocketServer({ host: '127.0.0.1', port: PORT });
  wss.on('listening', () => {
    console.log(`[Bridge Server] Stockfish Engine Bridge running on ws://127.0.0.1:${PORT} (using ${resolved.command})`);
  });

  wss.on('connection', (ws) => {
    console.log('[Bridge Server] Client connected from browser/userscript.');
    const engine = spawn(resolved.command, resolved.args);
    const send = (payload) => { if (ws.readyState === 1) ws.send(JSON.stringify(payload)); };

    engine.on('error', (err) => {
      console.error(`[Bridge Server] Could not run Stockfish: ${err.message}`);
      send({ type: 'error', data: `Could not run Stockfish: ${err.message}` });
    });
    engine.stdin.on('error', () => {});

    engine.stdout.on('data', (data) => {
      const lines = data.toString().split('\n');
      for (const line of lines) {
        const trimmed = line.trim();
        if (!trimmed) continue;

        if (trimmed === 'readyok') send({ type: 'ready', data: 'readyok' });

        if (trimmed.startsWith('bestmove')) {
          console.log(`[Engine -> Client] ${trimmed}`);
          send({ type: 'bestmove', data: trimmed });
        } else if (trimmed.startsWith('info depth')) {
          send({ type: 'info', data: trimmed });
        }
      }
    });

    engine.stderr.on('data', (data) => {
      console.error(`[Stockfish Error] ${data.toString()}`);
    });

    engine.on('close', (code) => {
      console.log(`[Bridge Server] Stockfish process exited with code ${code}`);
      if (code !== 0 && code !== null) send({ type: 'error', data: `Stockfish exited unexpectedly with code ${code}` });
    });

    engine.stdin.write('uci\n');
    engine.stdin.write('isready\n');

    ws.on('message', (message) => {
      try {
        const payload = JSON.parse(message.toString());

        if (payload.type === 'configure') {
          const { depth, elo, skillLevel } = payload;
          console.log(`[Config] Depth: ${depth}, ELO: ${elo}, Skill: ${skillLevel}`);
          engine.stdin.write('ucinewgame\n');

          if (elo && elo < 3150) {
            engine.stdin.write('setoption name UCI_LimitStrength value true\n');
            engine.stdin.write(`setoption name UCI_Elo value ${elo}\n`);
          } else if (skillLevel !== undefined) {
            engine.stdin.write('setoption name UCI_LimitStrength value false\n');
            engine.stdin.write(`setoption name Skill Level value ${skillLevel}\n`);
          } else {
            engine.stdin.write('setoption name UCI_LimitStrength value false\n');
          }
          engine.stdin.write('isready\n');
        } else if (payload.type === 'analyze') {
          const { fen, moves, depth } = payload;
          engine.stdin.write('stop\n');

          if (moves && moves.length > 0) {
            engine.stdin.write(`position startpos moves ${moves.join(' ')}\n`);
          } else if (fen) {
            engine.stdin.write(`position fen ${fen}\n`);
          } else {
            engine.stdin.write('position startpos\n');
          }

          const targetDepth = depth || 15;
          console.log(`[Engine] Analyzing depth ${targetDepth}...`);
          engine.stdin.write(`go depth ${targetDepth}\n`);
        } else if (payload.type === 'stop') {
          engine.stdin.write('stop\n');
        }
      } catch (err) {
        console.error(`[Bridge Server] Error processing message: ${err.message}`);
      }
    });

    ws.on('close', () => {
      console.log('[Bridge Server] Client disconnected. Terminating Stockfish process...');
      try {
        engine.stdin.write('quit\n');
      } catch {
        // Ignore broken pipe if already closed
      }
      engine.kill();
    });
  });

  return wss;
}

if (require.main === module) {
  if (process.argv.includes('--check')) {
    const resolved = resolveStockfishCommand();
    if (!resolved) {
      console.error('[ERROR] No Stockfish engine found. Run `npm install`, install native `stockfish`, or set STOCKFISH_PATH.');
      process.exit(1);
    }
    verifyEngine(resolved).then(({ ms }) => {
      console.log(`Stockfish OK: ${resolved.command} ${resolved.args.join(' ')} answered in ${ms} ms`);
    }).catch((err) => {
      console.error(`[ERROR] ${err.message}`);
      process.exit(1);
    });
  } else {
    startServer();
  }
}

module.exports = { resolveStockfishCommand, verifyEngine, startServer };
