const { deleteFailure } = require('../db/delete-diagnostics');
const { insertProviderRow } = require('../db/provider-insert');
let keytar;
try { keytar = require('keytar'); } catch { keytar = null; }

const SERVICE = 'neverdrop';
const KNOWN_PROVIDERS = new Set([
  'openai', 'anthropic', 'gemini', 'groq', 'deepseek', 'mistral',
  'cohere', 'cerebras', 'xai', 'ollama', 'lmstudio', 'openai_compatible',
]);

function registerProviderHandlers(ipcMain, db) {
  ipcMain.handle('providers:list', async () => {
    const rows = db.prepare('SELECT * FROM providers WHERE enabled = 1 ORDER BY id ASC').all();
    return Promise.all(rows.map(async (row) => {
      let hasKey = false;
      if (keytar) {
        try { hasKey = Boolean(await keytar.getPassword(SERVICE, String(row.id))); }
        catch (error) { console.warn(`Unable to check keychain entry for provider ${row.id}:`, error.message); }
      }
      return { ...row, hasKey, needsSetup: !KNOWN_PROVIDERS.has(row.provider) };
    }));
  });

  ipcMain.handle('providers:save', async (_, p) => {
    if (!p || !p.provider || !p.label?.trim() || !p.model?.trim()) {
      throw new Error('Provider, display name, and model are required.');
    }
    const info = insertProviderRow(db, {
      provider: p.provider, label: p.label.trim(), model: p.model.trim(), base_url: p.base_url,
    });
    const id = info.id;
    if (p.apiKey) {
      if (!keytar) {
        db.prepare('DELETE FROM providers WHERE id = ?').run(id);
        throw new Error('Secure credential storage is unavailable on this system. The provider was not saved.');
      }
      try {
        await keytar.setPassword(SERVICE, String(id), p.apiKey);
      } catch (error) {
        db.prepare('DELETE FROM providers WHERE id = ?').run(id);
        throw new Error(`Unable to save the API key to the operating-system keychain: ${error.message}`);
      }
    }
    const saved = db.prepare('SELECT * FROM providers WHERE id = ?').get(id);
    if (!saved) throw new Error('Provider was inserted but could not be retrieved.');
    return { ...saved, hasKey: Boolean(p.apiKey) };
  });

  ipcMain.handle('providers:delete', async (_, id) => {
    let changed;
    try {
      // Keep the historical model name in conversations, but detach its
      // credential-backed provider before deleting the provider record.
      const deleteProvider = db.transaction((providerId) => {
        db.prepare('UPDATE conversations SET provider_id = NULL WHERE provider_id = ?').run(providerId);
        return db.prepare('DELETE FROM providers WHERE id = ?').run(providerId).changes;
      });
      changed = deleteProvider(id);
    } catch (error) { throw deleteFailure(db, 'providers', id, error); }
    // Only remove keychain material when the database row was deleted.
    if (changed && keytar) await keytar.deletePassword(SERVICE, String(id)).catch(error => {
      console.warn('Unable to delete obsolete keychain entry for provider:', error.message);
    });
    return { ok: true, changed: changed > 0 };
  });
}

async function getApiKey(providerId) {
  if (!keytar) return null;
  return keytar.getPassword(SERVICE, String(providerId));
}

module.exports = { registerProviderHandlers, getApiKey };
