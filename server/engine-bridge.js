const fs = require('fs');
const path = require('path');
const { spawn } = require('child_process');
const { WebSocketServer } = require('ws');

const PORT = process.env.PORT || 8080;
const STOCKFISH_PATH = path.join(__dirname, '..', 'stockfish', 'stockfish-macos-m1-apple-silicon');

if (!fs.existsSync(STOCKFISH_PATH)) {
  console.error(`[ERROR] Stockfish executable not found at: ${STOCKFISH_PATH}`);
  process.exit(1);
}

// Ensure Stockfish has execution permissions on macOS
try {
  fs.chmodSync(STOCKFISH_PATH, 0o755);
} catch (err) {
  console.warn(`[WARN] Could not set executable permissions on Stockfish: ${err.message}`);
}

const wss = new WebSocketServer({ host: '127.0.0.1', port: PORT });
console.log(`[Bridge Server] Stockfish Engine Bridge running on ws://127.0.0.1:${PORT}`);

wss.on('connection', (ws) => {
  console.log('[Bridge Server] Client connected from browser/userscript.');

  // Spawn isolated Stockfish process per client session
  const engine = spawn(STOCKFISH_PATH);
  let isEngineReady = false;

  engine.stdout.on('data', (data) => {
    const lines = data.toString().split('\n');
    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed) continue;

      if (trimmed === 'readyok') {
        isEngineReady = true;
      }

      if (trimmed.startsWith('bestmove')) {
        console.log(`[Engine -> Client] ${trimmed}`);
        ws.send(JSON.stringify({ type: 'bestmove', data: trimmed }));
      } else if (trimmed.startsWith('info depth')) {
        // Send search info updates if needed
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

  // Initialize UCI engine
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
    engine.stdin.write('quit\n');
    engine.kill();
  });
});
