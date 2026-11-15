// SQLite schema upgrades for databases created by earlier NeverDrop builds.
// Never drop/recreate user tables: provider IDs also identify OS-keychain entries.
const path = require('path');
const crypto = require('crypto');
const { hasIntegerRowId } = require('./ids');

const SCHEMA_VERSION = 3;

const TABLES = {
  conversations: `CREATE TABLE IF NOT EXISTS conversations (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    title TEXT NOT NULL DEFAULT 'New chat',
    provider_id INTEGER,
    model TEXT,
    summary TEXT,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at TEXT NOT NULL DEFAULT (datetime('now'))
  )`,
  messages: `CREATE TABLE IF NOT EXISTS messages (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    conversation_id INTEGER NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
    role TEXT NOT NULL CHECK(role IN ('user','assistant','system')),
    content TEXT NOT NULL,
    tokens_in INTEGER DEFAULT 0,
    tokens_out INTEGER DEFAULT 0,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
  )`,
  providers: `CREATE TABLE IF NOT EXISTS providers (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    provider TEXT NOT NULL,
    label TEXT NOT NULL,
    model TEXT NOT NULL,
    base_url TEXT,
    enabled INTEGER NOT NULL DEFAULT 1,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
  )`,
  mcp_servers: `CREATE TABLE IF NOT EXISTS mcp_servers (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    command TEXT NOT NULL,
    args TEXT NOT NULL DEFAULT '[]',
    env TEXT NOT NULL DEFAULT '{}',
    enabled INTEGER NOT NULL DEFAULT 1,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
  )`,
};

// These are additions for existing tables, not replacements for their old columns.
// SQLite doesn't allow non-constant datetime() defaults in ALTER TABLE ADD COLUMN.
const ADD_COLUMNS = {
  conversations: {
    title: "TEXT NOT NULL DEFAULT 'New chat'",
    provider_id: 'INTEGER',
    model: 'TEXT',
    summary: 'TEXT',
    created_at: 'TEXT',
    updated_at: 'TEXT',
  },
  messages: {
    tokens_in: 'INTEGER DEFAULT 0',
    tokens_out: 'INTEGER DEFAULT 0',
    created_at: 'TEXT',
  },
  providers: {
    provider: 'TEXT',
    label: 'TEXT',
    model: 'TEXT',
    base_url: 'TEXT',
    enabled: 'INTEGER NOT NULL DEFAULT 1',
    created_at: 'TEXT',
  },
  mcp_servers: {
    name: 'TEXT',
    command: 'TEXT',
    args: "TEXT NOT NULL DEFAULT '[]'",
    env: "TEXT NOT NULL DEFAULT '{}'",
    enabled: 'INTEGER NOT NULL DEFAULT 1',
    created_at: 'TEXT',
  },
};

const REQUIRED_LEGACY_COLUMNS = {
  conversations: ['id'],
  messages: ['id', 'conversation_id', 'role', 'content'],
  providers: ['id'],
  mcp_servers: ['id'],
};

function quote(name) {
  return `"${String(name).replace(/"/g, '""')}"`;
}
function existingColumns(db, table) {
  return new Set(db.prepare(`PRAGMA table_info(${quote(table)})`).all().map(row => row.name));
}
function objectExists(db, type, name) {
  return Boolean(db.prepare('SELECT 1 FROM sqlite_master WHERE type = ? AND name = ?').get(type, name));
}
function value(row, fields) {
  for (const field of fields) {
    const candidate = row[field];
    if (typeof candidate === 'string' && candidate.trim()) return candidate.trim();
  }
  return null;
}
function normalizeProviderKind(raw) {
  if (!raw) return null;
  const normalized = raw.toLowerCase().replace(/[^a-z0-9]/g, '');
  const aliases = {
    openai: 'openai', chatgpt: 'openai', anthropic: 'anthropic', claude: 'anthropic',
    google: 'gemini', googlegemini: 'gemini', gemini: 'gemini',
    groq: 'groq', deepseek: 'deepseek', mistral: 'mistral',
    cohere: 'cohere', cerebras: 'cerebras', xai: 'xai', grok: 'xai',
    ollama: 'ollama', lmstudio: 'lmstudio',
    openaicompatible: 'openai_compatible', custom: 'openai_compatible',
  };
  return aliases[normalized] || null;
}
function identifyProvider(row, model, baseUrl) {
  // Existing explicit metadata takes precedence; never default every old row to OpenAI.
  for (const alias of ['provider', 'provider_type', 'providerType', 'type', 'vendor', 'service', 'platform']) {
    const kind = normalizeProviderKind(row[alias]);
    if (kind) return kind;
  }
  const url = (baseUrl || '').toLowerCase();
  if (/api\.anthropic\.com/.test(url)) return 'anthropic';
  if (/generativelanguage\.googleapis\.com/.test(url)) return 'gemini';
  if (/api\.groq\.com/.test(url)) return 'groq';
  if (/api\.mistral\.ai/.test(url)) return 'mistral';
  if (/api\.cohere\.ai/.test(url)) return 'cohere';
  if (/api\.cerebras\.ai/.test(url)) return 'cerebras';
  if (/api\.deepseek\.com/.test(url)) return 'deepseek';
  if (/api\.x\.ai/.test(url)) return 'xai';
  if (/api\.openai\.com/.test(url)) return 'openai';
  if (/localhost:11434|127\.0\.0\.1:11434/.test(url)) return 'ollama';
  if (/localhost:1234|127\.0\.0\.1:1234/.test(url)) return 'lmstudio';
  // Only strongly identifying model families. Llama variants are hosted by many services.
  const m = (model || '').toLowerCase();
  if (/^claude-/.test(m)) return 'anthropic';
  if (/^(models\/)?gemini-/.test(m)) return 'gemini';
  if (/^(gpt-|chatgpt-|o1-|o3-|o4-)/.test(m)) return 'openai';
  if (/^(command-|c4ai-)/.test(m)) return 'cohere';
  if (/^(mistral-|ministral-|codestral-|pixtral-)/.test(m)) return 'mistral';
  if (/^deepseek-/.test(m)) return 'deepseek';
  if (/^grok-/.test(m)) return 'xai';
  return null; // Unknown vendor must be configured explicitly before chatting.
}

