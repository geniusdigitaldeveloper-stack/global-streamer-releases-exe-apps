// Struktur i18n gaya gettext: teks Bahasa Melayu ialah kunci. Untuk menambah bahasa, isi kamus di
// ./locales/<kod>.ts dan daftarkannya di bawah. Teks tanpa terjemahan jatuh balik kepada Bahasa Melayu.
import en from './locales/en';

const dictionaries: Record<string, Record<string, string>> = { en };
export const LANGUAGES = [{ code: 'ms', label: 'Bahasa Melayu' }, { code: 'en', label: 'English (separa)' }];
let lang = localStorage.getItem('gd_lang') || 'ms';

export const getLang = () => lang;
export function setLang(code: string) { lang = code; localStorage.setItem('gd_lang', code); document.documentElement.lang = code; }
export const t = (text: string): string => (lang === 'ms' ? text : dictionaries[lang]?.[text] ?? text);
