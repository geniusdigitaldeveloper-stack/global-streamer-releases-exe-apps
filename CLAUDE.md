# Project guidance

This repo carries the shared Pekaya skill set in `.claude/skills/` (index: `.claude/skills/INDEX.md`):
18 prompt skills (research, summary, ideas, strategy, marketing, content, social, YouTube script, email,
code, debug, website, presentation, learning plan, automation, personas, competitors, custom workflow)
plus video skills (`video-2d-infographic-style`, `video-storyboard`, `shot-list`, `short-form-video-script`, `voiceover-script`, `video-thumbnail-title`, `video-content-calendar`) with templates in `.claude/templates/video/`.
Extra BM video skills: `video-script-bm`, `video-hook-library`, `video-remotion-builder`, `video-sound-and-captions`, with Remotion components in `templates/video/remotion/`.

Video tools have **no default**: auto-pick per task between **Higgsfield MCP** (`.mcp.json`, guide `docs/higgsfield-mcp.md`; AI images, video, voice, upscale, ads), **Hyperframes**, **Remotion** and Canva/Figma, combining them as needed. Use `video-auto-pipeline`; always confirm Higgsfield credit cost before generating.

- Use the matching skill whenever the user's request fits; adapt it to context rather than copying it rigidly.
- Reply in the user's language (Bahasa Melayu / English).
- When creating a NEW repo, run `.claude/scripts/sync-skills.sh <new-repo-path>` to copy these skills into it.

Also included: 52 marketing skills from marketingskills (start with `product-marketing`; upstream `marketing-plan` is `marketing-plan-corey`) and `free-llm-apis`. Sources: `.claude/skills/SOURCES.md`.

Also included: Anthropic cloud skills (`docs`, `docx`, `pdf`, `pptx`, `xlsx`, `google-workspace`, `import-memory`, `morning`, `setup-writing-style`, `skill-creator`, `session-start-hook`).

## New repos (important)
Every NEW repo must get these skills: run `.claude/scripts/sync-skills.sh <new-repo-path>` right after creating/cloning it (it only adds missing skills, never overwrites) and commit the result. For an existing repo with a different skill set, run it again to top up.

## Gaya subtitle tetap (semua video)
Setiap video yang ada suara user bercakap (Hyperframes, Remotion, infografik, ffmpeg, apa-apa): subtitle ucapan = **Poppins SemiBold (600)**, warna **biru air cerah `#38BDF8`**, **perkataan Inggeris (contoh *actually*) dalam italic**, dan **teks Bahasa Arab dalam font Traditional Arabic (regular, tanpa bold/italic, warna sama `#38BDF8`)**. Ini hanya untuk subtitle ucapan, bukan font infografik. Butiran: skill `video-subtitle-style`, komponen `templates/video/remotion/Subtitle.tsx`.

## Integrasi Metricool (MCP)

### Sambungan
1. Guna OAuth standard dengan dynamic client registration (DCR) dan PKCE.
2. Scope yang ada hanya `mcp:read` dan `mcp:write`. Tiada scope yang lebih sempit.
3. Setiap pengguna sambung akaun Metricool mereka sendiri. App bertindak bagi pihak pengguna dan hanya boleh akses jenama dan kebenaran yang pengguna itu dah ada dalam Metricool.
4. Had penggunaan ikut pelan Metricool setiap pengguna. Tiada kuota MCP berasingan untuk app ini.
5. Status app: Unverified. Pengguna akan nampak amaran "Unverified application" semasa beri kebenaran. Ini dijangka, jadi jangan cuba elak atau sembunyikan amaran itu.

### Had tindakan dalam kod
6. Walaupun `mcp:write` memberi akses tulis yang luas, app ini hanya dibenarkan buat dua tindakan: jadualkan post dan baca post yang dijadualkan.
7. Jangan panggil tool Metricool yang lain, dan jangan tambah tindakan baru tanpa saya minta.

### Keselamatan
8. Simpan token pengguna dengan selamat di sisi server. Jangan simpan dalam kod, jangan hantar ke browser, dan jangan tulis token dalam log.
9. Kendalikan token tamat tempoh atau kebenaran yang ditarik balik dengan mesej yang jelas kepada pengguna, dan minta mereka sambung semula.
10. Jangan guna nama atau logo Metricool dalam app sehingga Metricool beri kebenaran bertulis.

### Alamat app dan OAuth
11. Alamat app: https://streamer-editor.web.app
12. OAuth redirect URI: https://streamer-editor.web.app/oauth-callback.html. Guna alamat ini sahaja semasa pendaftaran klien (DCR) dan permintaan kebenaran. Ia mesti sama betul-betul dengan yang saya dah beritahu Metricool.
