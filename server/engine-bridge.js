const fs = require('fs');
const path = require('path');
const { spawn, execFileSync } = require('child_process');
const { WebSocketServer } = require('ws');

const PORT = process.env.PORT || 8080;

function findOnPath(binaryName) {
  try {
    const cmd = process.platform === 'win32' ? 'where' : 'which';
    const out = execFileSync(cmd, [binaryName], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] });
    const first = out.split(/\r?\n/).map(s => s.trim()).find(Boolean);
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
    const npmBin = path.join(repoRoot, 'node_modules', '.bin', 'stockfish');
    if (fs.existsSync(npmBin)) {
      return { type: 'binary', command: npmBin, args: [] };
    }
    const pkgScript = require.resolve('stockfish/bin/stockfish-19-lite-single.js');
    return { type: 'node', command: process.execPath, args: [pkgScript] };
  } catch {
    return null;
  }
}

function startServer() {
  const resolved = resolveStockfishCommand();
  if (!resolved) {
    console.error('[ERROR] No Stockfish engine found. Run `npm install` or install native `stockfish` (e.g. `brew install stockfish` or set STOCKFISH_PATH).');
    process.exit(1);
  }

  const wss = new WebSocketServer({ host: '127.0.0.1', port: PORT });
  console.log(`[Bridge Server] Stockfish Engine Bridge running on ws://127.0.0.1:${PORT} (using ${resolved.command})`);

  wss.on('connection', (ws) => {
    console.log('[Bridge Server] Client connected from browser/userscript.');
    const engine = spawn(resolved.command, resolved.args);

    engine.stdout.on('data', (data) => {
      const lines = data.toString().split('\n');
      for (const line of lines) {
        const trimmed = line.trim();
        if (!trimmed) continue;

        if (trimmed.startsWith('bestmove')) {
          console.log(`[Engine -> Client] ${trimmed}`);
          ws.send(JSON.stringify({ type: 'bestmove', data: trimmed }));
        } else if (trimmed.startsWith('info depth')) {
          ws.send(JSON.stringify({ type: 'info', data: trimmed }));
        }
      }
    });

    engine.stderr.on('data', (data) => {
      console.error(`[Stockfish Error] ${data.toString()}`);
    });

    engine.on('close', (code) => {
      console.log(`[Bridge Server] Stockfish process exited with code ${code}`);
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
  startServer();
}

module.exports = { resolveStockfishCommand, startServer };
