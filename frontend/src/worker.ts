type AssetsBinding = {
  fetch(input: Request | string, init?: RequestInit): Promise<Response>
}

type Env = {
  ASSETS: AssetsBinding
}

const CONTENT_SECURITY_POLICY = [
  "default-src 'self'",
  "base-uri 'none'",
  "object-src 'none'",
  "frame-ancestors 'none'",
  "form-action 'self'",
  "script-src 'self'",
  "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
  "font-src 'self' https://fonts.gstatic.com",
  "img-src 'self' data: blob:",
  "connect-src 'self' https://quantsim-vjul.onrender.com",
].join('; ')

function withSecurityHeaders(response: Response): Response {
  const headers = new Headers(response.headers)
  headers.set('Content-Security-Policy', CONTENT_SECURITY_POLICY)
  headers.set('X-Content-Type-Options', 'nosniff')
  headers.set('X-Frame-Options', 'DENY')
  headers.set('Referrer-Policy', 'strict-origin-when-cross-origin')
  headers.set('Permissions-Policy', 'camera=(), geolocation=(), microphone=()')
  headers.set('Cross-Origin-Opener-Policy', 'same-origin')

  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers,
  })
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    return withSecurityHeaders(await env.ASSETS.fetch(request))
  },
}
