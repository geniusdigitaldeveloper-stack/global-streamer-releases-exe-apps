// Data seed awal. Semua rekod di sini boleh diedit atau dipadam melalui UI selepas dicipta.
// Tiada rahsia atau API key di sini. Tugasan/kelulusan contoh ditanda is_demo = 1.

export const PERMISSIONS = [
  ['lihat_dashboard', 'Lihat dashboard'],
  ['urus_staf', 'Urus staf & agent'],
  ['urus_tugasan', 'Urus tugasan'],
  ['lulus_tindakan', 'Luluskan tindakan agent'],
  ['urus_organisasi', 'Urus jabatan, peranan & akses ruang'],
  ['urus_polisi', 'Urus polisi & workflow'],
  ['urus_integrasi', 'Urus integrasi & rahsia'],
  ['urus_tetapan', 'Urus tetapan organisasi'],
  ['lihat_audit', 'Lihat log audit'],
];

export const ACTION_TYPES = [
  // [key, label, description, mode, controlled]
  ['rutin', 'Tugasan rutin', 'Kerja dalaman yang jelas dan berulang (ringkasan, semakan, laporan dalaman).', 'auto', 0],
  ['analitik', 'Baca analitik', 'Membaca data analitik platform tanpa mengubah apa-apa.', 'auto', 0],
  ['draf_kandungan', 'Sediakan draf kandungan', 'Menyediakan draf untuk semakan; tidak diterbitkan.', 'auto', 0],
  ['jadual_kandungan', 'Jadualkan kandungan', 'Menjadualkan kandungan ke platform luar.', 'kelulusan', 1],
  ['terbit_kandungan', 'Terbitkan kandungan', 'Menerbitkan kandungan kepada umum.', 'kelulusan', 1],
  ['deploy', 'Deploy sistem', 'Melancarkan perubahan kod atau konfigurasi ke persekitaran sebenar.', 'kelulusan', 1],
  ['komunikasi_luar', 'Komunikasi luar', 'Menghantar e-mel/mesej kepada pelanggan atau pihak luar.', 'kelulusan', 1],
  ['kewangan', 'Perubahan kewangan', 'Bayaran, invois, bajet atau sebarang perubahan kewangan.', 'kelulusan', 1],
  ['padam_data', 'Pemadaman data', 'Memadam data atau rekod.', 'kelulusan', 1],
  ['ubah_akses', 'Perubahan akses', 'Mengubah peranan, kebenaran atau akses.', 'kelulusan', 1],
];

