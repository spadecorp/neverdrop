const { explicitId, savedId } = require('../db/ids');
const { deleteFailure } = require('../db/delete-diagnostics');

function registerConversationHandlers(ipcMain, db) {
  ipcMain.handle('conversations:list', () => {
    return db.prepare(`
      SELECT c.*, COUNT(m.id) as message_count
      FROM conversations c
      LEFT JOIN messages m ON m.conversation_id = c.id
      GROUP BY c.id
      ORDER BY c.updated_at DESC
    `).all();
  });

  ipcMain.handle('conversations:create', (_, opts = {}) => {
    const generated = explicitId(db, 'conversations');
    const values = { title: opts.title || 'New chat', provider_id: opts.providerId ?? null, model: opts.model || null };
    const info = generated === null
      ? db.prepare(`INSERT INTO conversations (title, provider_id, model, created_at, updated_at)
          VALUES (@title, @provider_id, @model, datetime('now'), datetime('now'))`).run(values)
      : db.prepare(`INSERT INTO conversations (id, title, provider_id, model, created_at, updated_at)
          VALUES (@id, @title, @provider_id, @model, datetime('now'), datetime('now'))`).run({ id: generated, ...values });
    const id = savedId(info, generated);
    const created = db.prepare('SELECT * FROM conversations WHERE id = ?').get(id);
    if (!created) throw new Error('The new conversation could not be retrieved; please report its schema.');
    return created;
  });

  ipcMain.handle('conversations:rename', (_, { id, title }) => {
    if (typeof title !== 'string' || !title.trim()) throw new Error('A conversation title is required.');
    const info = db.prepare(`UPDATE conversations SET title = ?, updated_at = datetime('now') WHERE id = ?`).run(title.trim(), id);
    return { ok: true, changed: info.changes > 0 };
  });

  ipcMain.handle('conversations:delete', (_, id) => {
    try {
      // Let configured ON DELETE CASCADE remove associated messages. Repaired
      // FTS triggers keep the derived search index in sync with those deletes.
      const info = db.prepare('DELETE FROM conversations WHERE id = ?').run(id);
      return { ok: true, changed: info.changes > 0 };
    } catch (error) { throw deleteFailure(db, 'conversations', id, error); }
  });

  ipcMain.handle('messages:list', (_, conversationId) => {
    return db.prepare(`SELECT * FROM messages WHERE conversation_id = ? ORDER BY rowid ASC`).all(conversationId);
  });

  ipcMain.handle('messages:save', (_, msg) => {
    const generated = explicitId(db, 'messages');
    const values = {
      conversation_id: msg.conversation_id,
      role: msg.role,
      content: msg.content,
      tokens_in: msg.tokens_in || 0,
      tokens_out: msg.tokens_out || 0,
    };
    const info = generated === null
      ? db.prepare(`INSERT INTO messages (conversation_id, role, content, tokens_in, tokens_out)
          VALUES (@conversation_id, @role, @content, @tokens_in, @tokens_out)`).run(values)
      : db.prepare(`INSERT INTO messages (id, conversation_id, role, content, tokens_in, tokens_out)
          VALUES (@id, @conversation_id, @role, @content, @tokens_in, @tokens_out)`).run({ id: generated, ...values });
    const id = savedId(info, generated);
    db.prepare(`UPDATE conversations SET updated_at = datetime('now') WHERE id = ?`).run(msg.conversation_id);

    if (msg.role === 'assistant') {
      const count = db.prepare(`SELECT COUNT(*) as c FROM messages WHERE conversation_id = ? AND role = 'assistant'`).get(msg.conversation_id).c;
      if (count % 10 === 0) {
        const msgs = db.prepare(`SELECT role, content FROM messages WHERE conversation_id = ? ORDER BY rowid DESC LIMIT 20`).all(msg.conversation_id).reverse();
        const summary = msgs.map(m => `${m.role}: ${m.content.slice(0, 200)}`).join('\n');
        db.prepare(`UPDATE conversations SET summary = ? WHERE id = ?`).run(summary, msg.conversation_id);
      }
    }
    return db.prepare('SELECT * FROM messages WHERE id = ?').get(id);
  });
}

module.exports = { registerConversationHandlers };
