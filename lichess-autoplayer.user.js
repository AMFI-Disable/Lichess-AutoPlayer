// ==UserScript==
// @name         Lichess Pure AutoPlayer (Standalone Userscript)
// @namespace    https://github.com/amfi-disable/Lichess-AutoPlayer
// @version      1.0.0
// @description  100% Standalone in-browser chess bot. No NPM, no local server, no external bridge needed.
// @author       amfi-disable
// @match        *://lichess.org/*
// @grant        GM_setValue
// @grant        GM_getValue
// @grant        GM_xmlhttpRequest
// @connect      cdnjs.cloudflare.com
// @connect      cdn.jsdelivr.net
// @run-at       document-idle
// @require      https://cdnjs.cloudflare.com/ajax/libs/chess.js/0.10.3/chess.min.js
// ==/UserScript==

(function () {
  'use strict';

  // State & Default Settings
  const state = {
    active: GM_getValue('ap_active', false),
    engineReady: false,
    gameType: GM_getValue('ap_gameType', '1+0'), // '1+0', '3+0', '5+3', '10+0'
    matchLimit: GM_getValue('ap_matchLimit', 'infinite'), // 'infinite' or number
    matchesPlayed: 0,
    baseDelayMs: GM_getValue('ap_baseDelayMs', 800),
    jitterMs: GM_getValue('ap_jitterMs', 400),
    depth: GM_getValue('ap_depth', 12),
    elo: GM_getValue('ap_elo', 1500),
    limitElo: GM_getValue('ap_limitElo', false),
    isProcessingMove: false,
    lastMovesStr: '',
    engine: null
  };

  // 100% Standalone In-Browser Engine (bypasses CSP via GM_xmlhttpRequest + inline Data URI Worker)
  function initEngine() {
    updateUIStatus('Initializing Engine...', '#ff9800');

    function setupEngineInstance(engineWorker) {
      state.engine = engineWorker;

      state.engine.onmessage = function (event) {
        const line = typeof event === 'string' ? event : (event.data || event);
        const str = typeof line === 'string' ? line : (line.data || '');

        if (str.includes('readyok') || str.includes('uciok') || str.includes('Stockfish')) {
          if (!state.engineReady) {
            state.engineReady = true;
            updateUIStatus('Engine Ready', '#4caf50');
          }
        }
        if (str.includes('bestmove')) {
          handleBestMoveOutput(str);
        }
      };

      state.engine.postMessage('uci');
      configureEngineOptions();
      state.engine.postMessage('isready');
    }

    // Try direct factory function if exposed in GM sandbox
    let sfFactory = null;
    if (typeof window.STOCKFISH === 'function') sfFactory = window.STOCKFISH;
    else if (typeof STOCKFISH === 'function') sfFactory = STOCKFISH;
    else if (typeof window.Stockfish === 'function') sfFactory = window.Stockfish;
    else if (typeof Stockfish === 'function') sfFactory = Stockfish;
    else if (typeof unsafeWindow !== 'undefined' && typeof unsafeWindow.STOCKFISH === 'function') sfFactory = unsafeWindow.STOCKFISH;

    if (sfFactory) {
      setupEngineInstance(sfFactory());
      return;
    }

    // Fetch Stockfish engine JS via GM_xmlhttpRequest to bypass Lichess CSP / CORS blocks
    const stockfishUrl = 'https://cdnjs.cloudflare.com/ajax/libs/stockfish.js/10.0.2/stockfish.js';
    GM_xmlhttpRequest({
      method: 'GET',
      url: stockfishUrl,
      onload: function (response) {
        try {
          const sfCode = response.responseText;
          const wrapperCode = `
            ${sfCode}
            var engine = (typeof STOCKFISH === 'function' ? STOCKFISH : Stockfish)();
            engine.onmessage = function(e) { self.postMessage(e); };
            self.onmessage = function(e) { engine.postMessage(e.data); };
          `;
          const blob = new Blob([wrapperCode], { type: 'application/javascript' });
          const worker = new Worker(URL.createObjectURL(blob));
          setupEngineInstance(worker);
        } catch (err) {
          console.error('[AutoPlayer] Error launching GM_xmlhttpRequest Stockfish worker:', err);
          updateUIStatus('Engine Load Failed', '#f44336');
        }
      },
      onerror: function (err) {
        console.error('[AutoPlayer] GM_xmlhttpRequest fetch failed:', err);
        updateUIStatus('Engine Download Failed', '#f44336');
      }
    });
  }

  function configureEngineOptions() {
    if (!state.engine) return;
    state.engine.postMessage('ucinewgame');
    if (state.limitElo && state.elo) {
      state.engine.postMessage('setoption name UCI_LimitStrength value true');
      state.engine.postMessage(`setoption name UCI_Elo value ${state.elo}`);
    } else {
      state.engine.postMessage('setoption name UCI_LimitStrength value false');
    }
    state.engine.postMessage('isready');
  }

  // Handle Bestmove Event
  function handleBestMoveOutput(bestMoveLine) {
    const match = bestMoveLine.match(/^bestmove\s+([a-h][1-8][a-h][1-8][qrbn]?)/);
    if (!match) {
      state.isProcessingMove = false;
      return;
    }

    const uciMove = match[1];
    const fromSquare = uciMove.substring(0, 2);
    const toSquare = uciMove.substring(2, 4);
    const promotion = uciMove.length === 5 ? uciMove[4] : null;

    const delay = parseInt(state.baseDelayMs, 10) + Math.floor(Math.random() * parseInt(state.jitterMs, 10));
    console.log(`[AutoPlayer] Best move: ${uciMove}. Playing in ${delay}ms...`);
    updateUIStatus(`Move: ${uciMove} (${delay}ms)`, '#2196f3');

    setTimeout(() => {
      executeMoveOnBoard(fromSquare, toSquare, promotion);
      state.isProcessingMove = false;
    }, delay);
  }

  // Dispatch a move through Chessground's public DOM input surface. Lichess
  // currently handles mouse events, while some Chessground builds handle
  // pointer events, so emit both when PointerEvent is available and retain a
  // MouseEvent-only fallback. The event options intentionally include the
  // complete primary-button state required by both implementations.
  function executeMoveOnBoard(from, to, promotion) {
    const board = document.querySelector('cg-board');
    if (!board) return false;
    if (!/^[a-h][1-8]$/.test(from) || !/^[a-h][1-8]$/.test(to)) return false;
    if (promotion && !/^[qrbn]$/i.test(promotion)) return false;

    const wrap = board.closest('.cg-wrap, cg-container') || board.parentElement;
    const isFlipped = Boolean(wrap?.classList?.contains('orientation-black')) ||
      Boolean(board.closest('.orientation-black'));
    const rect = board.getBoundingClientRect();
    if (!rect.width || !rect.height) return false;

    function getSquareCoords(square) {
      const file = square.charCodeAt(0) - 97;
      const rank = Number(square[1]) - 1;
      const fileIndex = isFlipped ? 7 - file : file;
      const rankIndex = isFlipped ? rank : 7 - rank;
      const squareWidth = rect.width / 8;
      const squareHeight = rect.height / 8;

      return {
        x: rect.left + (fileIndex + 0.5) * squareWidth,
        y: rect.top + (rankIndex + 0.5) * squareHeight
      };
    }

    function dispatchBoardInput(type, position) {
      const isDown = type.endsWith('down');
      const options = {
        bubbles: true,
        cancelable: true,
        composed: true,
        view: window,
        clientX: position.x,
        clientY: position.y,
        button: 0,
        buttons: 1,
        pointerId: 1,
        pointerType: 'mouse',
        isPrimary: true
      };
      const hitTarget = document.elementFromPoint(position.x, position.y);
      const target = hitTarget && board.contains(hitTarget) ? hitTarget : board;

      // Lichess Chessground uses mousedown/mouseup. PointerEvent is retained
      // for compatible Chessground builds, but never replaces mouse input.
      if (typeof window.PointerEvent === 'function') {
        target.dispatchEvent(new window.PointerEvent(`pointer${isDown ? 'down' : 'up'}`, options));
      }
      target.dispatchEvent(new window.MouseEvent(type, options));
    }

    function dispatchSquareClick(position) {
      dispatchBoardInput('mousedown', position);
      dispatchBoardInput('mouseup', position);
    }

    function isVisible(element) {
      const style = window.getComputedStyle(element);
      const elementRect = element.getBoundingClientRect();
      return style.display !== 'none' && style.visibility !== 'hidden' &&
        elementRect.width > 0 && elementRect.height > 0;
    }

    function choosePromotionPiece(piece) {
      const pieceNames = { q: 'queen', r: 'rook', b: 'bishop', n: 'knight' };
      const name = pieceNames[piece.toLowerCase()];
      if (!name) return false;

      const choices = Array.from(document.querySelectorAll(
        '.promotion-choice, #promotion-choice, [role="dialog"]'
      )).filter(isVisible);
      const roots = choices.length ? choices : [document];
      const selectors = [
        `piece.${name}`,
        `piece.${piece.toLowerCase()}`,
        `[data-piece="${name}"]`,
        `[data-piece="${piece.toLowerCase()}"]`,
        `button.${name}`,
        `button.${piece.toLowerCase()}`
      ];

      for (const root of roots) {
        const option = selectors
          .map(selector => root.matches?.(selector) ? root : root.querySelector(selector))
          .find(Boolean);
        if (!option || !isVisible(option)) continue;
        option.click();
        return true;
      }
      return false;
    }

    const fromPosition = getSquareCoords(from);
    const toPosition = getSquareCoords(to);
    dispatchSquareClick(fromPosition);

    // Allow Chessground to render the selected state before the destination
    // click. Promotion choices are rendered only after that destination click.
    window.setTimeout(() => {
      dispatchSquareClick(toPosition);
      if (!promotion) return;

      const startedAt = Date.now();
      const selectPromotion = () => {
        if (choosePromotionPiece(promotion) || Date.now() - startedAt >= 1000) return;
        window.requestAnimationFrame(selectPromotion);
      };
      window.requestAnimationFrame(selectPromotion);
    }, 120);

    return true;
  }

  // Parse moves from DOM and convert SAN moves to UCI moves using chess.js
  function getUciMovesFromDom() {
    const moveNodes = document.querySelectorAll('l4x kwdb, rm61 kwdb, u8t kwdb, .moves move, kwdb');
    const sanMoves = Array.from(moveNodes).map(el => el.innerText.trim().replace(/[?!#+]/g, '')).filter(m => m && !m.match(/^\d+\.$/));

    if (sanMoves.length === 0) return [];

    if (typeof window.Chess !== 'function') {
      return sanMoves;
    }

    const chess = new window.Chess();
    const uciMoves = [];

    for (const san of sanMoves) {
      try {
        const moveObj = chess.move(san, { sloppy: true });
        if (moveObj) {
          uciMoves.push(moveObj.from + moveObj.to + (moveObj.promotion || ''));
        }
      } catch (err) {
        break;
      }
    }

    return uciMoves;
  }

  // Board State Observer Loop
  function observeGameAndTriggerTurn() {
    if (!state.active || !state.engineReady || state.isProcessingMove) return;

    const board = document.querySelector('cg-board');
    if (!board) return;

    // Detect game over and auto-seek
    if (document.querySelector('.follow-up a.user-link, a.button[href*="opponent"], .result')) {
      handleGameConclusion();
      return;
    }

    // Determine color from Chessground container orientation
    const wrap = document.querySelector('.cg-wrap, cg-container');
    const isBlack = wrap?.classList?.contains('orientation-black') ||
                    document.querySelector('coords.files')?.classList.contains('black');
    const myColor = isBlack ? 'b' : 'w';

    const uciMoves = getUciMovesFromDom();
    const turnColor = (uciMoves.length % 2 === 0) ? 'w' : 'b';

    if (turnColor === myColor) {
      const uciStr = uciMoves.join(' ');
      if (uciStr !== state.lastMovesStr) {
        state.lastMovesStr = uciStr;
        state.isProcessingMove = true;

        console.log(`[AutoPlayer] My turn (${myColor}). Requesting move analysis...`);
        updateUIStatus('Thinking...', '#ff9800');

        state.engine.postMessage('stop');
        if (uciMoves.length > 0) {
          state.engine.postMessage(`position startpos moves ${uciStr}`);
        } else {
          state.engine.postMessage('position startpos');
        }
        state.engine.postMessage(`go depth ${parseInt(state.depth, 10)}`);
      }
    }
  }

  // Game End & Automatic "New Opponent" Re-queueing
  let gameEndHandled = false;
  function handleGameConclusion() {
    if (gameEndHandled || !state.active) return;
    gameEndHandled = true;
    state.matchesPlayed++;

    if (state.matchLimit !== 'infinite' && state.matchesPlayed >= parseInt(state.matchLimit, 10)) {
      state.active = false;
      GM_setValue('ap_active', false);
      updateUIStatus(`Match limit (${state.matchLimit}) reached. Stopped.`, '#f44336');
      updateToggleButton();
      return;
    }

    updateUIStatus('Game finished. Auto-seeking New Opponent...', '#9c27b0');

    setTimeout(() => {
      const newOpponentBtn = document.querySelector('.follow-up a[href*="opponent"], a.button[href*="opponent"], button.new-game');
      if (newOpponentBtn) {
        newOpponentBtn.click();
      } else {
        // Trigger quick pairing preset (e.g., 1+0 Bullet, 3+0 Blitz)
        const targetPerf = state.gameType;
        const pairingBtn = Array.from(document.querySelectorAll('.clock, [data-act], .category button, .quick-pairing button')).find(btn => {
          const txt = btn.innerText || btn.getAttribute('data-act') || '';
          return txt.includes(targetPerf);
        });
        if (pairingBtn) pairingBtn.click();
      }
      gameEndHandled = false;
    }, 3000);
  }

  // Floating Control Panel UI
  function renderControlPanel() {
    if (document.getElementById('ap-control-panel')) return;

    const panel = document.createElement('div');
    panel.id = 'ap-control-panel';
    panel.style.cssText = `
      position: fixed;
      bottom: 20px;
      right: 20px;
      width: 290px;
      background: #18181c;
      color: #f0f0f0;
      border: 1px solid #333;
      border-radius: 10px;
      padding: 14px;
      font-family: system-ui, -apple-system, sans-serif;
      font-size: 13px;
      z-index: 999999;
      box-shadow: 0 8px 24px rgba(0,0,0,0.6);
    `;

    panel.innerHTML = `
      <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:10px;">
        <strong style="font-size:14px; color:#4caf50;">🤖 Lichess AutoPlayer</strong>
        <span id="ap-status-badge" style="font-size:11px; padding:2px 6px; border-radius:4px; background:#ff9800; color:#fff;">Initializing...</span>
      </div>

      <div style="margin-bottom:8px;">
        <button id="ap-toggle-btn" style="width:100%; padding:8px; border:none; border-radius:6px; font-weight:bold; cursor:pointer; background:${state.active ? '#f44336' : '#4caf50'}; color:#fff;">
          ${state.active ? 'STOP AUTOPLAYER' : 'START AUTOPLAYER'}
        </button>
      </div>

      <div style="display:grid; grid-template-columns:1fr 1fr; gap:8px; margin-bottom:8px;">
        <div>
          <label>Game Type:</label>
          <select id="ap-game-type" style="width:100%; background:#26262e; color:#fff; border:1px solid #444; border-radius:4px; padding:4px;">
            <option value="1+0" ${state.gameType === '1+0' ? 'selected' : ''}>1+0 Bullet</option>
            <option value="3+0" ${state.gameType === '3+0' ? 'selected' : ''}>3+0 Blitz</option>
            <option value="5+3" ${state.gameType === '5+3' ? 'selected' : ''}>5+3 Blitz</option>
            <option value="10+0" ${state.gameType === '10+0' ? 'selected' : ''}>10+0 Rapid</option>
          </select>
        </div>
        <div>
          <label>Matches:</label>
          <select id="ap-match-limit" style="width:100%; background:#26262e; color:#fff; border:1px solid #444; border-radius:4px; padding:4px;">
            <option value="infinite" ${state.matchLimit === 'infinite' ? 'selected' : ''}>Infinite</option>
            <option value="1" ${state.matchLimit === '1' ? 'selected' : ''}>1 Match</option>
            <option value="5" ${state.matchLimit === '5' ? 'selected' : ''}>5 Matches</option>
            <option value="10" ${state.matchLimit === '10' ? 'selected' : ''}>10 Matches</option>
          </select>
        </div>
      </div>

      <div style="display:grid; grid-template-columns:1fr 1fr; gap:8px; margin-bottom:8px;">
        <div>
          <label>Base Delay (ms):</label>
          <input type="number" id="ap-base-delay" value="${state.baseDelayMs}" step="100" style="width:90%; background:#26262e; color:#fff; border:1px solid #444; border-radius:4px; padding:4px;" />
        </div>
        <div>
          <label>Jitter (ms):</label>
          <input type="number" id="ap-jitter" value="${state.jitterMs}" step="50" style="width:90%; background:#26262e; color:#fff; border:1px solid #444; border-radius:4px; padding:4px;" />
        </div>
      </div>

      <div style="display:grid; grid-template-columns:1fr 1fr; gap:8px; margin-bottom:8px;">
        <div>
          <label>Depth (1-20):</label>
          <input type="number" id="ap-depth" value="${state.depth}" min="1" max="20" style="width:90%; background:#26262e; color:#fff; border:1px solid #444; border-radius:4px; padding:4px;" />
        </div>
        <div>
          <label>ELO Limit:</label>
          <input type="number" id="ap-elo" value="${state.elo}" step="50" style="width:90%; background:#26262e; color:#fff; border:1px solid #444; border-radius:4px; padding:4px;" />
        </div>
      </div>

      <div style="font-size:11px; color:#888; text-align:center; margin-top:6px;">
        100% Standalone Userscript
      </div>
    `;

    document.body.appendChild(panel);

    // Bind UI Event Handlers
    document.getElementById('ap-toggle-btn').onclick = () => {
      state.active = !state.active;
      GM_setValue('ap_active', state.active);
      updateToggleButton();
    };

    document.getElementById('ap-game-type').onchange = (e) => {
      state.gameType = e.target.value;
      GM_setValue('ap_gameType', state.gameType);
    };

    document.getElementById('ap-match-limit').onchange = (e) => {
      state.matchLimit = e.target.value;
      GM_setValue('ap_matchLimit', state.matchLimit);
    };

    document.getElementById('ap-base-delay').onchange = (e) => {
      state.baseDelayMs = e.target.value;
      GM_setValue('ap_baseDelayMs', state.baseDelayMs);
    };

    document.getElementById('ap-jitter').onchange = (e) => {
      state.jitterMs = e.target.value;
      GM_setValue('ap_jitterMs', state.jitterMs);
    };

    document.getElementById('ap-depth').onchange = (e) => {
      state.depth = e.target.value;
      GM_setValue('ap_depth', state.depth);
    };

    document.getElementById('ap-elo').onchange = (e) => {
      state.elo = e.target.value;
      GM_setValue('ap_elo', state.elo);
      configureEngineOptions();
    };
  }

  function updateToggleButton() {
    const btn = document.getElementById('ap-toggle-btn');
    if (btn) {
      btn.innerText = state.active ? 'STOP AUTOPLAYER' : 'START AUTOPLAYER';
      btn.style.background = state.active ? '#f44336' : '#4caf50';
    }
  }

  function updateUIStatus(text, bg) {
    const badge = document.getElementById('ap-status-badge');
    if (badge) {
      badge.innerText = text;
      if (bg) badge.style.background = bg;
    }
  }

  // Immediate DOM readiness check & initialization
  function boot() {
    renderControlPanel();
    initEngine();
    setInterval(observeGameAndTriggerTurn, 500);
  }

  if (document.readyState === 'loading') {
    window.addEventListener('DOMContentLoaded', boot);
  } else {
    boot();
  }
})();