const ROOMS = [
  // key, name, type, x0, z0, x1, z1, doors, walled, outdoor, private, description
  ['lobi', 'Lobi Utama', 'lobi', -10, 10, 10, 25, [{ side: 's', pos: 0, width: 5 }, { side: 'n', pos: 0, width: 7 }], 1, 0, 0, 'Pintu masuk utama dan kaunter penyambut tetamu.'],
  ['kafe', 'Kafe', 'kafe', -40, 10, -22, 25, [{ side: 'n', pos: -31, width: 3 }], 1, 0, 0, 'Kafe dan ruang makan.'],
  ['ruang_rehat', 'Ruang Rehat', 'rehat', -22, 10, -10, 25, [{ side: 'n', pos: -16, width: 2.4 }], 1, 0, 0, 'Ruang santai untuk semua staf.'],
  ['bilik_latihan', 'Bilik Latihan', 'latihan', 10, 10, 24, 25, [{ side: 'n', pos: 17, width: 2.4 }], 1, 0, 0, 'Latihan dan onboarding staf serta agent.'],
  ['jualan_sokongan', 'Jualan & Sokongan Pelanggan', 'jabatan', 24, 10, 40, 25, [{ side: 'n', pos: 32, width: 2.4 }], 1, 0, 0, 'Jabatan Sales dan Customer Support.'],
  ['koridor_selatan', 'Koridor Utama', 'koridor', -40, 6, 40, 10, [], 0, 0, 0, 'Koridor utama. Pintu kecemasan di hujung timur dan barat.'],
  ['studio_marketing', 'Studio Marketing', 'studio', -40, -8, -20, 6, [{ side: 's', pos: -30, width: 2.4 }], 1, 0, 0, 'Marketing, Social Media, Content dan Production.'],
  ['bilik_mesyuarat', 'Bilik Mesyuarat', 'mesyuarat', -20, -8, -8, 6, [{ side: 's', pos: -14, width: 2.4 }], 1, 0, 0, 'Mesyuarat pengurusan dan papan tugasan.'],
  ['laluan_barat', 'Laluan Penghubung Barat', 'koridor', -8, -8, -5, 6, [], 0, 0, 0, 'Menghubungkan dua koridor.'],
  ['pusat_operasi', 'Pusat Operasi', 'operasi', -5, -8, 10, 6, [{ side: 's', pos: 2.5, width: 2.4 }, { side: 'n', pos: 2.5, width: 2.4 }], 1, 0, 0, 'AI Operations dan Security.'],
  ['kejuruteraan', 'Kejuruteraan', 'jabatan', 10, -8, 21, 6, [{ side: 's', pos: 15.5, width: 2.4 }], 1, 0, 0, 'Jabatan Engineering.'],
  ['laluan_timur', 'Laluan Penghubung Timur', 'koridor', 21, -8, 24, 6, [], 0, 0, 0, 'Menghubungkan dua koridor.'],
  ['makmal', 'Makmal Penyelidikan', 'makmal', 24, -8, 40, 6, [{ side: 's', pos: 32, width: 2.4 }], 1, 0, 0, 'Jabatan Research.'],
  ['koridor_utara', 'Koridor Eksekutif', 'koridor', -40, -12, 40, -8, [], 0, 0, 0, 'Koridor utara. Pintu kecemasan di hujung timur dan barat.'],
  ['bilik_tidur', 'Bilik Tidur Peribadi', 'bilik_tidur', -40, -25, -32, -12, [{ side: 'e', pos: -18.5, width: 1.6 }], 1, 0, 1, 'Ruang peribadi CEO dan SALWANI. Tertutup.'],
  ['suite_rehat', 'Ruang Rehat Suite CEO', 'suite_rehat', -32, -25, -24, -12, [{ side: 'e', pos: -18.5, width: 1.8 }], 1, 0, 1, 'Ruang rehat peribadi dalam Suite CEO.'],
  ['pejabat_ceo', 'Pejabat CEO', 'pejabat_ceo', -24, -25, -12, -12, [{ side: 's', pos: -18, width: 2.4 }, { side: 'e', pos: -20, width: 1.8 }], 1, 0, 0, 'Ruang kerja CEO dan kiosk kelulusan.'],
  ['ruang_salwani', 'Ruang SALWANI', 'pejabat_pa', -12, -25, -2, -12, [{ side: 's', pos: -7, width: 2.4 }], 1, 0, 0, 'Pejabat PA / Executive Assistant CEO.'],
  ['korporat', 'Jabatan Korporat', 'jabatan', -2, -25, 14, -12, [{ side: 's', pos: 6, width: 2.4 }], 1, 0, 0, 'Finance, HR dan Compliance.'],
  ['tandas', 'Tandas', 'tandas', 14, -25, 22, -12, [{ side: 's', pos: 18, width: 1.8 }], 1, 0, 0, 'Kemudahan asas.'],
  ['surau', 'Surau', 'surau', 22, -25, 30, -12, [{ side: 's', pos: 26, width: 1.8 }], 1, 0, 0, 'Ruang solat.'],
  ['utiliti', 'Bilik Server & Utiliti', 'utiliti', 30, -25, 40, -12, [{ side: 's', pos: 35, width: 1.8 }], 1, 0, 0, 'Server, elektrik dan stor. Akses terhad.'],
  ['dropoff', 'Drop-off & Pintu Masuk', 'dropoff', -16, 26, 16, 44, [], 0, 1, 0, 'Kanopi drop-off di hadapan lobi.'],
  ['parkir', 'Tempat Letak Kereta', 'parkir', 48, -6, 88, 44, [], 0, 1, 0, 'Parkir staf dan pelawat.'],
  ['taman', 'Taman Landskap', 'taman', -88, -6, -48, 44, [], 0, 1, 0, 'Taman, laluan pejalan kaki dan titik berkumpul kecemasan.'],
  ['pantai', 'Laguna & Pantai Buatan', 'pantai', -70, -92, 70, -30, [], 0, 1, 0, 'Kawasan rekreasi tepi air kampus.'],
];

