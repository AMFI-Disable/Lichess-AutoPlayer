'use strict';
const http = require('http');
const { randomBytes, timingSafeEqual } = require('crypto');
const { spawn } = require('child_process');
const path = require('path');

function createBridge(secret, launch = (geometry, speed) => spawn('/usr/bin/swift', [path.join(__dirname, 'click-helper.swift'), ...geometry.map(String), speed], { stdio: ['ignore', 'ignore', 'pipe'] })) {
  let active = null;
  const cancelled = new Map();
  return http.createServer((req, res) => {
    const reply = (status, data) => { if (!res.writableEnded && !res.destroyed) { res.writeHead(status, { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' }); res.end(JSON.stringify(data)); } };
    const supplied = Buffer.from(req.headers['x-session-key'] || '');
    const expected = Buffer.from(secret);
    if (supplied.length !== expected.length || !timingSafeEqual(supplied, expected)) return reply(401, { error: 'Invalid session key' });
    if (req.method !== 'POST' || !['/status', '/move', '/cancel'].includes(req.url)) return reply(404, { error: 'Unknown endpoint' });
    if (req.url === '/status') return reply(200, { ready: true });
    let raw = '';
    req.on('data', chunk => { raw += chunk; if (raw.length > 4096) req.destroy(); });
    req.on('end', () => {
      let body; try { body = JSON.parse(raw); } catch { return reply(400, { error: 'Invalid JSON' }); }
      if (req.url === '/cancel') {
        if (typeof body.id !== 'string' || body.id.length > 100) return reply(400, { error: 'Invalid request id' });
        cancelled.set(body.id, Date.now());
        if (active && body.id === active.id) active.child.kill();
        return reply(200, { cancelled: true });
      }
      for (const [id, at] of cancelled) if (Date.now() - at > 60000) cancelled.delete(id);
      if (cancelled.has(body.id)) return reply(409, { error: 'Move cancelled' });
      if (active) return reply(409, { error: 'A move is already in progress' });
      if (typeof body.id !== 'string' || body.id.length > 100 || !['bullet', 'blitz', 'rapid', 'quick'].includes(body.speed) || !Array.isArray(body.geometry) || body.geometry.length !== 8 || !body.geometry.every(Number.isFinite)) return reply(400, { error: 'Invalid move request' });
      let child; try { child = launch(body.geometry, body.speed); } catch { return reply(500, { error: 'Could not start mouse helper' }); }
      active = { id: body.id, child };
      let error = ''; child.stderr?.on('data', chunk => { error = (error + chunk.toString()).slice(0, 1000); });
      child.on('error', err => { error = err.message; });
      child.on('close', code => { if (active?.child === child) active = null; reply(code === 0 ? 200 : 500, { ok: code === 0, error: error.trim() }); });
      res.on('close', () => { if (!res.writableEnded && active?.child === child) child.kill(); });
    });
  });
}
if (require.main === module) {
  const secret = randomBytes(24).toString('hex');
  const server = createBridge(secret);
  server.listen(17349, '127.0.0.1', () => console.log(`Mouse bridge listening on 127.0.0.1:17349\nSession key: ${secret}\nPaste this key into the AutoPlayer panel. Press Ctrl+C to stop.`));
}
module.exports = { createBridge };
