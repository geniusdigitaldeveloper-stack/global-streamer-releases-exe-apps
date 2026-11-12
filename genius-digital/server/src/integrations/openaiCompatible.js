// Penyedia AI yang menggunakan protokol serasi OpenAI (/models, /chat/completions).
// Satu kilang adapter menghasilkan preset untuk GPT, DeepSeek, Gemini, Groq, Mistral, xAI,
// OpenRouter, Ollama setempat dan mana-mana penyedia lain melalui base URL tersuai.
const trim = (u) => String(u || '').replace(/\/+$/, '');
const validUrl = (u) => /^https:\/\//.test(u) || /^http:\/\/(localhost|127\.0\.0\.1)(:\d+)?(\/|$)/.test(u);

async function call(url, secret, init = {}) {
  const res = await fetch(url, {
    ...init,
    headers: { Authorization: `Bearer ${secret}`, 'Content-Type': 'application/json', ...(init.headers || {}) },
    signal: AbortSignal.timeout(init.timeoutMs || 15_000),
  });
  const body = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(res.status === 401 || res.status === 403 ? 'API key tidak sah atau tiada kebenaran.' : `Ralat API (${res.status}): ${body?.error?.message || res.statusText}`);
  return body;
}

function make({ provider, label, envVar, baseUrl, docs = '', keyOptional = false }) {
  const base = (config) => trim(config.base_url || baseUrl);
  return {
    provider, kind: 'ai', label, envVar, docs, keyOptional,
    secretLabel: 'API key',
    configFields: [
      { key: 'base_url', label: 'Base URL', placeholder: baseUrl || 'https://…/v1' },
      { key: 'default_model', label: 'Model lalai', placeholder: 'pilih selepas ujian sambungan' },
    ],
    models: [],
    capabilities: { jana_teks: 'tersedia' },

    async test(config, secret) {
      if (!validUrl(base(config))) return { ok: false, message: 'Base URL mesti https:// (atau http://localhost untuk penyedia setempat).' };
      try {
        const body = await call(`${base(config)}/models`, secret);
        const models = (body?.data || body?.models || []).map((m) => m.id || m.name).filter(Boolean).slice(0, 200);
        return { ok: true, message: `Sambungan berjaya. ${models.length} model tersedia.`, models };
      } catch (error) {
        return { ok: false, message: error.name === 'TimeoutError' ? 'Masa tamat semasa menghubungi penyedia.' : error.message };
      }
    },

    async generate(config, secret, { model, system, prompt }) {
      const id = model || config.default_model;
      if (!id) throw new Error('Model belum ditetapkan untuk penyedia ini.');
      const body = await call(`${base(config)}/chat/completions`, secret, {
        method: 'POST', timeoutMs: 300_000,
        body: JSON.stringify({ model: id, messages: [{ role: 'system', content: system }, { role: 'user', content: prompt }] }),
      });
      return {
        text: body?.choices?.[0]?.message?.content?.trim() || '',
        tokens_in: body?.usage?.prompt_tokens ?? 0, tokens_out: body?.usage?.completion_tokens ?? 0,
        cost: 0, // harga berbeza mengikut penyedia; tidak dianggar
        model: id,
      };
    },
  };
}

export default [
  make({ provider: 'openai', label: 'OpenAI (GPT)', envVar: 'OPENAI_API_KEY', baseUrl: 'https://api.openai.com/v1', docs: 'https://platform.openai.com/docs' }),
  make({ provider: 'deepseek', label: 'DeepSeek', envVar: 'DEEPSEEK_API_KEY', baseUrl: 'https://api.deepseek.com', docs: 'https://api-docs.deepseek.com' }),
  make({ provider: 'gemini', label: 'Google Gemini', envVar: 'GEMINI_API_KEY', baseUrl: 'https://generativelanguage.googleapis.com/v1beta/openai', docs: 'https://ai.google.dev/gemini-api/docs/openai' }),
  make({ provider: 'groq', label: 'Groq', envVar: 'GROQ_API_KEY', baseUrl: 'https://api.groq.com/openai/v1', docs: 'https://console.groq.com/docs' }),
  make({ provider: 'mistral', label: 'Mistral', envVar: 'MISTRAL_API_KEY', baseUrl: 'https://api.mistral.ai/v1', docs: 'https://docs.mistral.ai' }),
  make({ provider: 'xai', label: 'xAI (Grok)', envVar: 'XAI_API_KEY', baseUrl: 'https://api.x.ai/v1', docs: 'https://docs.x.ai' }),
  make({ provider: 'openrouter', label: 'OpenRouter (pelbagai model)', envVar: 'OPENROUTER_API_KEY', baseUrl: 'https://openrouter.ai/api/v1', docs: 'https://openrouter.ai/docs' }),
  make({ provider: 'ollama', label: 'Ollama (setempat)', envVar: 'OLLAMA_API_KEY', baseUrl: 'http://localhost:11434/v1', docs: 'https://ollama.com', keyOptional: true }),
  make({ provider: 'openai_compatible', label: 'Lain-lain (serasi OpenAI)', envVar: 'CUSTOM_AI_API_KEY', baseUrl: '' }),
];
