const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const os = require('os');
const { applyMigrations } = require('../electron/db/migrations');
const { registerConversationHandlers } = require('../electron/ipc/conversations');
const { registerProviderHandlers } = require('../electron/ipc/providers');

let DatabaseSync;
try { ({ DatabaseSync } = require('node:sqlite')); } catch {}

function fixture(t) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'neverdrop-actions-'));
  const file = path.join(dir, 'db.sqlite');
  const db = new DatabaseSync(file);
  // A single ordered teardown avoids EBUSY on Windows when the SQLite file is open.
  t.after(() => {
    try { db.close(); }
    finally { fs.rmSync(dir, { recursive: true, force: true, maxRetries: 3, retryDelay: 100 }); }
  });
  db.exec('PRAGMA foreign_keys=ON; PRAGMA journal_mode=WAL');
  // The production application uses better-sqlite3 transaction(fn).
  db.transaction = fn => (...args) => {
    db.exec('BEGIN IMMEDIATE');
    try { const result = fn(...args); db.exec('COMMIT'); return result; }
    catch(e) { db.exec('ROLLBACK'); throw e; }
  };
  const handlers = new Map();
  const ipc = { handle: (name, callback) => handlers.set(name, callback) };
  registerConversationHandlers(ipc, db);
  registerProviderHandlers(ipc, db);
  const invoke = (name, ...args) => handlers.get(name)({}, ...args);
  return { db, file, invoke };
}

test('new conversations can be created and deleted without losing older ones', { skip:!DatabaseSync }, async t => {
  const { db, file, invoke } = fixture(t);
  applyMigrations(db, file);
  const old = invoke('conversations:create', {title:'Old data'});
  const fresh = invoke('conversations:create', {title:'New chat'});
  assert.equal(fresh.title, 'New chat');
  assert.equal(invoke('conversations:delete', fresh.id).changed, true);
  assert.equal(db.prepare('SELECT COUNT(*) AS n FROM conversations WHERE id=?').get(fresh.id).n,0);
  assert.equal(db.prepare('SELECT title FROM conversations WHERE id=?').get(old.id).title,'Old data');
});

test('deletion removes messages and updates full-text index', { skip:!DatabaseSync }, async t => {
  const { db, file, invoke } = fixture(t);
  applyMigrations(db, file);
  const a = invoke('conversations:create', {title:'A'});
  const b = invoke('conversations:create', {title:'B'});
  invoke('messages:save',{conversation_id:a.id,role:'user',content:'apple pumpkin'});
  invoke('messages:save',{conversation_id:b.id,role:'user',content:'banana kiwi'});
  assert.equal(db.prepare("SELECT COUNT(*) AS n FROM messages_fts WHERE messages_fts MATCH 'pumpkin'").get().n,1);
  const res = invoke('conversations:delete',a.id);
  assert.equal(res.changed,true);
  assert.equal(db.prepare('SELECT COUNT(*) AS n FROM messages WHERE conversation_id=?').get(a.id).n,0);
  assert.equal(db.prepare("SELECT COUNT(*) AS n FROM messages_fts WHERE messages_fts MATCH 'pumpkin'").get().n,0);
  assert.equal(db.prepare("SELECT COUNT(*) AS n FROM messages_fts WHERE messages_fts MATCH 'kiwi'").get().n,1);
});

test('version-two migration fixes an existing malformed full-text delete trigger', { skip:!DatabaseSync }, t => {
  const { db, file } = fixture(t);
  applyMigrations(db, file);
  db.exec(`INSERT INTO conversations(title) VALUES('Legacy');
    INSERT INTO messages(conversation_id,role,content) VALUES(1,'user','legacy search');
    DROP TRIGGER messages_fts_delete;
    CREATE TRIGGER messages_fts_delete AFTER DELETE ON messages BEGIN
      INSERT INTO messages_fts(rowid, content) VALUES('not-an-integer',old.content);
    END;
    PRAGMA user_version=1;`);
  assert.throws(() => db.prepare('DELETE FROM conversations WHERE id=1').run(), /datatype mismatch/);
  const r = applyMigrations(db,file);
  assert.equal(r.migrated,true);
  const result = db.prepare('DELETE FROM conversations WHERE id=1').run();
  assert.equal(result.changes,1);
  assert.equal(db.prepare('SELECT COUNT(*) AS n FROM messages').get().n,0);
});

test('provider delete detaches only its references and retains all messages', { skip:!DatabaseSync }, async t => {
  const { db, file, invoke } = fixture(t);
  applyMigrations(db, file);
  db.exec(`INSERT INTO providers(provider,label,model) VALUES ('openai','Old','gpt-4o-mini');
    INSERT INTO conversations(title,provider_id,model) VALUES ('Saved',1,'gpt-4o-mini');
    INSERT INTO messages(conversation_id,role,content) VALUES (1,'user','keep these words');`);
  const outcome = await invoke('providers:delete',1);
  assert.equal(outcome.changed,true);
  assert.equal(db.prepare('SELECT COUNT(*) AS n FROM providers').get().n,0);
  assert.equal(db.prepare('SELECT provider_id FROM conversations WHERE id=1').get().provider_id,null);
  assert.equal(db.prepare('SELECT model FROM conversations WHERE id=1').get().model,'gpt-4o-mini');
  assert.equal(db.prepare('SELECT content FROM messages WHERE id=1').get().content,'keep these words');
});
