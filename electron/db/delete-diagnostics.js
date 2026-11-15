// Read-only schema diagnostics. Never include message content, API keys or row data.
const SAFE_TABLES = new Set(['conversations', 'providers']);
function deleteFailure(db, table, id, error) {
  if (!SAFE_TABLES.has(table)) return error;
  let details = '';
  try {
    const triggers = db.prepare(`SELECT tbl_name, name FROM sqlite_master WHERE type='trigger' AND tbl_name IN ('conversations','messages','providers') ORDER BY tbl_name,name`).all().map(x => `${x.tbl_name}.${x.name}`);
    const idType = id === null ? 'null' : typeof id;
    const storedRow = db.prepare(`SELECT typeof(id) AS id_type FROM ${table} WHERE id=?`).get(id);
    const messageCount = table === 'conversations' ? db.prepare('SELECT count(*) AS n FROM messages WHERE conversation_id = ?').get(id).n : null;
    details = ` [diagnostic: target=${table}, argument=${idType}, row-id=${storedRow?.id_type || 'not-found'}, related-messages=${messageCount ?? 'n/a'}, triggers=${triggers.join(',') || 'none'}]`;
    console.error(`NeverDrop delete failed for ${table}:`, { error: error.message, idType, storedIdType: storedRow?.id_type, triggers });
  } catch (diagnosticError) {
    console.error('NeverDrop deletion diagnostic failed:', diagnosticError);
  }
  const wrapped = new Error(`${error.message}${details}`);
  wrapped.cause = error;
  return wrapped;
}
module.exports = { deleteFailure };
