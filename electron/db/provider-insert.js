const { explicitId } = require('./ids');
// A provider table from older NeverDrop builds may retain required legacy
// columns (such as `type` / `name`). Populate those alongside canonical fields
// rather than deleting the table or breaking its keychain-linked IDs.
function insertProviderRow(db, input) {
  const cols = db.prepare('PRAGMA table_info(providers)').all();
  const columns = new Map(cols.map(col => [col.name, col]));
  const generatedId = explicitId(db, 'providers');
  const valuesByName = {
    ...(generatedId === null ? {} : { id: generatedId }),
    provider: input.provider,
    label: input.label,
    model: input.model,
    base_url: input.base_url || null,
    enabled: 1,
    created_at: new Date().toISOString(),
    // Legacy compatibility (not credentials; API keys belong in the OS keychain).
    type: input.provider,
    provider_type: input.provider,
    providerType: input.provider,
    vendor: input.provider,
    name: input.label,
    display_name: input.label,
    displayName: input.label,
    model_name: input.model,
    modelName: input.model,
    model_id: input.model,
    modelId: input.model,
    baseUrl: input.base_url || null,
    baseURL: input.base_url || null,
    api_base: input.base_url || null,
    api_url: input.base_url || null,
    endpoint: input.base_url || null,
  };
  const supplied = Object.entries(valuesByName).filter(([name]) => columns.has(name));
  const provided = new Set(supplied.map(([name]) => name));
  const requiredUnknown = cols.filter(col => col.notnull && !col.pk && col.dflt_value == null && !provided.has(col.name));
  if (requiredUnknown.length) {
    throw new Error(`Your legacy provider table requires unsupported column(s): ${requiredUnknown.map(col => col.name).join(', ')}. The database has not been reset; please share its table structure for a targeted migration.`);
  }
  const sql = `INSERT INTO providers (${supplied.map(([name]) => `"${name.replace(/"/g, '""')}"`).join(', ')}) VALUES (${supplied.map(() => '?').join(', ')})`;
  const info = db.prepare(sql).run(...supplied.map(([, value]) => value));
  return { ...info, id: generatedId === null ? Number(info.lastInsertRowid) : generatedId };
}

module.exports = { insertProviderRow };
