const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');
const { applyMigrations, SCHEMA_VERSION } = require('../electron/db/migrations');
const { registerConversationHandlers } = require('../electron/ipc/conversations');
const { registerProviderHandlers } = require('../electron/ipc/providers');
let DatabaseSync;
try { ({ DatabaseSync } = require('node:sqlite')); } catch {}
function fixture(t) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'neverdrop-text-ids-'));
  const file = path.join(dir, 'neverdrop.db');
  t.after(() => fs.rmSync(dir, { recursive:true, force:true }));
  const db = new DatabaseSync(file);
  db.exec('PRAGMA foreign_keys=ON; PRAGMA journal_mode=WAL;');
  t.after(() => db.close());
  db.transaction = fn => (...args) => {
    db.exec('BEGIN IMMEDIATE');
    try { const v = fn(...args); db.exec('COMMIT'); return v; }
    catch (e) { db.exec('ROLLBACK'); throw e; }
  };
  const handlers = new Map();
  const ipc = { handle: (name, cb) => handlers.set(name, cb) };
  registerConversationHandlers(ipc, db);
  registerProviderHandlers(ipc, db);
  const invoke = (name, ...args) => handlers.get(name)({}, ...args);
  return { db, file, dir, invoke };
}
function legacySchema(db) {
  db.exec(`
    CREATE TABLE conversations(id TEXT PRIMARY KEY, title TEXT NOT NULL, provider_id TEXT, created_at TEXT, updated_at TEXT);
    CREATE TABLE messages(id TEXT PRIMARY KEY, conversation_id TEXT REFERENCES conversations(id) ON DELETE CASCADE, role TEXT NOT NULL, content TEXT NOT NULL, created_at TEXT);
    CREATE TABLE providers(id TEXT PRIMARY KEY, type TEXT NOT NULL, name TEXT NOT NULL, model TEXT NOT NULL, enabled INTEGER NOT NULL DEFAULT 1);
    CREATE TABLE mcp_servers(id TEXT PRIMARY KEY, name TEXT NOT NULL, command TEXT NOT NULL);
    INSERT INTO providers(id,type,name,model) VALUES ('provider-uuid-1','openai','Old OpenAI','gpt-4o-mini');
    INSERT INTO conversations(id,title,provider_id) VALUES ('chat-uuid-1','Old conversation','provider-uuid-1');
    INSERT INTO messages(id,conversation_id,role,content) VALUES ('message-uuid-1','chat-uuid-1','user','original apple message');
    INSERT INTO messages(id,conversation_id,role,content) VALUES ('message-uuid-2','chat-uuid-1','assistant','original banana message');
    CREATE VIRTUAL TABLE messages_fts USING fts5(content, conversation_id UNINDEXED, content='messages', content_rowid='id');
    CREATE TRIGGER messages_fts_insert AFTER INSERT ON messages BEGIN
      INSERT INTO messages_fts(rowid,content,conversation_id) VALUES(new.id,new.content,new.conversation_id);
    END;
    CREATE TRIGGER messages_fts_delete AFTER DELETE ON messages BEGIN
      INSERT INTO messages_fts(messages_fts,rowid,content,conversation_id)
      VALUES('delete',old.id,old.content,old.conversation_id);
    END;
    PRAGMA user_version=2;
  `);
}
test('TEXT legacy ids: migration preserves UUIDs, rebuilds FTS, and supports old and new conversation deletion', {skip:!DatabaseSync}, t => {
  const { db, file, dir, invoke } = fixture(t);
  legacySchema(db);
  const result = applyMigrations(db,file);
  assert.equal(result.migrated,true);
  assert.ok(result.backupPath.startsWith(dir));
  assert.equal(db.prepare('PRAGMA user_version').get().user_version, SCHEMA_VERSION);
  assert.equal(db.prepare('SELECT id FROM conversations').get().id,'chat-uuid-1');
  assert.equal(db.prepare('SELECT id FROM providers').get().id,'provider-uuid-1');
  assert.equal(db.prepare('SELECT id FROM messages ORDER BY rowid LIMIT 1').get().id,'message-uuid-1');
  assert.equal(db.prepare("SELECT count(*) AS n FROM messages_fts WHERE messages_fts MATCH 'apple'").get().n,1);
  assert.match(db.prepare("SELECT sql FROM sqlite_master WHERE name='messages_fts'").get().sql,/content_rowid='rowid'/);
  const fresh = invoke('conversations:create',{title:'New chat',providerId:'provider-uuid-1',model:'gpt-4o-mini'});
  assert.equal(typeof fresh.id,'string');
  assert.ok(fresh.id.length > 10);
  assert.equal(fresh.title,'New chat');
  const firstMessage = invoke('messages:save',{conversation_id:fresh.id,role:'user',content:'search zebra new conversation'});
  assert.equal(typeof firstMessage.id,'string');
  const secondMessage = invoke('messages:save',{conversation_id:fresh.id,role:'assistant',content:'search kiwi follow-up'});
  assert.equal(secondMessage.role,'assistant');
  assert.deepEqual(invoke('messages:list',fresh.id).map(r => r.content), ['search zebra new conversation','search kiwi follow-up']);
  assert.equal(db.prepare("SELECT count(*) AS n FROM messages_fts WHERE messages_fts MATCH 'zebra'").get().n,1);
  assert.equal(invoke('conversations:delete',fresh.id).changed,true);
  assert.equal(db.prepare("SELECT count(*) AS n FROM messages_fts WHERE messages_fts MATCH 'zebra'").get().n,0);
  assert.equal(invoke('conversations:delete','chat-uuid-1').changed,true);
  assert.equal(db.prepare("SELECT count(*) AS n FROM messages_fts WHERE messages_fts MATCH 'apple'").get().n,0);
  assert.equal(db.prepare('SELECT count(*) AS n FROM messages').get().n,0);
  assert.equal(applyMigrations(db,file).migrated,false);
});
test('TEXT legacy ids: provider save gives a real id, retains keychain identifier, deletes safely', {skip:!DatabaseSync}, async t => {
  const { db, file, invoke } = fixture(t);
  legacySchema(db);
  applyMigrations(db,file);
  const newProvider = await invoke('providers:save',{provider:'openai',label:'Test Provider',model:'gpt-4o-mini',base_url:null,apiKey:''});
  assert.equal(typeof newProvider.id,'string');
  assert.ok(newProvider.id.length>10);
  assert.equal(db.prepare('SELECT id FROM providers WHERE id=?').get(newProvider.id).id,newProvider.id);
  const conversation=invoke('conversations:create',{providerId:newProvider.id,model:newProvider.model});
  assert.equal((await invoke('providers:delete',newProvider.id)).changed,true);
  assert.equal(db.prepare('SELECT provider_id FROM conversations WHERE id=?').get(conversation.id).provider_id,null);
  assert.equal(db.prepare('SELECT COUNT(*) AS n FROM providers').get().n,1);
  assert.equal((await invoke('providers:delete','provider-uuid-1')).changed,true);
});
test('TEXT legacy ids: migration repairs earlier NULL ids while retaining numeric keychain lookup IDs', {skip:!DatabaseSync}, t => {
  const { db, file, invoke } = fixture(t);
  legacySchema(db);
  db.exec(`INSERT INTO conversations(id,title) VALUES(NULL,'Previously broken New chat');
    INSERT INTO providers(id,type,name,model) VALUES(NULL,'openai','Previously broken provider','gpt-4o-mini');`);
  const conversationRowid = db.prepare("SELECT rowid AS rid FROM conversations WHERE id IS NULL").get().rid;
  const providerRowid = db.prepare("SELECT rowid AS rid FROM providers WHERE id IS NULL").get().rid;
  applyMigrations(db,file);
  const fixedConv = db.prepare("SELECT id FROM conversations WHERE title='Previously broken New chat'").get();
  const fixedProvider = db.prepare("SELECT id FROM providers WHERE name='Previously broken provider'").get();
  assert.equal(fixedConv.id, String(conversationRowid));
  assert.equal(fixedProvider.id, String(providerRowid));
  assert.equal(invoke('conversations:delete',fixedConv.id).changed,true);
});
