import type { AuthResponse, User } from '@godseye/shared'

const AUTH_URL = import.meta.env.VITE_AUTH_URL as string | undefined

function authUrl(path: string): string {
  if (!AUTH_URL) throw new Error('VITE_AUTH_URL is not configured')
  return `${AUTH_URL}${path}`
}

export async function register(
  email: string,
  password: string,
  name: string,
): Promise<AuthResponse> {
  const res = await fetch(authUrl('/auth/register'), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password, name }),
  })

  if (!res.ok) {
    const data = await res.json().catch(() => ({}))
    throw new Error(data.error || 'Registration failed')
  }

  return res.json()
}

export async function login(email: string, password: string): Promise<AuthResponse> {
  const res = await fetch(authUrl('/auth/login'), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password }),
  })

  if (!res.ok) {
    const data = await res.json().catch(() => ({}))
    throw new Error(data.error || 'Login failed')
  }

  return res.json()
}

export async function refreshTokens(refreshToken: string): Promise<AuthResponse> {
  const res = await fetch(authUrl('/auth/refresh'), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ refreshToken }),
  })

  if (!res.ok) {
    const data = await res.json().catch(() => ({}))
    throw new Error(data.error || 'Token refresh failed')
  }

  return res.json()
}

/**
 * Redeems the single-use authorization code from an OAuth redirect for a token
 * pair. The code is worthless once used, so it is safe to carry in the URL.
 */
export async function exchangeOAuthCode(code: string): Promise<AuthResponse> {
  const res = await fetch(authUrl('/auth/oauth/exchange'), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ code }),
  })

  if (!res.ok) {
    const data = await res.json().catch(() => ({}))
    throw new Error(data.error || 'OAuth code exchange failed')
  }

  return res.json()
}

export async function logout(refreshToken: string): Promise<void> {
  await fetch(authUrl('/auth/logout'), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ refreshToken }),
  })
}

export async function getMe(accessToken: string): Promise<{ user: User }> {
  const res = await fetch(authUrl('/auth/me'), {
    headers: { Authorization: `Bearer ${accessToken}` },
  })

  if (!res.ok) {
    const data = await res.json().catch(() => ({}))
    throw new Error(data.error || 'Failed to fetch user')
  }

  return res.json()
}
