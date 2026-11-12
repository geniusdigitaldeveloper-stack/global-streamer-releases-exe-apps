// Klien API. Semua rahsia kekal di backend; browser hanya menerima status.
export class ApiError extends Error { constructor(public status: number, message: string) { super(message); } }

export async function api<T = any>(path: string, method = 'GET', body?: unknown): Promise<T> {
  let res: Response;
  try {
    res = await fetch(`/api${path}`, { method, credentials: 'same-origin', headers: body !== undefined ? { 'Content-Type': 'application/json' } : undefined, body: body !== undefined ? JSON.stringify(body) : undefined });
  } catch { throw new ApiError(0, 'Tidak dapat menghubungi pelayan. Pastikan backend sedang berjalan.'); }
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new ApiError(res.status, data?.error || `Ralat ${res.status}`);
  return data as T;
}
export const post = <T = any>(path: string, body: unknown = {}) => api<T>(path, 'POST', body);
export const put = <T = any>(path: string, body: unknown = {}) => api<T>(path, 'PUT', body);
export const del = <T = any>(path: string) => api<T>(path, 'DELETE');

export interface Session { name: string; role: string; role_name: string; permissions: string[]; secured: boolean }
