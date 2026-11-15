const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { applyMigrations, identifyProvider, SCHEMA_VERSION } = require('../electron/db/migrations');
const { insertProviderRow } = require('../electron/db/provider-insert');

let DatabaseSync;
try { ({ DatabaseSync } = require('node:sqlite')); } catch { /* Node 20 lacks the built-in SQLite test driver */ }

function fixtureDb(t) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'neverdrop-migrate-test-'));
  t.after(() => fs.rmSync(dir, { recursive: true, force: true }));
  const file = path.join(dir, 'neverdrop.db');
  const db = new DatabaseSync(file);
  db.exec('PRAGMA foreign_keys = ON; PRAGMA journal_mode = WAL');
  t.after(() => { try { db.close(); } catch {} });
  return { db, file, dir };
}

test('identifies reliable legacy provider hints, but does not guess ambiguous llama hosts', () => {
  assert.equal(identifyProvider({ type: 'Anthropic' }, 'model-x', null), 'anthropic');
  assert.equal(identifyProvider({}, 'mistral-large-2512', null), 'mistral');
  assert.equal(identifyProvider({}, 'command-a-reasoning-08-2025', null), 'cohere');
  assert.equal(identifyProvider({}, 'llama-3.3-70b-versatile', null), null);
  assert.equal(identifyProvider({}, 'llama-3.3-70b-versatile', 'https://api.groq.com/openai/v1'), 'groq');
});

test('migrates legacy tables without losing IDs, message history or pre-existing keys', { skip: !DatabaseSync }, t => {
  const { db, file, dir } = fixtureDb(t);
  db.exec(`
    CREATE TABLE conversations (id INTEGER PRIMARY KEY, title TEXT NOT NULL, created_at TEXT, updated_at TEXT);
    CREATE TABLE messages (id INTEGER PRIMARY KEY, conversation_id INTEGER REFERENCES conversations(id) ON DELETE CASCADE, role TEXT, content TEXT, created_at TEXT);
    CREATE TABLE providers (id INTEGER PRIMARY KEY, type TEXT NOT NULL, name TEXT NOT NULL, model TEXT NOT NULL, baseUrl TEXT, api_key TEXT);
    CREATE TABLE mcp_servers (id INTEGER PRIMARY KEY, name TEXT NOT NULL, command TEXT NOT NULL);
    INSERT INTO conversations VALUES (17, 'Original chat', '2025-06-01 09:00:00', '2025-06-01 09:30:00');
    INSERT INTO messages VALUES (36, 17, 'user', 'original secret message', '2025-06-01 09:05:00');
    INSERT INTO providers VALUES (29, 'cohere', 'Cohere legacy', 'command-a-reasoning-08-2025', NULL, 'original-legacy-key');
    INSERT INTO providers VALUES (31, 'mistral', 'Mistral legacy', 'mistral-large-2512', NULL, NULL);
    INSERT INTO providers VALUES (32, 'other', 'LLama unknown host', 'llama-3.3-70b-versatile', NULL, NULL);
    INSERT INTO mcp_servers VALUES (15, 'Filesystem', 'node');
  `);
  const result = applyMigrations(db, file);
  assert.equal(result.migrated, true);
  assert.equal(result.unresolvedProviders, 1);
  assert.ok(result.backupPath.startsWith(dir));
  assert.ok(fs.existsSync(result.backupPath));
  const backup = new DatabaseSync(result.backupPath, { readOnly: true });
  assert.equal(backup.prepare('SELECT COUNT(*) AS n FROM providers').get().n, 3);
  assert.equal(backup.prepare("SELECT COUNT(*) AS n FROM pragma_table_info('providers') WHERE name='provider'").get().n, 0);
  backup.close();

  const c = db.prepare('SELECT * FROM conversations WHERE id=17').get();
  assert.equal(c.title, 'Original chat');
  assert.equal(c.created_at, '2025-06-01 09:00:00');
  assert.equal(c.updated_at, '2025-06-01 09:30:00');
  assert.equal(c.model, null);
  assert.equal(db.prepare('SELECT content FROM messages WHERE id=36').get().content, 'original secret message');
  assert.equal(db.prepare("SELECT COUNT(*) AS n FROM messages_fts WHERE messages_fts MATCH 'original'").get().n, 1);
  assert.equal(db.prepare('SELECT tokens_in FROM messages WHERE id=36').get().tokens_in, 0);
  assert.equal(db.prepare('SELECT args FROM mcp_servers WHERE id=15').get().args, '[]');
  const oldProvider = db.prepare('SELECT * FROM providers WHERE id=29').get();
  assert.equal(oldProvider.provider, 'cohere');
  assert.equal(oldProvider.label, 'Cohere legacy');
  assert.equal(oldProvider.api_key, 'original-legacy-key');
  assert.equal(db.prepare('SELECT provider FROM providers WHERE id=31').get().provider, 'mistral');
  assert.equal(db.prepare('SELECT provider FROM providers WHERE id=32').get().provider, null);

  const created = db.prepare(`INSERT INTO conversations (title, provider_id, model, created_at, updated_at)
    VALUES ('New chat', NULL, 'gpt-4o-mini', datetime('now'), datetime('now'))`).run();
  assert.ok(created.lastInsertRowid > 17);
  const inserted = insertProviderRow(db, { provider: 'openai', label: 'OpenAI new', model: 'gpt-4o-mini', base_url: null });
  const saved = db.prepare('SELECT * FROM providers WHERE id = ?').get(inserted.lastInsertRowid);
  assert.equal(saved.type, 'openai');
  assert.equal(saved.name, 'OpenAI new');
  assert.equal(saved.provider, 'openai');
  assert.equal(saved.model, 'gpt-4o-mini');
  assert.equal(db.prepare('PRAGMA user_version').get().user_version, SCHEMA_VERSION);

  const countBefore = fs.readdirSync(dir).filter(name => name.startsWith('neverdrop-backup-')).length;
  assert.equal(applyMigrations(db, file).migrated, false);
  assert.equal(fs.readdirSync(dir).filter(name => name.startsWith('neverdrop-backup-')).length, countBefore);

  // Cascading delete remains active after adding new columns.
  db.prepare('DELETE FROM conversations WHERE id = ?').run(17);
  assert.equal(db.prepare('SELECT COUNT(*) AS n FROM messages WHERE id=36').get().n, 0);
});

