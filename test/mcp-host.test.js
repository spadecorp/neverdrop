const test = require('node:test');
const assert = require('node:assert/strict');
const { EventEmitter } = require('node:events');
const { PassThrough } = require('node:stream');
const { McpHost } = require('../electron/mcp/host');

function fakeServerProcess() {
  const proc = new EventEmitter();
  proc.stdin = new PassThrough();
  proc.stdout = new PassThrough();
  proc.stderr = new PassThrough();
  proc.exitCode = null;
  proc.killed = false;
  proc.kill = function () { this.killed = true; this.exitCode = 0; return true; };
  return proc;
}

test('MCP request resolves from its matching JSON-RPC response', async () => {
  const host = new McpHost();
  const proc = fakeServerProcess();
  const server = { process: proc, tools: [], pending: new Map(), buffer: '', connected: true };
  host.servers.set('test', server);
  proc.stdin.on('data', (chunk) => {
    const request = JSON.parse(chunk.toString());
    const pending = server.pending.get(request.id);
    if (pending) {
      server.pending.delete(request.id);
      clearTimeout(pending.timer);
      pending.resolve({ pong: true });
    }
  });
  const result = await host._send('test', 'ping', {});
  assert.deepEqual(result, { pong: true });
  assert.equal(server.pending.size, 0);
});

test('disconnect rejects in-flight MCP requests and clears pending state', async () => {
  const host = new McpHost();
  const proc = fakeServerProcess();
  const server = { process: proc, tools: [], pending: new Map(), buffer: '', connected: true };
  host.servers.set('test', server);
  const request = host._send('test', 'slow/request', {});
  await host.disconnect('test');
  await assert.rejects(request, /disconnected/i);
  assert.equal(server.pending.size, 0);
  assert.equal(host.servers.has('test'), false);
});
