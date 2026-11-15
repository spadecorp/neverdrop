const { spawn } = require('child_process');

const REQUEST_TIMEOUT_MS = 15000;
const MAX_STDOUT_BUFFER = 8 * 1024 * 1024;

class McpHost {
  constructor() {
    this.servers = new Map();
    this.nextRequestId = 1;
  }

  async connect(id, command, args = [], env = {}) {
    await this.disconnect(id);

    return new Promise((resolve, reject) => {
      let settled = false;
      const proc = spawn(command, args, {
        env: { ...process.env, ...env },
        stdio: ['pipe', 'pipe', 'pipe'],
        windowsHide: true,
      });
      const server = {
        process: proc,
        tools: [],
        pending: new Map(),
        buffer: '',
        connected: false,
      };
      this.servers.set(id, server);

      const fail = (error) => {
        if (!settled) {
          settled = true;
          reject(error instanceof Error ? error : new Error(String(error)));
        }
        this._rejectPending(server, error instanceof Error ? error : new Error(String(error)));
        if (this.servers.get(id) === server) this.servers.delete(id);
      };

      proc.stderr.on('data', (data) => {
        const message = data.toString().slice(0, 4000).trim();
        if (message) console.warn(`[mcp:${id}] ${message}`);
      });

      proc.stdout.on('data', (data) => {
        server.buffer += data.toString('utf8');
        if (server.buffer.length > MAX_STDOUT_BUFFER) {
          fail(new Error('MCP server exceeded the maximum unprocessed output buffer.'));
          proc.kill();
          return;
        }
        const lines = server.buffer.split('\n');
        server.buffer = lines.pop();
        for (const line of lines) {
          if (!line.trim()) continue;
          let message;
          try {
            message = JSON.parse(line);
          } catch {
            console.warn(`[mcp:${id}] Ignoring malformed JSON-RPC output.`);
            continue;
          }
          if (message.id === undefined || !server.pending.has(message.id)) continue;
          const pending = server.pending.get(message.id);
          server.pending.delete(message.id);
          clearTimeout(pending.timer);
          if (message.error) pending.reject(new Error(message.error.message || 'MCP request failed'));
          else pending.resolve(message.result);
        }
      });

      proc.on('error', (error) => fail(error));
      proc.on('exit', (code, signal) => {
        fail(new Error(`MCP server exited (code ${code ?? 'unknown'}, signal ${signal ?? 'none'}).`));
      });
      proc.stdin.on('error', (error) => fail(error));

      this._send(id, 'initialize', {
        protocolVersion: '2024-11-05',
        capabilities: {},
        clientInfo: { name: 'neverdrop', version: '1.1.0' },
      })
        .then(() => {
          this._notify(id, 'notifications/initialized', {});
          return this._send(id, 'tools/list', {});
        })
        .then((result) => {
          if (settled || this.servers.get(id) !== server) return;
          server.tools = (result?.tools || []).map((tool) => tool.name).filter(Boolean);
          server.connected = true;
          settled = true;
          resolve({ ok: true, tools: server.tools });
        })
        .catch((error) => {
          fail(error);
          if (proc.exitCode === null) proc.kill();
        });
    });
  }

  async disconnect(id) {
    const server = this.servers.get(id);
    if (!server) return;
    this.servers.delete(id);
    server.connected = false;
    this._rejectPending(server, new Error('MCP server disconnected.'));
    if (server.process.exitCode === null && !server.process.killed) {
      server.process.kill('SIGTERM');
      const killTimer = setTimeout(() => {
        if (server.process.exitCode === null) server.process.kill('SIGKILL');
      }, 2000);
      killTimer.unref?.();
    }
  }

  async disconnectAll() {
    await Promise.all([...this.servers.keys()].map((id) => this.disconnect(id)));
  }

  _rejectPending(server, error) {
    for (const pending of server.pending.values()) {
      clearTimeout(pending.timer);
      pending.reject(error);
    }
    server.pending.clear();
  }

  _notify(id, method, params) {
    const server = this.servers.get(id);
    if (!server || server.process.stdin.destroyed) return;
    server.process.stdin.write(`${JSON.stringify({ jsonrpc: '2.0', method, params })}\n`);
  }

  _send(id, method, params) {
    const server = this.servers.get(id);
    if (!server || server.process.stdin.destroyed || !server.process.stdin.writable) {
      return Promise.reject(new Error('MCP server is not available.'));
    }
    const requestId = this.nextRequestId++;
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        if (!server.pending.has(requestId)) return;
        server.pending.delete(requestId);
        reject(new Error(`MCP request timed out: ${method}`));
      }, REQUEST_TIMEOUT_MS);
      server.pending.set(requestId, { resolve, reject, timer });
      const payload = `${JSON.stringify({ jsonrpc: '2.0', id: requestId, method, params })}\n`;
      server.process.stdin.write(payload, (error) => {
        if (!error) return;
        const pending = server.pending.get(requestId);
        if (!pending) return;
        server.pending.delete(requestId);
        clearTimeout(pending.timer);
        reject(error);
      });
    });
  }

  async callTool(id, toolName, args) {
    const server = this.servers.get(id);
    if (!server?.connected) throw new Error('MCP server is not connected.');
    if (!server.tools.includes(toolName)) throw new Error(`MCP tool is not available: ${toolName}`);
    return this._send(id, 'tools/call', { name: toolName, arguments: args || {} });
  }

  async buildContext(query, serverIds) {
    const parts = [];
    for (const id of serverIds) {
      const server = this.servers.get(id);
      if (!server?.connected) continue;
      const tool = server.tools.includes('search_history') ? 'search_history'
        : server.tools.includes('search') ? 'search'
        : server.tools[0];
      if (!tool) continue;
      try {
        const result = await this.callTool(id, tool, { query, limit: 5 });
        const content = result?.content?.[0]?.text || JSON.stringify(result);
        if (content) parts.push(`[${id}:${tool}]\n${content}`);
      } catch (error) {
        console.warn(`[mcp:${id}] Context lookup failed:`, error.message);
      }
    }
    return parts.join('\n\n---\n\n');
  }

  getStatus(id) {
    const server = this.servers.get(id);
    return server ? { connected: server.connected, tools: server.tools } : { connected: false, tools: [] };
  }
}

module.exports = { McpHost };