test('fresh databases are initialized without producing a pointless backup', { skip: !DatabaseSync }, t => {
  const { db, file, dir } = fixtureDb(t);
  const result = applyMigrations(db, file);
  assert.equal(result.migrated, true);
  assert.equal(result.backupPath, null);
  assert.equal(fs.readdirSync(dir).filter(name => name.startsWith('neverdrop-backup-')).length, 0);
  const row = db.prepare(`INSERT INTO conversations (title) VALUES ('hello') RETURNING title, model, created_at`).get();
  assert.equal(row.title, 'hello');
  assert.equal(row.model, null);
  assert.ok(row.created_at);
  assert.equal(applyMigrations(db, file).migrated, false);
});

test('refuses to silently reshape incompatible message tables', { skip: !DatabaseSync }, t => {
  const { db, file } = fixtureDb(t);
  db.exec('CREATE TABLE messages (id INTEGER PRIMARY KEY, conversation_id INTEGER, role TEXT)');
  assert.throws(() => applyMigrations(db, file), /lacks required column content/);
  assert.equal(db.prepare("SELECT COUNT(*) AS n FROM pragma_table_info('messages')").get().n, 3);
});

test('repairs an older broken FTS schema and preserves searchable messages', { skip: !DatabaseSync }, t => {
  const { db, file } = fixtureDb(t);
  db.exec(`
    CREATE TABLE conversations (id INTEGER PRIMARY KEY, title TEXT);
    CREATE TABLE messages (id INTEGER PRIMARY KEY, conversation_id INTEGER, role TEXT, content TEXT);
    INSERT INTO conversations VALUES (1, 'Saved');
    INSERT INTO messages VALUES (7, 1, 'user', 'legacy searchable pineapple');
    CREATE VIRTUAL TABLE messages_fts USING fts5(
      content, conversation_id UNINDEXED, message_id UNINDEXED,
      content='messages', content_rowid='id'
    );
    CREATE TRIGGER messages_fts_insert AFTER INSERT ON messages BEGIN
      INSERT INTO messages_fts(rowid,content,conversation_id,message_id)
      VALUES(new.id,new.content,new.conversation_id,new.id);
    END;
    CREATE TRIGGER messages_fts_delete AFTER DELETE ON messages BEGIN
      INSERT INTO messages_fts(messages_fts,rowid,content,conversation_id,message_id)
      VALUES('delete',old.id,old.content,old.conversation_id,old.id);
    END;
  `);
  const result = applyMigrations(db, file);
  assert.equal(result.migrated, true);
  const cols = db.prepare('PRAGMA table_info(messages_fts)').all().map(x => x.name);
  assert.equal(cols.includes('message_id'), false);
  assert.equal(db.prepare("SELECT COUNT(*) AS n FROM messages_fts WHERE messages_fts MATCH 'pineapple'").get().n, 1);
  db.exec("INSERT INTO messages(conversation_id,role,content) VALUES(1,'assistant','fresh kiwi answer')");
  assert.equal(db.prepare("SELECT COUNT(*) AS n FROM messages_fts WHERE messages_fts MATCH 'kiwi'").get().n, 1);
});

test('rejects newer database versions without applying changes', { skip: !DatabaseSync }, t => {
  const { db, file } = fixtureDb(t);
  db.exec('PRAGMA user_version = 99');
  assert.throws(() => applyMigrations(db, file), /newer than this NeverDrop build/);
  assert.equal(db.prepare('PRAGMA user_version').get().user_version, 99);
});
