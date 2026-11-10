// ==UserScript==
// @name         Lichess AutoPlayer
// @namespace    https://github.com/amfi-disable/Lichess-AutoPlayer
// @version      2.7.0
// @description  Configurable chess automation for bot testing
// @icon         https://lichess.org/favicon.ico
// @match        https://lichess.org/*
// @grant        GM_setValue
// @grant        GM_getValue
// @grant        GM_xmlhttpRequest
// @connect      cdnjs.cloudflare.com
// @connect      127.0.0.1
// @connect      lichess.org
// @require      https://cdnjs.cloudflare.com/ajax/libs/chess.js/0.10.3/chess.min.js
// @run-at       document-idle
// ==/UserScript==

(function () {
  'use strict';

  const DEFAULTS = { time: '3+0', limit: '1', strength: 1500, autoAnalysis: true };
  const TIMES = ['1+0', '3+0', '5+3', '10+0'];
  const LIMITS = ['1', '5', '10', 'infinite'];
  const ENGINE_URL = 'https://cdnjs.cloudflare.com/ajax/libs/stockfish.js/10.0.2/';

  function normalizeSettings(value) {
    value = value || {};
    const legacy = { casual: 1000, club: 1500, strong: 2500 };
    const rating = Number(legacy[value.strength] || value.strength);
    return {
      time: TIMES.includes(value.time) ? value.time : DEFAULTS.time,
      limit: LIMITS.includes(String(value.limit)) ? String(value.limit) : DEFAULTS.limit,
      strength: Number.isFinite(rating) && rating >= 1000 && rating <= 3000 ? Math.round(rating / 250) * 250 : DEFAULTS.strength,
      autoAnalysis: typeof value.autoAnalysis === 'boolean' ? value.autoAnalysis : true
    };
  }
  function skillFor(rating) { return Math.round((rating - 1000) / 100); }
  function parseClock(text) {
    const match = /^\s*(\d{1,3}):(\d{2})(?:[.,](\d{1,2}))?\s*$/.exec(text || '');
    if (!match || Number(match[2]) >= 60) return null;
    return (Number(match[1]) * 60 + Number(match[2]) + Number('0.' + (match[3] || '0'))) * 1000;
  }
  function moveBudget(remaining) {
    if (remaining === null) return { search: 500, delay: 150 };
    const available = Math.max(0, remaining - 1200);
    return { search: Math.max(50, Math.min(2000, Math.floor(available / 35))), delay: remaining > 15000 ? 250 : remaining > 5000 ? 100 : 0 };
  }
  function mouseSpeed(timeControl, remaining) {
    if (remaining !== null && remaining < 15000) return 'quick';
    if (timeControl === '1+0') return 'bullet';
    if (timeControl === '10+0') return 'rapid';
    return 'blitz';
  }
  function parseVariation(line) {
    if (!line.startsWith('info ') || /\b(?:lowerbound|upperbound)\b/.test(line)) return null;
    const depth = /\bdepth (\d+)/.exec(line), rank = /\bmultipv (\d+)/.exec(line);
    const score = /\bscore cp (-?\d+)/.exec(line), pv = /\bpv ([a-h][1-8][a-h][1-8][qrbn]?)(?:\s|$)/.exec(line);
    if (!depth || !rank || !score || !pv) return null;
    return { depth: Number(depth[1]), rank: Number(rank[1]), score: Number(score[1]), move: pv[1] };
  }
  function chooseVariation(best, legal, variations, random = Math.random) {
    if (random() >= 0.25) return best;
    const top = variations.find(v => v.rank === 1 && v.move === best);
    if (!top) return best;
    const tolerance = top.score >= 300 ? 150 : 75;
    const floor = top.score >= 150 ? 75 : -Infinity;
    const candidates = variations.filter(v => v.depth === top.depth && v.rank > 1 && v.move !== best && legal.includes(v.move) && v.score <= top.score && v.score >= top.score - tolerance && v.score >= floor);
    return candidates.length ? candidates[Math.floor(random() * candidates.length)].move : best;
  }
  function gameOutcome(result, color) {
    if (result === '1-0') return color === 'w' ? 'Win' : 'Loss';
    if (result === '0-1') return color === 'b' ? 'Win' : 'Loss';
    return /^(½-½|1\/2-1\/2)$/.test(result) ? 'Draw' : 'Other';
  }
  function analysisCounts(data, color) {
    const a = data?.players?.[color === 'w' ? 'white' : 'black']?.analysis;
    return a && ['inaccuracy', 'mistake', 'blunder'].every(k => Number.isInteger(a[k]) && a[k] >= 0)
      ? { inaccuracy: a.inaccuracy, mistake: a.mistake, blunder: a.blunder } : null;
  }
  function squarePosition(square, rect, flipped) {
    const file = square.charCodeAt(0) - 97, rank = Number(square[1]) - 1;
    return { x: rect.left + ((flipped ? 7 - file : file) + 0.5) * rect.width / 8,
      y: rect.top + ((flipped ? rank : 7 - rank) + 0.5) * rect.height / 8 };
  }
  function sameGeometry(a, b) {
    return !!a && !!b && ['left', 'top', 'width', 'height', 'screenX', 'screenY', 'outerWidth', 'outerHeight'].every(key => Math.abs(a[key] - b[key]) < 1);
  }
  function gameIdFromPath(path) {
    return /^\/(?:game\/)?([a-zA-Z0-9]{12})(?:\/(?:white|black))?\/?$/.exec(path)?.[1] || null;
  }
  function parseMoves(sans, ChessClass) {
    if (typeof ChessClass !== 'function') throw new Error('Chess library failed to load');
    const chess = new ChessClass();
    for (const san of sans) {
      if (!chess.move(san.replace(/[!?+#]/g, ''), { sloppy: true })) throw new Error('Could not read game moves');
    }
    return chess;
  }
  if (typeof module !== 'undefined' && module.exports) {
    module.exports = { normalizeSettings, skillFor, parseClock, moveBudget, mouseSpeed, parseVariation, chooseVariation, gameOutcome, analysisCounts, squarePosition, sameGeometry, parseMoves, gameIdFromPath };
    return;
  }

  const savedSession = (() => { try { return JSON.parse(sessionStorage.getItem('ap_session') || '{}'); } catch { return {}; } })();
  const app = {
    settings: normalizeSettings(GM_getValue('ap_settings', {})), active: false,
    worker: null, ready: false, epoch: 0, timer: null, timeout: null, game: null,
    finished: new Set(savedSession.finished || []), played: savedSession.played || 0, draining: false, pending: null, lastPosition: null, pairing: null, bridge: null, bridgeReady: false, analysisJob: null, stopAfter: !!savedSession.stopAfter
  };
  const ui = {
    status(message, error = false) {
      const node = document.getElementById('ap-status');
      if (node) { node.textContent = message; node.classList.toggle('error', error); }
    },
    render() {
      const panel = document.createElement('section');
      panel.id = 'ap-panel';
      panel.innerHTML = `<style>
        #ap-panel{position:fixed;right:1rem;bottom:1rem;z-index:10000;width:min(19rem,calc(100vw - 2rem));box-sizing:border-box;padding:1rem;background:var(--c-bg-box,#312e2b);color:var(--c-font,#bababa);border:1px solid var(--c-border,#494743);box-shadow:0 3px 12px #0006;font:14px system-ui,sans-serif}
        #ap-panel *{box-sizing:border-box}#ap-panel h2{font-size:1rem;margin:0 0 .7rem;color:var(--c-font-clear,#eee)}#ap-panel label{display:block;margin:.5rem 0 .2rem}#ap-panel select,#ap-panel button{width:100%;padding:.5rem;background:var(--c-bg-input,#262421);color:inherit;border:1px solid var(--c-border,#555)}#ap-panel button{margin-top:.8rem;background:#769656;color:white;cursor:pointer;font-weight:bold}#ap-panel button[data-active=true]{background:#a04438}#ap-status{margin:.7rem 0 0;font-size:.85rem}#ap-status.error{color:#e88}#ap-panel small{display:block;margin-top:.5rem;opacity:.8}#ap-panel details{margin-top:.5rem}#ap-panel summary{cursor:pointer}#ap-panel .secondary{background:var(--c-bg-input,#262421);color:inherit}#ap-panel .ap-history-row{padding:.3rem 0;border-top:1px solid var(--c-border,#555);font-size:.8rem}
      </style><h2>AutoPlayer · Bot <small style="display:inline">v2.7.0</small></h2>
      <details id="ap-settings" open><summary>Controls</summary><label for="ap-time">Time control</label><select id="ap-time">${TIMES.map(x => `<option>${x}</option>`).join('')}</select>
      <label for="ap-limit">Games</label><select id="ap-limit"><option value="1">1 game</option><option value="5">5 games</option><option value="10">10 games</option><option value="infinite">Unlimited</option></select>
      <label for="ap-strength">Approximate strength: <output id="ap-strength-value"></output></label><input id="ap-strength" type="range" min="1000" max="3000" step="250" style="width:100%">
      <label><input type="checkbox" id="ap-autoAnalysis"> Analyze finished games before continuing</label><label for="ap-key">Desktop session key</label><input id="ap-key" type="password" autocomplete="off" placeholder="Paste key from CLI" style="width:100%;padding:.5rem;background:var(--c-bg-input,#262421);color:inherit;border:1px solid var(--c-border,#555)">
      </details><button id="ap-toggle" type="button">Start</button><button id="ap-stop-after" class="secondary" type="button" hidden>Stop after this game</button><details id="ap-history"><summary>Recent games</summary><div id="ap-history-list"></div><button id="ap-refresh" class="secondary" type="button">Refresh analysis</button></details><p id="ap-status" role="status" aria-live="polite">Stopped</p><small>Automated play · bot testing</small>`;
      document.body.appendChild(panel);
      for (const key of ['time', 'limit', 'strength']) {
        const input = panel.querySelector(`#ap-${key}`); input.value = app.settings[key];
        input.addEventListener(key === 'strength' ? 'input' : 'change', () => { app.settings[key] = key === 'strength' ? Number(input.value) : input.value; if (key === 'strength') panel.querySelector('#ap-strength-value').textContent = `~${input.value}`; GM_setValue('ap_settings', app.settings); });
        if (key === 'strength') panel.querySelector('#ap-strength-value').textContent = `~${input.value}`;
      }
      const analysisInput = panel.querySelector('#ap-autoAnalysis');
      analysisInput.checked = app.settings.autoAnalysis;
      analysisInput.addEventListener('change', () => { app.settings.autoAnalysis = analysisInput.checked; GM_setValue('ap_settings', app.settings); });
      const keyInput = panel.querySelector('#ap-key');
      keyInput.value = GM_getValue('ap_session_key', '');
      keyInput.addEventListener('input', () => GM_setValue('ap_session_key', keyInput.value.trim()));
      panel.querySelector('#ap-toggle').addEventListener('click', () => app.active ? stop('Stopped') : start());
      panel.querySelector('#ap-stop-after').addEventListener('click', () => {
        const game = readGame();
        if (!game || game.ended) return stop('Matchmaking stopped');
        app.stopAfter = true; saveSession(true); ui.update(); ui.status('Will stop after this game');
      });
      panel.querySelector('#ap-history').addEventListener('toggle', event => { if (event.target.open) { renderHistory(); refreshHistory(); } });
      panel.querySelector('#ap-refresh').addEventListener('click', refreshHistory);
      renderHistory();
    },
    update() {
      const btn = document.getElementById('ap-toggle');
      btn.textContent = app.active ? 'Stop bot now' : 'Start'; btn.dataset.active = String(app.active);
      const later = document.getElementById('ap-stop-after'); later.hidden = !app.active; later.disabled = app.stopAfter; later.textContent = app.stopAfter ? 'Stopping after this game' : 'Stop after this game';
      for (const key of ['time', 'limit', 'strength', 'key', 'autoAnalysis']) document.getElementById(`ap-${key}`).disabled = app.active;
    }
  };
  function saveSession(active) {
    sessionStorage.setItem('ap_session', JSON.stringify({ active, played: app.played, finished: Array.from(app.finished), stopAfter: app.stopAfter }));
  }
  function invalidate() {
    app.epoch++; clearTimeout(app.timer); app.timer = null;
    if (app.bridgeReady && app.pending?.id) bridgeRequest('/cancel', { id: app.pending.id }, () => {});
    if (app.pending?.phase === 'search' && app.worker && app.ready) {
      app.draining = true; app.worker.postMessage('stop');
      app.timeout = setTimeout(() => { if (app.active && app.draining) stop('Engine did not stop. Press Start to retry.', true); }, 5000);
    }
    app.pending = null;
  }
  function stop(message, error = false) {
    app.active = false; app.stopAfter = false; app.analysisJob = null; saveSession(false); invalidate(); clearTimeout(app.timeout);
    const activePool = document.querySelector('.lpool.active[data-id]');
    if (activePool && app.pairing) activePool.click();
    app.pairing = null;
    if (app.worker) { app.worker.terminate(); app.worker = null; }
    app.ready = false; app.draining = false; clearTimeout(app.bridgeTimeout); app.bridge = null; app.bridgeReady = false; ui.update(); ui.status(message, error);
  }
  function bridgeRequest(route, data, done) {
    GM_xmlhttpRequest({ method: 'POST', url: `http://127.0.0.1:17349${route}`,
      headers: { 'Content-Type': 'application/json', 'X-Session-Key': GM_getValue('ap_session_key', '') },
      data: JSON.stringify(data), timeout: 12000,
      onload: response => { let body = {}; try { body = JSON.parse(response.responseText); } catch {} done(response.status === 200 ? null : (body.error || `HTTP ${response.status}`), body); },
      onerror: () => done('Connection failed'), ontimeout: () => done('Connection timed out')
    });
  }
  function start(resume = false) {
    const key = document.getElementById('ap-key').value;
    if (!/^[a-f0-9]{48}$/.test(key)) { ui.status('Enter the desktop session key first.', true); return; }
    GM_setValue('ap_session_key', key);
    app.active = true; if (!resume) { app.played = 0; app.finished.clear(); app.stopAfter = false; } saveSession(true); app.game = null;
    app.lastPosition = null; app.pairing = null; ui.update(); ui.status('Connecting to engine…');
    const epoch = ++app.epoch;
    bridgeRequest('/status', {}, (error) => {
      if (!app.active || app.epoch !== epoch) return;
      if (error) return stop(`Desktop helper: ${error}`, true);
      app.bridgeReady = true;
    });
    app.timeout = setTimeout(() => { if (app.active && !app.ready && app.epoch === epoch) stop('Engine timed out. Press Start to retry.', true); }, 20000);
    GM_xmlhttpRequest({ method: 'GET', url: ENGINE_URL + 'stockfish.js',
      onload(response) {
        if (!app.active || app.epoch !== epoch) return;
        if (response.status !== 200) return stop(`Engine download failed (${response.status}). Press Start to retry.`, true);
        try {
          // Stockfish's worker resolves its wasm relative to its own blob URL otherwise.
          const code = response.responseText.replace('locateFile:function(file){return file}', `locateFile:function(file){return '${ENGINE_URL}'+file}`);
          const url = URL.createObjectURL(new Blob([code], { type: 'application/javascript' }));
          const worker = new Worker(url); URL.revokeObjectURL(url); app.worker = worker;
          worker.onerror = () => stop('Engine worker failed. Press Start to retry.', true);
          worker.onmessage = event => engineMessage(String(event.data));
          worker.postMessage('uci');
        } catch (error) { stop(`Engine failed: ${error.message}`, true); }
      }, onerror() { if (app.active && app.epoch === epoch) stop('Engine download failed. Press Start to retry.', true); }
    });
  }
  function engineMessage(line) {
    if (!app.active) return;
    if (line.trim() === 'uciok' && !app.ready) {
      app.worker.postMessage(`setoption name Skill Level value ${skillFor(app.settings.strength)}`);
      app.worker.postMessage('setoption name MultiPV value 3');
      app.worker.postMessage('isready');
    } else if (line.trim() === 'readyok' && !app.ready) {
      app.ready = true; clearTimeout(app.timeout); ui.status('Engine connected');
    } else if (line.startsWith('info ') && app.pending?.phase === 'search' && !app.draining) {
      const variation = parseVariation(line);
      if (variation && variation.rank <= 3) {
        const all = app.pending.variations;
        if (!all[variation.depth]) all[variation.depth] = {};
        all[variation.depth][variation.rank] = variation;
      }
    } else if (line.startsWith('bestmove ') && app.draining) {
      app.draining = false; clearTimeout(app.timeout);
    } else if (line.startsWith('bestmove ') && app.pending && app.pending.phase === 'search') {
      clearTimeout(app.timer);
      const pending = app.pending, match = /^bestmove\s+([a-h][1-8][a-h][1-8][qrbn]?)/.exec(line);
      if (!match || !pending.legal.includes(match[1])) return stop('Engine returned an invalid move.', true);
      pending.phase = 'delay';
      const groups = Object.values(pending.variations).filter(group => group[1]?.move === match[1]);
      groups.sort((a, b) => b[1].depth - a[1].depth);
      const move = chooseVariation(match[1], pending.legal, groups.length ? Object.values(groups[0]) : []);
      ui.status('Move calculated');
      const submitWhenFocused = () => {
        if (!app.active || app.pending !== pending || app.epoch !== pending.epoch) return;
        const current = readGame();
        if (!current || current.key !== pending.key) return invalidate();
        if (!app.bridgeReady) return stop('Desktop helper disconnected. Restart the helper and reconnect.', true);
        if (!document.hasFocus()) {
          ui.status('Waiting for the game tab to gain focus…');
          app.timer = setTimeout(submitWhenFocused, 500);
          return;
        }
        pending.phase = 'submitted';
        if (move.length === 5) return stop('Promotion requires manual play; automation stopped.', true);
        const rect = current.board.getBoundingClientRect();
        pending.geometry = boardGeometry(current.board);
        const flipped = !!current.board.closest('.cg-wrap')?.classList.contains('orientation-black');
        const from = squarePosition(move.slice(0, 2), rect, flipped), to = squarePosition(move.slice(2, 4), rect, flipped);
        const offsetX = window.screenX + (window.outerWidth - window.innerWidth) / 2;
        const offsetY = window.screenY + window.outerHeight - window.innerHeight;
        pending.id = `${pending.epoch}-${Date.now()}`;
        bridgeRequest('/move', { id: pending.id, speed: mouseSpeed(app.settings.time, readClock()), geometry: [window.screenX, window.screenY, window.outerWidth, window.outerHeight, offsetX + from.x, offsetY + from.y, offsetX + to.x, offsetY + to.y] }, error => { if (error && app.active && app.pending === pending) stop(`Desktop helper: ${error}`, true); });
        ui.status('Waiting for move confirmation…');
        app.timer = setTimeout(() => { if (app.pending === pending) stop('Move was not confirmed by Lichess. Check the game and connection.', true); }, 5000);
      };
      app.timer = setTimeout(submitWhenFocused, moveBudget(readClock()).delay);
    }
  }
  function boardGeometry(board) {
    const rect = board.getBoundingClientRect();
    return { left: rect.left, top: rect.top, width: rect.width, height: rect.height, screenX: window.screenX, screenY: window.screenY, outerWidth: window.outerWidth, outerHeight: window.outerHeight };
  }
  function readClock() {
    const clock = document.querySelector('.round__app .rclock-bottom .time, .round__app .rclock-bottom .rclock__time');
    return parseClock(clock?.textContent);
  }
  function readGame() {
    const id = gameIdFromPath(location.pathname);
    const board = document.querySelector('.round__app cg-board');
    if (!id || !board) return null;
    const sans = Array.from(document.querySelectorAll('.round__app z7yx, .round__app kwdb, .round__app .moves move'))
      .map(el => el.childNodes[0]?.textContent.trim()).filter(x => x && x !== '…');
    const ChessClass = typeof Chess === 'function' ? Chess : window.Chess;
    const chess = parseMoves(sans, ChessClass);
    const wrap = board.closest('.cg-wrap');
    const color = wrap?.classList.contains('orientation-black') ? 'b' : 'w';
    const ended = !!document.querySelector('.round__app .result-wrap, .round__app .result');
    const result = document.querySelector('.round__app .result-wrap .result, .round__app .result')?.textContent.trim() || '';
    return { id, board, chess, color, ended, result, key: id + ':' + chess.fen() };
  }
  function getHistory() {
    const history = GM_getValue('ap_history', []);
    return Array.isArray(history) ? history.filter(x => x && /^[a-zA-Z0-9]{8}$/.test(x.id)).slice(0, 10) : [];
  }
  function recordGame(game) {
    const id = game.id.slice(0, 8);
    const outcome = gameOutcome(game.result, game.color);
    GM_setValue('ap_history', [{ id, color: game.color, outcome, analysis: null }, ...getHistory().filter(x => x.id !== id)].slice(0, 10));
    renderHistory();
  }
  function renderHistory() {
    const root = document.getElementById('ap-history-list'); if (!root) return;
    root.replaceChildren(); const games = getHistory();
    const total = document.createElement('div');
    total.textContent = games.length ? `${games.filter(x => x.outcome === 'Win').length} wins · ${games.length} games` : 'No recorded games'; root.appendChild(total);
    const analyzed = games.filter(x => x.analysis);
    if (analyzed.length) {
      const summary = document.createElement('div');
      const sum = key => analyzed.reduce((count, game) => count + game.analysis[key], 0);
      summary.textContent = `I ${sum('inaccuracy')} · M ${sum('mistake')} · B ${sum('blunder')} (${analyzed.length}/${games.length} analyzed)`;
      root.appendChild(summary);
    }
    for (const game of games) {
      const row = document.createElement('div'); row.className = 'ap-history-row';
      const link = document.createElement('a'); link.href = `https://lichess.org/${game.id}`; link.target = '_blank'; link.rel = 'noopener noreferrer'; link.textContent = `${game.outcome} · ${game.id}`; row.appendChild(link);
      const counts = document.createElement('div'); const a = game.analysis;
      counts.textContent = a ? `Inaccuracies ${a.inaccuracy} · Mistakes ${a.mistake} · Blunders ${a.blunder}` : 'Analysis unavailable';
      row.appendChild(counts); root.appendChild(row);
    }
  }
  let refreshingHistory = false;
  function refreshHistory() {
    if (refreshingHistory) return;
    const queue = getHistory().filter(x => !x.analysis); refreshingHistory = true;
    const next = () => {
      const game = queue.shift(); if (!game) { refreshingHistory = false; renderHistory(); return; }
      GM_xmlhttpRequest({ method: 'GET', url: `https://lichess.org/game/export/${game.id}?analysed=true`, headers: { Accept: 'application/json' }, timeout: 10000,
        onload(response) {
          try {
            const data = JSON.parse(response.responseText); const a = analysisCounts(data, game.color);
            if (response.status === 200 && a) {
              const history = getHistory(); const saved = history.find(x => x.id === game.id);
              if (saved) { saved.analysis = a; GM_setValue('ap_history', history); }
            }
          } catch {}
          if (response.status === 429) { refreshingHistory = false; renderHistory(); return; }
          setTimeout(next, 500);
        }, onerror() { setTimeout(next, 500); }, ontimeout() { setTimeout(next, 500); }
      });
    };
    next();
  }
  function finishGame(game) {
    const shouldStop = app.stopAfter || (app.settings.limit !== 'infinite' && app.played >= Number(app.settings.limit));
    const finish = () => {
      app.analysisJob = null;
      if (shouldStop) return stop(app.stopAfter ? 'Game finished; matchmaking stopped' : 'Game limit reached');
      ui.status('Game finished · returning to lobby'); location.assign('/');
    };
    if (!app.settings.autoAnalysis) return finish();
    const job = { id: game.id.slice(0, 8), started: Date.now() }; app.analysisJob = job;
    const fail = message => { if (app.analysisJob === job && app.active) stop(message, true); };
    const poll = () => {
      if (!app.active || app.analysisJob !== job) return;
      if (Date.now() - job.started > 90000) return fail('Analysis timed out. Refresh analysis later.');
      GM_xmlhttpRequest({ method: 'GET', url: `https://lichess.org/game/export/${job.id}?analysed=true`, headers: { Accept: 'application/json' }, timeout: 10000,
        onload(response) {
          if (!app.active || app.analysisJob !== job) return;
          if (response.status === 429) return fail('Analysis rate limited. Wait a minute before retrying.');
          if (response.status === 200) {
            try {
              const counts = analysisCounts(JSON.parse(response.responseText), game.color);
              if (counts) {
                const history = getHistory(); const item = history.find(x => x.id === job.id);
                if (item) { item.analysis = counts; GM_setValue('ap_history', history); renderHistory(); }
                return finish();
              }
            } catch {}
          }
          setTimeout(poll, 3000);
        }, onerror() { if (app.analysisJob === job) setTimeout(poll, 3000); }, ontimeout() { if (app.analysisJob === job) setTimeout(poll, 3000); }
      });
    };
    ui.status('Requesting game analysis…');
    fetch(`/game/${job.id}/request-analysis`, { method: 'POST', credentials: 'same-origin', headers: { 'X-Requested-With': 'XMLHttpRequest' } })
      .then(async response => {
        if (!app.active || app.analysisJob !== job) return;
        if (response.status === 429) return fail('Analysis rate limited. Wait a minute before retrying.');
        const message = response.ok ? '' : await response.text();
        if (!response.ok && !/already analy[sz]/i.test(message)) return fail(`Analysis request failed (${response.status}).`);
        ui.status('Waiting for game analysis…'); poll();
      }).catch(() => fail('Could not request game analysis.'));
  }
  function pairingTick(now) {
    if (location.pathname !== '/') { ui.status('Open the Lichess lobby to pair'); return; }
    const pool = Array.from(document.querySelectorAll('.lpool[data-id]')).find(el => el.querySelector('.clock')?.textContent.trim() === app.settings.time);
    if (!pool) return stop(`Quick pairing ${app.settings.time} is unavailable.`, true);
    if (pool.classList.contains('active')) { app.pairing = { attempts: 0, at: now }; ui.status(`Searching · ${app.settings.time}`); return; }
    if (app.pairing && now - app.pairing.at < 5000) return;
    const attempts = (app.pairing?.attempts || 0) + 1;
    if (attempts > 3) return stop('Pairing was not confirmed. Check the lobby and retry.', true);
    app.pairing = { attempts, at: now }; pool.click(); ui.status(`Starting pairing · ${app.settings.time}`);
  }
  function tick() {
    if (!app.active || !app.ready || !app.bridgeReady || app.analysisJob) return;
    try {
      const game = readGame();
      if (!game) { if (app.game) { invalidate(); app.game = null; } pairingTick(Date.now()); return; }
      if (app.game !== game.id) { invalidate(); app.game = game.id; app.lastPosition = null; app.pairing = null; app.worker.postMessage('ucinewgame'); }
      if (game.ended) {
        invalidate();
        if (!app.finished.has(game.id)) { app.finished.add(game.id); app.played++; recordGame(game); saveSession(true); }
        finishGame(game); return;
      }
      if (app.pending && app.pending.key !== game.key) invalidate();
      if (app.pending?.phase === 'search' && !app.pending.stopRequested) {
        const remaining = readClock();
        if (remaining !== null && remaining <= 1500) { app.pending.stopRequested = true; app.worker.postMessage('stop'); }
      }
      if (app.draining || app.pending || game.chess.turn() !== game.color || app.lastPosition === game.key) return;
      const legal = game.chess.moves({ verbose: true }).map(m => m.from + m.to + (m.promotion || ''));
      if (!legal.length) return;
      app.lastPosition = game.key;
      app.pending = { key: game.key, epoch: app.epoch, phase: 'search', legal, variations: {} };
      ui.status('Thinking…');
      app.worker.postMessage(`position fen ${game.chess.fen()}`);
      const remaining = readClock();
      const budget = moveBudget(remaining);
      if (remaining === null) ui.status('Thinking… clock unavailable');
      app.worker.postMessage(`go movetime ${budget.search}`);
      app.timer = setTimeout(() => { if (app.pending?.phase === 'search') stop('Engine search timed out.', true); }, 30000);
    } catch (error) { stop(`${error.message}. Check the game and retry.`, true); }
  }
  ui.render(); if (savedSession.active) {
    const key = GM_getValue('ap_session_key', '');
    if (key) { document.getElementById('ap-key').value = key; start(true); }
    else { saveSession(false); ui.status('Re-enter the desktop session key to resume.'); }
  }
  window.addEventListener('blur', () => { if (app.active && app.pending?.phase === 'submitted') stop('Game window lost focus before the move was confirmed.', true); });
  for (const event of ['resize', 'scroll']) window.addEventListener(event, () => {
    if (!app.active || app.pending?.phase !== 'submitted') return;
    const board = document.querySelector('.round__app cg-board');
    if (!board || !sameGeometry(app.pending.geometry, boardGeometry(board))) stop('Board geometry changed.', true);
  }, true);
  setInterval(tick, 500);
})();
