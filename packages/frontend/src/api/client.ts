import { useAuthStore } from '../stores/authStore'
import { config } from '../config'

const AUTH_URL = config.authUrl

/** Fetch wrapper that attaches Bearer token and handles 401 auto-refresh. */
export async function authFetch(input: string, init?: RequestInit): Promise<Response> {
  const { accessToken } = useAuthStore.getState()

  const headers = new Headers(init?.headers)
  if (accessToken) {
    headers.set('Authorization', `Bearer ${accessToken}`)
  }

  let res = await fetch(input, { ...init, headers })

  if (res.status === 401 && accessToken) {
    // Attempt to refresh.
    const refreshed = await tryRefresh()
    if (refreshed) {
      const { accessToken: newToken } = useAuthStore.getState()
      headers.set('Authorization', `Bearer ${newToken}`)
      res = await fetch(input, { ...init, headers })
    } else {
      useAuthStore.getState().clearAuth()
    }
  }

  return res
}

async function tryRefresh(): Promise<boolean> {
  const { refreshToken } = useAuthStore.getState()
  if (!refreshToken || !AUTH_URL) return false

  try {
    const res = await fetch(`${AUTH_URL}/auth/refresh`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ refreshToken }),
    })

    if (!res.ok) return false

    const data = await res.json()
    useAuthStore.getState().setAuth(data.user, data.accessToken, data.refreshToken)
    return true
  } catch {
    return false
  }
}