// Earlier releases could insert rows with NULL id into TEXT PRIMARY KEY tables,
// then try to look them up via lastInsertRowid. Give those rows durable IDs.
// Reusing each row's numeric rowid as a TEXT id maintains OS-keychain account
// names created by the buggy provider save code (which used lastInsertRowid).
// Only NULL ids are repaired, so existing UUIDs and their references stay intact.
function backfillNullPrimaryKeys(db) {
  let changed = 0;
  for (const table of Object.keys(TABLES)) {
    if (hasIntegerRowId(db, table)) continue;
    const missing = db.prepare(`SELECT rowid AS rid FROM ${quote(table)} WHERE id IS NULL`).all();
    for (const { rid } of missing) {
      let candidate = String(rid);
      if (db.prepare(`SELECT 1 FROM ${quote(table)} WHERE id=?`).get(candidate)) {
        candidate = crypto.randomUUID();
      }
      db.prepare(`UPDATE ${quote(table)} SET id=? WHERE rowid=?`).run(candidate, rid);
      changed++;
    }
  }
  return changed;
}

function backfillProviders(db) {
  const rows = db.prepare('SELECT * FROM providers').all();
  const update = db.prepare(`UPDATE providers SET provider = ?, label = ?, model = ?, base_url = ? WHERE id = ?`);
  let unresolved = 0;
  for (const row of rows) {
    const model = value(row, ['model', 'model_name', 'modelName', 'model_id', 'modelId']);
    const baseUrl = value(row, ['base_url', 'baseUrl', 'baseURL', 'api_base', 'api_url', 'endpoint']);
    const label = value(row, ['label', 'display_name', 'displayName', 'name', 'title']) || model || `Provider ${row.id}`;
    const provider = identifyProvider(row, model, baseUrl) || value(row, ['provider']);
    if (!normalizeProviderKind(provider)) unresolved += 1;
    if (provider !== row.provider || label !== row.label || model !== row.model || baseUrl !== row.base_url) {
      update.run(provider, label, model, baseUrl, row.id);
    }
  }
  return unresolved;
}

function backupExistingDatabase(db, dbPath) {
  // VACUUM INTO takes an atomic, WAL-aware snapshot. Copying a live .db file is unsafe.
  const stamp = new Date().toISOString().replace(/[:.]/g, '-');
  const backupPath = path.join(path.dirname(dbPath),
    `neverdrop-backup-${stamp}-${crypto.randomBytes(3).toString('hex')}.sqlite`);
  db.prepare('VACUUM INTO ?').run(backupPath);
  return backupPath;
}

