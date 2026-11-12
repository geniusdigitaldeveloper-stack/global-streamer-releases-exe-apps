// Integration layer. Setiap penyedia ialah adapter dengan antara muka yang sama, jadi logik aplikasi
// tidak terikat kepada mana-mana penyedia. Untuk menambah connector baharu: cipta fail adapter
// (provider, kind, label, envVar, configFields, capabilities, test, [generate]) dan daftarkannya di sini.
import anthropic from './anthropic.js';
import openaiCompatible from './openaiCompatible.js';
import metricool from './metricool.js';
import { getSecret, secretStatus, redact } from '../secrets.js';
import { parseJson, now } from '../db.js';

export const ADAPTERS = Object.fromEntries([anthropic, ...openaiCompatible, metricool].map((a) => [a.provider, a]));

// Status sebenar connector — tidak pernah "aktif" tanpa ujian sambungan yang berjaya.
export function connectorStatus(c, secret) {
  if (!ADAPTERS[c.provider]) return 'tidak_disokong';
  if (!secret.has_secret && !ADAPTERS[c.provider].keyOptional) return 'belum_dikonfigurasi';
  if (!c.enabled) return 'dinyahaktifkan';
  if (c.last_test_ok === 1) return 'aktif';
  if (c.last_test_ok === 0) return 'ralat';
  return 'belum_diuji';
}

// Paparan selamat untuk browser: tiada nilai rahsia.
export function describeConnector(db, row) {
  const c = parseJson(row, ['config']);
  const a = ADAPTERS[c.provider];
  const secret = secretStatus(db, c.id, a?.envVar);
  return {
    id: c.id, provider: c.provider, name: c.name, kind: a?.kind || 'lain', provider_label: a?.label || c.provider,
    config: c.config || {}, config_fields: a?.configFields || [], models: a?.models?.length ? a.models : c.config?.models_cache || [],
    capabilities: a?.capabilities || {}, requirements: a?.requirements || '', docs: a?.docs || '',
    env_var: a?.envVar || null, key_optional: Boolean(a?.keyOptional), secret_label: a?.secretLabel || 'Rahsia',
    enabled: Boolean(c.enabled), secret, status: connectorStatus(c, secret),
    last_test_at: c.last_test_at, last_test_ok: c.last_test_ok == null ? null : Boolean(c.last_test_ok), last_test_message: c.last_test_message,
  };
}

export async function testConnector(db, id) {
  const row = db.get('SELECT * FROM connectors WHERE id = ?', id);
  if (!row) return null;
  const c = parseJson(row, ['config']);
  const a = ADAPTERS[c.provider];
  const s = a && (getSecret(db, c.id, a.envVar) || (a.keyOptional ? { value: 'tiada' } : null));
  let result;
  if (!a) result = { ok: false, message: 'Penyedia tidak disokong.' };
  else if (!s) result = { ok: false, message: 'Belum dikonfigurasi: tiada rahsia disimpan.' };
  else {
    try { result = await a.test(c.config || {}, s.value); } catch (e) { result = { ok: false, message: e.message }; }
    result.message = redact(result.message, s.value);
  }
  if (s) {
    const config = result.models ? { ...(c.config || {}), models_cache: result.models } : c.config || {};
    db.update('connectors', id, { last_test_at: now(), last_test_ok: result.ok ? 1 : 0, last_test_message: result.message, config: JSON.stringify(config) });
  }
  delete result.models;
  return result;
}

// Dapatkan penjana AI yang benar-benar boleh digunakan untuk seorang agent, atau null (→ simulasi).
export function resolveGenerator(db, agent) {
  if (!agent?.connector_id) return null;
  const row = db.get('SELECT * FROM connectors WHERE id = ?', agent.connector_id);
  if (!row) return null;
  const c = parseJson(row, ['config']);
  const a = ADAPTERS[c.provider];
  if (!a?.generate || !c.enabled || c.last_test_ok !== 1) return null;
  const s = getSecret(db, c.id, a.envVar) || (a.keyOptional ? { value: 'tiada' } : null);
  if (!s) return null;
  return {
    name: c.name,
    run: async (input) => {
      try { return await a.generate(c.config || {}, s.value, input); } catch (e) { throw new Error(redact(e.message, s.value)); }
    },
  };
}
