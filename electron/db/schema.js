const Database = require('better-sqlite3');
const path = require('path');
const fs = require('fs');
const { app } = require('electron');
const { applyMigrations } = require('./migrations');

let _db = null;

function initDb() {
  if (_db) return _db;
  const userDataPath = app.getPath('userData');
  fs.mkdirSync(userDataPath, { recursive: true });
  const dbPath = path.join(userDataPath, 'neverdrop.db');
  const db = new Database(dbPath);
  try {
    db.pragma('journal_mode = WAL');
    db.pragma('foreign_keys = ON');
    const result = applyMigrations(db, dbPath);
    if (result.backupPath) console.info('NeverDrop: pre-migration database backup:', result.backupPath);
    if (result.migrated) console.info('NeverDrop: database schema migration completed.');
    if (result.unresolvedProviders > 0) {
      console.warn(`NeverDrop: ${result.unresolvedProviders} existing provider(s) have an unrecognized service type; re-add these providers using the correct preset before chatting.`);
    }
    _db = db;
    return _db;
  } catch (error) {
    db.close();
    throw error;
  }
}

function getDb() {
  if (!_db) throw new Error('DB not initialised');
  return _db;
}

module.exports = { initDb, getDb };
