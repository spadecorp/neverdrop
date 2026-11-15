// Legacy NeverDrop databases can have TEXT/UUID primary keys; modern releases
// created INTEGER PRIMARY KEY columns. lastInsertRowid is only a valid *id*
// for INTEGER PRIMARY KEY tables. For TEXT keys create and return an explicit UUID.
const { randomUUID } = require('node:crypto');

const ALLOWED_TABLES = new Set(['conversations', 'messages', 'providers', 'mcp_servers']);
function hasIntegerRowId(db, table) {
  if (!ALLOWED_TABLES.has(table)) throw new Error(`Unsupported table: ${table}`);
  const id = db.prepare(`PRAGMA table_info("${table}")`).all().find(row => row.name === 'id');
  if (!id || id.pk !== 1) throw new Error(`Table ${table} lacks a supported id primary key`);
  // Strictly INTEGER PRIMARY KEY aliases SQLite rowid (INT PRIMARY KEY does not).
  return id.type.trim().toUpperCase() === 'INTEGER';
}
function explicitId(db, table) {
  return hasIntegerRowId(db, table) ? null : randomUUID();
}
function savedId(info, generatedId) {
  return generatedId === null ? Number(info.lastInsertRowid) : generatedId;
}
module.exports = { hasIntegerRowId, explicitId, savedId };
