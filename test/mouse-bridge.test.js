const test = require('node:test');
const assert = require('node:assert/strict');
const { EventEmitter } = require('node:events');
const { createBridge } = require('../server/mouse-bridge');

test('HTTP bridge authenticates, validates, and cancels moves', async t => {
  const key = 'a'.repeat(48); let launches = 0, killed = false;
  const server = createBridge(key, () => {
    launches++; const child = new EventEmitter(); child.stderr = new EventEmitter();
    child.kill = () => { killed = true; child.emit('close', null); }; return child;
  });
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  t.after(() => server.close());
  const url = `http://127.0.0.1:${server.address().port}`;
  const post = (route, body, token = key) => fetch(url + route, { method: 'POST', headers: { 'x-session-key': token, 'content-type': 'application/json' }, body: JSON.stringify(body) });
  assert.equal((await post('/status', {}, 'wrong')).status, 401);
  assert.deepEqual(await (await post('/status', {})).json(), { ready: true });
  assert.equal((await post('/move', { id: 'bad', geometry: [] })).status, 400);
  await post('/cancel', { id: 'early' });
  assert.equal((await post('/move', { id: 'early', speed: 'quick', geometry: Array(8).fill(1) })).status, 409);
  const move = post('/move', { id: 'one', speed: 'blitz', geometry: Array(8).fill(1) });
  while (!launches) await new Promise(resolve => setImmediate(resolve));
  assert.equal((await post('/cancel', { id: 'one' })).status, 200);
  assert.equal((await move).status, 500);
  assert.equal(killed, true);
});