const DEPARTMENTS = [
  // name, description, room key, color
  ['Pejabat CEO', 'Pengurusan eksekutif.', 'ruang_salwani', '#c9a45c'],
  ['AI Operations', 'Mengurus operasi dan prestasi agent AI.', 'pusat_operasi', '#4f9dde'],
  ['Research', 'Penyelidikan pasaran dan teknologi.', 'makmal', '#7a6cf0'],
  ['Marketing', 'Strategi dan kempen pemasaran.', 'studio_marketing', '#e0723c'],
  ['Social Media', 'Pengurusan media sosial.', 'studio_marketing', '#e04f8a'],
  ['Content', 'Penulisan dan perancangan kandungan.', 'studio_marketing', '#d9a520'],
  ['Production', 'Penerbitan video dan kreatif.', 'studio_marketing', '#b85cd6'],
  ['Sales', 'Jualan dan pembangunan perniagaan.', 'jualan_sokongan', '#2fa36b'],
  ['Customer Support', 'Sokongan pelanggan.', 'jualan_sokongan', '#2bb3b1'],
  ['Engineering', 'Pembangunan perisian.', 'kejuruteraan', '#5a7bd8'],
  ['Finance', 'Kewangan dan perakaunan.', 'korporat', '#3f9c4a'],
  ['HR', 'Sumber manusia.', 'korporat', '#d86a6a'],
  ['Compliance', 'Pematuhan dan polisi.', 'korporat', '#8a8f98'],
  ['Security', 'Keselamatan maklumat.', 'pusat_operasi', '#c0392b'],
];

const base = ['rutin', 'analitik', 'draf_kandungan'];
const AGENTS = [
  // name, kind, avatar, role_title, role key, department, description, skills, extra actions, tools
  ['SALWANI', 'staf', 'wanita_tudung_a', 'PA / Executive Assistant CEO', 'pa', 'Pejabat CEO',
    'Pembantu eksekutif CEO. Menyelaras jadual, menyaring permintaan dan menyediakan ringkasan untuk keputusan CEO.',
    ['Penyelarasan jadual', 'Ringkasan eksekutif', 'Susulan tugasan'], ['komunikasi_luar'], ['kalendar', 'dokumen', 'e-mel (draf)']],
  ['Hakim', 'agent', 'lelaki_a', 'Pengurus Operasi AI', 'agent', 'AI Operations',
    'Memantau prestasi agent, kos penggunaan dan kesihatan workflow.', ['Pemantauan', 'Analisis kos', 'Automasi'], [], ['dashboard', 'log']],
  ['Farah', 'agent', 'wanita_tudung_b', 'Penganalisis Penyelidikan', 'agent', 'Research',
    'Menjalankan penyelidikan pasaran dan merumuskan dapatan bersama sumber.', ['Penyelidikan', 'Analisis pesaing', 'Ringkasan'], [], ['carian web', 'dokumen']],
  ['Imran', 'agent', 'lelaki_b', 'Strategis Pemasaran', 'agent', 'Marketing',
    'Merancang kempen dan menilai prestasi saluran pemasaran.', ['Strategi kempen', 'Analitik', 'Positioning'], ['jadual_kandungan'], ['analitik', 'dokumen', 'Claude Code (video)', 'ChatGPT (poster)', 'Gemini (web/kanvas)', 'Flow AI (video)']],
  ['Aina', 'agent', 'wanita_tudung_c', 'Eksekutif Media Sosial', 'agent', 'Social Media',
    'Menyediakan draf hantaran, menjadual dan memantau interaksi media sosial.', ['Kapsyen', 'Penjadualan', 'Pengurusan komuniti'], ['jadual_kandungan', 'terbit_kandungan'], ['penjadual sosial', 'analitik', 'ChatGPT (poster)', 'Claude Code (video)']],
  ['Nadia', 'agent', 'wanita_a', 'Penulis Kandungan', 'agent', 'Content',
    'Menulis artikel, skrip dan e-mel pemasaran.', ['Penulisan', 'SEO', 'Skrip video'], [], ['dokumen', 'Claude Code (video)', 'ChatGPT (poster)', 'Gemini (web/kanvas)', 'Flow AI (video)']],
  ['Zulkifli', 'agent', 'lelaki_c', 'Penerbit Kreatif', 'agent', 'Production',
    'Menyelaras penerbitan video dan aset kreatif.', ['Storyboard', 'Suntingan', 'Senarai syot'], [], ['dokumen', 'storan aset', 'Claude Code (video)', 'Flow AI (video)']],
  ['Daniel', 'agent', 'lelaki_a', 'Eksekutif Jualan', 'agent', 'Sales',
    'Mengurus prospek dan menyediakan cadangan jualan.', ['Prospek', 'Cadangan', 'Susulan'], ['komunikasi_luar'], ['CRM', 'e-mel (draf)']],
  ['Mei Ling', 'agent', 'wanita_b', 'Eksekutif Sokongan Pelanggan', 'agent', 'Customer Support',
    'Menjawab pertanyaan pelanggan dan mengeskalasi isu.', ['Sokongan', 'Dokumentasi', 'Eskalasi'], ['komunikasi_luar'], ['tiket', 'pangkalan pengetahuan']],
  ['Arjun', 'agent', 'lelaki_b', 'Jurutera Perisian', 'agent', 'Engineering',
    'Membangun dan menyelenggara sistem dalaman.', ['Pembangunan', 'Semakan kod', 'Ujian'], ['deploy'], ['repositori', 'CI']],
  ['Rohana', 'agent', 'wanita_tudung_a', 'Penganalisis Kewangan', 'agent', 'Finance',
    'Menyediakan laporan kewangan dan semakan bajet.', ['Laporan', 'Bajet', 'Ramalan'], ['kewangan'], ['hamparan', 'laporan']],
  ['Siti', 'agent', 'wanita_tudung_b', 'Eksekutif Sumber Manusia', 'agent', 'HR',
    'Mengurus onboarding dan rekod staf.', ['Onboarding', 'Polisi HR', 'Latihan'], [], ['dokumen']],
  ['Kamal', 'agent', 'lelaki_c', 'Pegawai Pematuhan', 'agent', 'Compliance',
    'Menyemak kandungan dan tindakan terhadap polisi syarikat.', ['Semakan polisi', 'Risiko', 'Audit'], [], ['dokumen', 'log audit']],
  ['Ravi', 'agent', 'lelaki_a', 'Penganalisis Keselamatan', 'agent', 'Security',
    'Memantau akses dan insiden keselamatan.', ['Pemantauan akses', 'Tindak balas insiden'], ['ubah_akses'], ['log', 'pengurusan akses']],
];

