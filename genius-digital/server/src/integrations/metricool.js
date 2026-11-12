// Connector pemasaran: Metricool.
//
// Disahkan daripada dokumentasi rasmi Metricool (help.metricool.com, "Basic Guide for API Integration"):
//   - Base URL  : https://app.metricool.com/api
//   - Pengesahan: header X-Mc-Auth: <token>, serta parameter userId dan blogId
//   - Akses API : pelan Advanced dan Custom sahaja
//   - Senarai jenama: GET /admin/simpleProfiles?userId=...
//   - Penjadualan wujud di /v2/scheduler/posts, TETAPI belum dilaksanakan di sini kerana skema badan
//     permintaan belum diuji dengan akaun sebenar. Jangan tandakan sebagai tersedia sehingga diuji.
const BASE = 'https://app.metricool.com/api';

async function call(pathname, config, secret) {
  const url = new URL(BASE + pathname);
  url.searchParams.set('userId', config.user_id);
  if (config.blog_id) url.searchParams.set('blogId', config.blog_id);
  const res = await fetch(url, { headers: { 'X-Mc-Auth': secret }, signal: AbortSignal.timeout(15_000) });
  if (res.status === 401 || res.status === 403) throw new Error('Token ditolak. Semak token dan pastikan pelan Metricool menyokong API (Advanced/Custom).');
  if (!res.ok) throw new Error(`Ralat API Metricool (${res.status}).`);
  return res.json();
}

export default {
  provider: 'metricool',
  kind: 'pemasaran',
  label: 'Metricool',
  envVar: 'METRICOOL_API_TOKEN',
  secretLabel: 'Token API',
  configFields: [
    { key: 'user_id', label: 'userId', placeholder: 'ID akaun Metricool' },
    { key: 'blog_id', label: 'blogId (jenama)', placeholder: 'ID jenama' },
  ],
  docs: 'https://help.metricool.com/basic-guide-for-api-integration-r97af',
  requirements: 'Pelan Metricool Advanced atau Custom; token API (Account Settings → API); userId dan blogId (daripada URL aplikasi Metricool).',
  capabilities: {
    sahkan_sambungan: 'tersedia',
    analitik: 'belum_dilaksanakan',
    draf: 'manual',
    jadual: 'belum_dilaksanakan',
    terbit: 'belum_dilaksanakan',
  },

  async test(config, secret) {
    if (!config.user_id) return { ok: false, message: 'userId belum diisi.' };
    try {
      const brands = await call('/admin/simpleProfiles', config, secret);
      const n = Array.isArray(brands) ? brands.length : 0;
      return { ok: true, message: `Sambungan berjaya. ${n} jenama ditemui dalam akaun.` };
    } catch (error) {
      return { ok: false, message: error.name === 'TimeoutError' ? 'Masa tamat semasa menghubungi Metricool.' : error.message };
    }
  },
};
