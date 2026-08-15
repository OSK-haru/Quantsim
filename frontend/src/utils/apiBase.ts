/**
 * Resolves API paths against `VITE_API_BASE_URL` when set.
 *
 * Local dev (Vite proxy) and the desktop-app launcher serve the frontend and
 * API from the same origin, so relative `/api/...` paths work with no env
 * var. The hosted web demo builds the frontend and API on separate origins
 * (Cloudflare Pages + Render), so that build sets `VITE_API_BASE_URL` to the
 * API's origin.
 */
export function apiUrl(path: string): string {
  const base = import.meta.env.VITE_API_BASE_URL ?? ''
  return base ? `${base.replace(/\/$/, '')}${path}` : path
}