const PLATFORMS = [
  ['facebook', 'Facebook', 1], ['instagram', 'Instagram', 1], ['tiktok', 'TikTok', 1], ['youtube', 'YouTube', 1],
  ['linkedin', 'LinkedIn', 0], ['x', 'X (Twitter)', 0], ['threads', 'Threads', 0], ['pinterest', 'Pinterest', 0],
  ['google_business', 'Google Business Profile', 0], ['bluesky', 'Bluesky', 0],
];

export function seed(db) {
  const now = new Date().toISOString();
  const ins = (table, obj) => {
    const k = Object.keys(obj);
    return Number(db.prepare(`INSERT INTO ${table} (${k.join(',')}) VALUES (${k.map(() => '?').join(',')})`).run(...k.map((x) => obj[x])).lastInsertRowid);
  };
  db.exec('BEGIN');
  try {
    const allPerms = PERMISSIONS.map((p) => p[0]);
    const roles = {};
    for (const [key, name, description, permissions, is_system] of [
      ['ceo', 'CEO', 'Pemilik dan pembuat keputusan utama. Semua kebenaran.', allPerms, 1],
      ['pa', 'PA / Executive Assistant', 'Pembantu eksekutif CEO.', ['lihat_dashboard', 'urus_tugasan'], 1],
      ['pengurus', 'Pengurus Jabatan', 'Mengurus tugasan jabatan.', ['lihat_dashboard', 'urus_tugasan'], 0],
      ['staf', 'Staf', 'Staf biasa.', [], 0],
      ['agent', 'AI Agent', 'Peranan lalai untuk agent AI.', [], 1],
      ['pelawat', 'Pelawat', 'Akses ruang awam sahaja.', [], 1],
    ]) roles[key] = ins('roles', { key, name, description, permissions: JSON.stringify(permissions), is_system });

    const rooms = {};
    for (const [key, name, type, x0, z0, x1, z1, doors, walled, outdoor, is_private, description] of ROOMS)
      rooms[key] = ins('rooms', { key, name, type, x0, z0, x1, z1, doors: JSON.stringify(doors), walled, outdoor, is_private, description });

    const everyone = Object.keys(roles);
    const internal = ['ceo', 'pa', 'pengurus', 'staf', 'agent'];
    const access = {
      bilik_tidur: ['ceo', 'pa'], suite_rehat: ['ceo', 'pa'], pejabat_ceo: ['ceo', 'pa'],
      ruang_salwani: ['ceo', 'pa', 'pengurus'], utiliti: ['ceo', 'pengurus'],
      studio_marketing: internal, pusat_operasi: internal, kejuruteraan: internal, makmal: internal,
      korporat: internal, jualan_sokongan: internal, bilik_latihan: internal,
    };
    for (const key of Object.keys(rooms))
      for (const r of access[key] || everyone) ins('room_access', { room_id: rooms[key], role_id: roles[r] });

    const depts = {};
    for (const [name, description, room, color] of DEPARTMENTS)
      depts[name] = ins('departments', { name, description, room_id: rooms[room], color });

    ACTION_TYPES.forEach(([action_type, label, description, mode, controlled], i) =>
      ins('policies', { action_type, label, description, mode, controlled, sort: i }));

    const plats = {};
    for (const [key, name, enabled] of PLATFORMS) plats[key] = ins('platforms', { key, name, enabled });

    const anthropic = ins('connectors', { provider: 'anthropic', name: 'Anthropic (Claude)', config: JSON.stringify({ default_model: 'claude-opus-5-5' }) });
    ins('connectors', { provider: 'openai', name: 'OpenAI (GPT)', config: JSON.stringify({ base_url: 'https://api.openai.com/v1', default_model: '' }) });
    ins('connectors', { provider: 'deepseek', name: 'DeepSeek', config: JSON.stringify({ base_url: 'https://api.deepseek.com', default_model: '' }) });
    ins('connectors', { provider: 'metricool', name: 'Metricool', config: JSON.stringify({ user_id: '', blog_id: '' }) });

    const gemini = ins('connectors', { provider: 'gemini', name: 'Google Gemini', config: JSON.stringify({ base_url: 'https://generativelanguage.googleapis.com/v1beta/openai', default_model: '' }) });
    const openai = db.prepare("SELECT id FROM connectors WHERE provider = 'openai'").get().id;
    // Jenis kerja → alat AI yang ditetapkan (boleh diedit di UI).
    const VIDEO_GUIDE = `Analisis video dahulu (tema, tempo, ada suara bercakap atau tidak, format menegak/melintang), kemudian pilih gaya suntingan dan skill repo yang sepadan:
- Tidak pasti / hujung-ke-hujung → skill video-auto-pipeline (pilih antara Remotion, Hyperframes, Higgsfield, Canva/Figma; sahkan kos kredit Higgsfield sebelum menjana).
- Infografik / penerangan data → video-2d-infographic-style + video-storyboard.
- Video pendek (Reels/TikTok/Shorts) → short-form-video-script + video-hook-library + shot-list.
- Skrip Bahasa Melayu → video-script-bm; suara latar → voiceover-script.
- Binaan Remotion → video-remotion-builder (komponen di templates/video/remotion/).
- Ada suara bercakap → video-sound-and-captions + video-subtitle-style: sari kata Poppins SemiBold 600, warna #38BDF8, perkataan Inggeris italic, teks Arab font Traditional Arabic.
- Thumbnail & tajuk → video-thumbnail-title; jadual kandungan → video-content-calendar.
Hasilkan brief kerja yang boleh terus dijalankan dalam Claude Code di dalam repo yang disenaraikan.`;
    [
      ['umum', 'Kerja umum / teks', 'ai', anthropic, 'claude-opus-5-5', ''],
      ['suntingan_video', 'Suntingan video', 'claude_code', anthropic, 'claude-opus-5-5', VIDEO_GUIDE],
      ['poster', 'Poster & grafik', 'ai', openai, '', 'Sediakan brief reka bentuk poster dan prompt imej terperinci (saiz, gaya, warna jenama, teks pada poster). Penjanaan imej automatik belum disambungkan — gunakan prompt ini dalam ChatGPT.'],
      ['laman_web', 'Laman web & kanvas', 'ai', gemini, '', 'Hasilkan struktur halaman, salinan dan kod/kanvas yang diperlukan.'],
      ['jana_video', 'Jana video AI', 'flow', null, '', 'Sediakan prompt syot demi syot (subjek, pergerakan kamera, pencahayaan, tempoh, nisbah aspek) untuk dijana dalam Flow AI.'],
    ].forEach(([key, label, tool, connector_id, model, guidance], i) => ins('work_types', { key, label, tool, connector_id, model, guidance, sort: i }));

    const agents = {};
    for (const [name, kind, avatar, role_title, role, dept, description, skills, extra, tools] of AGENTS) {
      agents[name] = ins('agents', {
        name, kind, avatar, role_title, role_id: roles[role], department_id: depts[dept], description,
        skills: JSON.stringify(skills),
        instructions: `Anda ialah ${name}, ${role_title} di GENIUS DIGITAL. Jawab dalam Bahasa Melayu yang profesional. Jika arahan tidak jelas atau di luar skop, nyatakan dengan jelas dan minta kelulusan.`,
        connector_id: anthropic, model: 'claude-opus-5-5', schedule: 'Isnin–Jumaat, 9:00–18:00',
        allowed_tools: JSON.stringify(tools), allowed_actions: JSON.stringify([...base, ...extra]),
        status: 'aktif', is_demo: kind === 'agent' ? 1 : 0, created_at: now, updated_at: now,
      });
    }
    for (const p of ['facebook', 'instagram', 'tiktok'])
      ins('agent_platforms', { agent_id: agents.Aina, platform_id: plats[p], analitik: 1, draf: 1, jadual: 1, terbit: 0 });
    for (const p of ['facebook', 'instagram', 'tiktok', 'youtube'])
      ins('agent_platforms', { agent_id: agents.Imran, platform_id: plats[p], analitik: 1, draf: 0, jadual: 0, terbit: 0 });

    // Tugasan contoh (DEMO).
    const task = (o) => {
      const id = ins('tasks', { is_demo: 1, created_by: 'seed-demo', created_at: now, updated_at: now, ...o });
      ins('task_events', { task_id: id, ts: now, actor: 'seed-demo', event: 'dicipta', detail: 'Tugasan contoh (demo).' });
      return id;
    };
    task({ title: 'Ringkasan mingguan prestasi agent', description: 'Sediakan ringkasan penggunaan dan status tugasan minggu ini.', department_id: depts['AI Operations'], agent_id: agents.Hakim, action_type: 'rutin', status: 'diagihkan', success_criteria: 'Ringkasan satu halaman dengan 5 metrik utama.' });
    task({ title: 'Draf kapsyen kempen Raya', description: 'Tiga variasi kapsyen untuk Instagram.', department_id: depts['Social Media'], agent_id: agents.Aina, action_type: 'draf_kandungan', platform_id: plats.instagram, status: 'berjalan', result_is_simulation: 1, result: '[SIMULASI] Draf contoh — bukan hasil kerja AI sebenar.', success_criteria: 'Tiga kapsyen, setiap satu bawah 150 patah perkataan.' });
    task({ title: 'Analisis tiga pesaing utama', description: 'Bandingkan harga dan tawaran pesaing.', department_id: depts.Research, agent_id: agents.Farah, action_type: 'rutin', status: 'baharu', priority: 'tinggi', success_criteria: 'Jadual perbandingan dengan sumber.' });
    task({ title: 'Kemas kini FAQ sokongan', description: 'Semak 10 soalan lazim terbaru.', department_id: depts['Customer Support'], agent_id: agents['Mei Ling'], action_type: 'rutin', status: 'selesai', result_is_simulation: 1, result: '[SIMULASI] Hasil contoh.', success_criteria: '10 jawapan disemak.' });
    const t1 = task({ title: 'Terbitkan hantaran promosi di Instagram', description: 'Terbitkan hantaran promosi produk baharu.', department_id: depts['Social Media'], agent_id: agents.Aina, action_type: 'terbit_kandungan', platform_id: plats.instagram, status: 'menunggu_kelulusan', priority: 'tinggi', evidence: 'Draf kapsyen dan visual disemak oleh Nadia.', success_criteria: 'Hantaran diterbitkan pada waktu puncak.' });
    const t2 = task({ title: 'Bayar invois vendor video', description: 'Bayaran RM 4,500 kepada vendor penerbitan.', department_id: depts.Finance, agent_id: agents.Rohana, action_type: 'kewangan', status: 'menunggu_kelulusan', impact: 'penting', evidence: 'Invois INV-DEMO-001 dilampirkan.' });
    const t3 = task({ title: 'E-mel susulan kepada prospek', description: 'Hantar e-mel susulan kepada prospek.', department_id: depts.Sales, agent_id: agents.Daniel, action_type: 'komunikasi_luar', status: 'menunggu_kelulusan', clear_instructions: 0 });
    const appr = (task_id, agent, action_type, proposal, context, evidence, risk, reasons) =>
      ins('approvals', { task_id, agent_id: agents[agent], action_type, proposal, context, evidence, risk, reasons: JSON.stringify(reasons), is_demo: 1, created_at: now });
    appr(t1, 'Aina', 'terbit_kandungan', 'Terbitkan hantaran promosi produk baharu di Instagram pada 8:30 malam.', 'Kempen pelancaran produk. Draf telah disediakan.', 'Draf kapsyen dan visual disemak oleh Nadia.', 'sederhana',
      [{ code: 'polisi_kelulusan', text: 'Polisi menetapkan "Terbitkan kandungan" memerlukan kelulusan.' }]);
    appr(t2, 'Rohana', 'kewangan', 'Luluskan bayaran RM 4,500 kepada vendor penerbitan video.', 'Bayaran bulanan vendor.', 'Invois INV-DEMO-001 dilampirkan.', 'tinggi',
      [{ code: 'polisi_kelulusan', text: 'Polisi menetapkan "Perubahan kewangan" memerlukan kelulusan.' }, { code: 'kesan_penting', text: 'Tindakan mempunyai kesan penting.' }]);
    appr(t3, 'Daniel', 'komunikasi_luar', 'Hantar e-mel susulan kepada prospek.', 'Prospek daripada pameran bulan lepas.', '', 'sederhana',
      [{ code: 'polisi_kelulusan', text: 'Polisi menetapkan "Komunikasi luar" memerlukan kelulusan.' }, { code: 'arahan_tidak_jelas', text: 'Arahan tidak jelas: penerima dan kandungan tidak dinyatakan.' }, { code: 'bukti_tidak_cukup', text: 'Bukti tidak mencukupi.' }]);

    ins('workflows', {
      name: 'Penerbitan kandungan media sosial', description: 'Daripada idea hingga penerbitan, dengan kelulusan CEO sebelum terbit.', is_demo: 1,
      steps: JSON.stringify([
        { name: 'Sediakan draf', department: 'Content', action_type: 'draf_kandungan', approval: false },
        { name: 'Semakan pematuhan', department: 'Compliance', action_type: 'rutin', approval: false },
        { name: 'Jadualkan hantaran', department: 'Social Media', action_type: 'jadual_kandungan', approval: true },
        { name: 'Terbitkan', department: 'Social Media', action_type: 'terbit_kandungan', approval: true },
      ]),
    });
    ins('workflows', {
      name: 'Bayaran vendor', description: 'Semakan invois dan kelulusan bayaran.', is_demo: 1,
      steps: JSON.stringify([
        { name: 'Semak invois', department: 'Finance', action_type: 'rutin', approval: false },
        { name: 'Luluskan bayaran', department: 'Finance', action_type: 'kewangan', approval: true },
      ]),
    });

    const setting = (k, v) => ins('settings', { key: k, value: JSON.stringify(v) });
    setting('org', { name: 'GENIUS DIGITAL', ceo_name: 'CEO', language: 'ms', timezone: 'Asia/Kuala_Lumpur', currency_note: 'Kos AI dianggar dalam USD' });
    setting('demo_mode', true);
    setting('confidence_threshold', 0.8);
    setting('org_monthly_cost_limit', 200);
    setting('repos', [{ name: 'global-streamer-releases-exe-apps', location: 'geniusdigitaldeveloper-stack/global-streamer-releases-exe-apps', purpose: 'Skill Pekaya (.claude/skills), templat video dan komponen Remotion (templates/video/remotion).' }]);
    setting('seeded', now);
    ins('audit', { ts: now, actor: 'sistem', action: 'seed', entity: 'sistem', outcome: 'berjaya', reason: 'Data awal dan data demo dimuatkan.', is_demo: 1 });
    db.exec('COMMIT');
  } catch (e) { db.exec('ROLLBACK'); throw e; }
}