function applyMigrations(db, dbPath) {
  const version = db.prepare('PRAGMA user_version').get().user_version;
  if (version > SCHEMA_VERSION) {
    throw new Error(`Database schema version ${version} is newer than this NeverDrop build supports (${SCHEMA_VERSION}).`);
  }

  const tableNames = Object.keys(TABLES);
  const current = Object.fromEntries(tableNames.map(table => [
    table, objectExists(db, 'table', table) ? existingColumns(db, table) : null,
  ]));
  const missing = [];
  for (const table of tableNames) {
    if (!current[table]) { missing.push(table); continue; }
    for (const col of REQUIRED_LEGACY_COLUMNS[table]) {
      if (!current[table].has(col)) {
        throw new Error(`Existing ${table} table lacks required column ${col}; cannot safely migrate automatically.`);
      }
    }
    for (const col of Object.keys(ADD_COLUMNS[table])) {
      if (!current[table].has(col)) missing.push(`${table}.${col}`);
    }
  }
  for (const [type, name] of [
    ['index', 'idx_messages_conv'], ['index', 'idx_messages_fts_prep'],
    ['table', 'messages_fts'], ['trigger', 'messages_fts_insert'], ['trigger', 'messages_fts_delete'],
  ]) {
    if (!objectExists(db, type, name)) missing.push(name);
  }
  const ftsColumns = objectExists(db, 'table', 'messages_fts') ? existingColumns(db, 'messages_fts') : null;
  const ftsSql = db.prepare("SELECT sql FROM sqlite_master WHERE name = 'messages_fts' AND type='table'").get()?.sql || '';
  const invalidFts = Boolean(ftsColumns && (ftsColumns.has('message_id') || !ftsColumns.has('conversation_id') || !/content_rowid\s*=\s*['\"]rowid['\"]/i.test(ftsSql)));
  const invalidIds = tableNames.some(table => current[table] && !hasIntegerRowId(db, table) &&
    db.prepare(`SELECT 1 FROM ${quote(table)} WHERE id IS NULL LIMIT 1`).get());
  // Version 3 rebuilds the FTS index using the hidden SQLite integer rowid:
  // older installations used TEXT UUID message IDs, which FTS5 cannot use as rowids.
  const needsMigration = version < SCHEMA_VERSION || missing.length > 0 || invalidFts || invalidIds;
  if (!needsMigration) return { migrated: false, backupPath: null, unresolvedProviders: 0 };

  const existingData = db.prepare(`SELECT count(*) AS n FROM sqlite_master
    WHERE type = 'table' AND name NOT LIKE 'sqlite_%'`).get().n > 0;
  const backupPath = existingData ? backupExistingDatabase(db, dbPath) : null;
  let unresolvedProviders = 0;
  db.exec('BEGIN IMMEDIATE');
  try {
    for (const table of tableNames) db.exec(TABLES[table]);
    for (const table of tableNames) {
      const columns = existingColumns(db, table);
      for (const [column, declaration] of Object.entries(ADD_COLUMNS[table])) {
        if (!columns.has(column)) {
          db.exec(`ALTER TABLE ${quote(table)} ADD COLUMN ${quote(column)} ${declaration}`);
        }
      }
    }
    // Fill only blank legacy metadata. Existing non-empty values are preserved.
    db.exec(`UPDATE conversations SET updated_at = COALESCE(NULLIF(updated_at, ''), created_at, datetime('now'))
      WHERE updated_at IS NULL OR updated_at = ''`);
    db.exec(`UPDATE conversations SET created_at = COALESCE(NULLIF(created_at, ''), updated_at, datetime('now'))
      WHERE created_at IS NULL OR created_at = ''`);
    db.exec(`UPDATE messages SET tokens_in = 0 WHERE tokens_in IS NULL`);
    db.exec(`UPDATE messages SET tokens_out = 0 WHERE tokens_out IS NULL`);
    db.exec(`UPDATE mcp_servers SET args = '[]' WHERE args IS NULL OR args = ''`);
    db.exec(`UPDATE mcp_servers SET env = '{}' WHERE env IS NULL OR env = ''`);
    backfillNullPrimaryKeys(db);
    unresolvedProviders = backfillProviders(db);

    db.exec('CREATE INDEX IF NOT EXISTS idx_messages_conv ON messages(conversation_id)');
    db.exec('CREATE INDEX IF NOT EXISTS idx_messages_fts_prep ON messages(content)');
    // Version 3 repairs external-content FTS triggers before any user deletes.
    // Earlier builds created an external-content FTS index with a non-existent
    // `messages.message_id` column, and stored TEXT IDs in FTS5 rowids. Rebuild only the
    // search index; original messages remain untouched.
    db.exec('DROP TRIGGER IF EXISTS messages_fts_insert');
    db.exec('DROP TRIGGER IF EXISTS messages_fts_delete');
    db.exec('DROP TABLE IF EXISTS messages_fts');
    db.exec(`CREATE VIRTUAL TABLE messages_fts USING fts5(
      content, conversation_id UNINDEXED,
      content='messages', content_rowid='rowid'
    )`);
    db.exec(`CREATE TRIGGER messages_fts_insert AFTER INSERT ON messages BEGIN
      INSERT INTO messages_fts(rowid, content, conversation_id)
      VALUES (new.rowid, new.content, new.conversation_id);
    END`);
    db.exec(`CREATE TRIGGER messages_fts_delete AFTER DELETE ON messages BEGIN
      INSERT INTO messages_fts(messages_fts, rowid, content, conversation_id)
      VALUES ('delete', old.rowid, old.content, old.conversation_id);
    END`);
    db.exec("INSERT INTO messages_fts(messages_fts) VALUES('rebuild')");
    db.exec(`PRAGMA user_version = ${SCHEMA_VERSION}`);
    db.exec('COMMIT');
  } catch (error) {
    db.exec('ROLLBACK');
    throw new Error(`NeverDrop database migration failed; existing data was not replaced. ${error.message}`);
  }
  return { migrated: true, backupPath, unresolvedProviders };
}

module.exports = { applyMigrations, identifyProvider, normalizeProviderKind, SCHEMA_VERSION };
