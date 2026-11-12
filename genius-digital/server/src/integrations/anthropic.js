// Penyedia AI: Anthropic (Claude) melalui SDK rasmi.
import Anthropic from '@anthropic-ai/sdk';

// Harga API pihak pertama (USD per juta token) — anggaran kos sahaja. Semak harga semasa sebelum bergantung padanya.
const PRICING = {
  'claude-fable-5-2': [8, 40], 'claude-opus-5-5': [4, 20], 'claude-opus-5': [5, 25],
  'claude-sonnet-5-5': [2, 10], 'claude-sonnet-5': [2, 10], 'claude-haiku-5-5': [0.1, 0.5],
};
// Model yang menyokong fallback sebelah pelayan apabila permintaan ditolak oleh pengelas keselamatan.
const FALLBACK_MODELS = new Set(['claude-fable-5-2', 'claude-fable-5-1', 'claude-opus-5-5', 'claude-opus-5', 'claude-sonnet-5-5']);

function explain(error) {
  if (error instanceof Anthropic.AuthenticationError) return 'API key tidak sah atau telah dibatalkan.';
  if (error instanceof Anthropic.PermissionDeniedError) return 'API key tiada kebenaran untuk sumber ini.';
  if (error instanceof Anthropic.NotFoundError) return 'Model atau sumber tidak ditemui.';
  if (error instanceof Anthropic.RateLimitError) return 'Had kadar dicapai. Cuba sebentar lagi.';
  if (error instanceof Anthropic.APIConnectionError) return 'Tidak dapat menghubungi api.anthropic.com.';
  if (error instanceof Anthropic.APIError) return `Ralat API (${error.status ?? '?'}): ${error.message}`;
  return `Ralat: ${error?.message || error}`;
}

export default {
  provider: 'anthropic',
  kind: 'ai',
  label: 'Anthropic (Claude)',
  envVar: 'ANTHROPIC_API_KEY',
  secretLabel: 'API key',
  configFields: [{ key: 'default_model', label: 'Model lalai', placeholder: 'claude-opus-5-5' }],
  models: Object.keys(PRICING),
  docs: 'https://platform.claude.com/docs',
  capabilities: { jana_teks: 'tersedia' },

  async test(config, secret) {
    try {
      const client = new Anthropic({ apiKey: secret, maxRetries: 0, timeout: 15_000 });
      const page = await client.models.list({ limit: 1 });
      return { ok: true, message: `Sambungan berjaya. Model tersedia: ${page.data?.[0]?.id ?? 'ya'}.` };
    } catch (error) {
      return { ok: false, message: explain(error) };
    }
  },

  async generate(config, secret, { model, system, prompt }) {
    const client = new Anthropic({ apiKey: secret });
    const id = model || config.default_model || 'claude-opus-5-5';
    const params = { model: id, max_tokens: 16000, system, messages: [{ role: 'user', content: prompt }] };
    let response;
    try {
      response = FALLBACK_MODELS.has(id)
        ? await client.beta.messages.create({ ...params, betas: ['server-side-fallback-2026-07-01'], fallbacks: 'default' })
        : await client.messages.create(params);
    } catch (error) {
      throw new Error(explain(error));
    }
    if (response.stop_reason === 'refusal') throw new Error('Model menolak permintaan ini (refusal).');
    const text = response.content.filter((b) => b.type === 'text').map((b) => b.text).join('\n').trim();
    const [pin, pout] = PRICING[id] || [0, 0];
    const tokens_in = response.usage?.input_tokens ?? 0;
    const tokens_out = response.usage?.output_tokens ?? 0;
    return {
      text: response.stop_reason === 'max_tokens' ? `${text}\n\n[Output dipotong: had token dicapai]` : text,
      tokens_in, tokens_out, cost: (tokens_in * pin + tokens_out * pout) / 1e6, model: response.model || id,
    };
  },
};
