const test = require('node:test');
const assert = require('node:assert/strict');
const http = require('http');
const app = require('../src/server');

let server;
let baseUrl;

test.before((t, done) => {
  // Escuchar en puerto efímero aleatorio para testing
  server = app.listen(0, '127.0.0.1', () => {
    const address = server.address();
    baseUrl = `http://127.0.0.1:${address.port}`;
    done();
  });
});

test.after((t, done) => {
  server.close(done);
});

test('Server - GET /api/health returns 200 OK', async () => {
  const res = await fetch(`${baseUrl}/api/health`);
  assert.equal(res.status, 200);
  const data = await res.json();
  assert.equal(data.status, 'ok');
  assert.equal(data.service, 'currency-pwa');
  assert.ok(typeof data.uptimeSeconds === 'number');
});

test('Server - GET /api/rates returns valid rates for COP, USD, PEN', async () => {
  const res = await fetch(`${baseUrl}/api/rates`);
  assert.equal(res.status, 200);
  const data = await res.json();
  assert.equal(data.success, true);
  assert.equal(data.base, 'USD');
  assert.ok(data.rates.USD === 1.0);
  assert.ok(typeof data.rates.COP === 'number' && data.rates.COP > 0);
  assert.ok(typeof data.rates.PEN === 'number' && data.rates.PEN > 0);
  assert.ok(data.source);
});

test('Server - Serves PWA index.html', async () => {
  const res = await fetch(`${baseUrl}/`);
  assert.equal(res.status, 200);
  const html = await res.text();
  assert.ok(html.includes('Conversor de Divisas'));
  assert.ok(html.includes('COP ⇄ USD ⇄ PEN'));
});

test('Server - Serves manifest.json with correct content type', async () => {
  const res = await fetch(`${baseUrl}/manifest.json`);
  assert.equal(res.status, 200);
  const json = await res.json();
  assert.equal(json.short_name, 'Conversor');
  assert.equal(json.display, 'standalone');
});

test('Server - Serves sw.js with Service-Worker-Allowed header', async () => {
  const res = await fetch(`${baseUrl}/sw.js`);
  assert.equal(res.status, 200);
  assert.equal(res.headers.get('service-worker-allowed'), '/');
});
