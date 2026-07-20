import { useEffect, useRef } from 'react'
import { exchangeOAuthCode } from '../../api/auth'
import { useAuthStore } from '../../stores/authStore'

/**
 * Reads the single-use authorization code from the OAuth redirect, exchanges it
 * for a token pair, and stores the auth state. Tokens never appear in the URL —
 * only the code does, and it is consumed server-side on first use.
 */
export default function OAuthCallback() {
  const setAuth = useAuthStore((s) => s.setAuth)
  const processed = useRef(false)

  useEffect(() => {
    if (processed.current) return
    processed.current = true

    const params = new URLSearchParams(window.location.search)
    const code = params.get('code')

    // Clean the URL before the network call so a reload can't retry a spent code.
    window.history.replaceState({}, '', '/')

    if (!code) return

    exchangeOAuthCode(code)
      .then(({ user, accessToken, refreshToken }) => {
        setAuth(user, accessToken, refreshToken)
      })
      .catch(() => {
        // Code was already used, expired, or the auth service is down — the user
        // stays signed out and can retry from the sign-in button.
      })
  }, [setAuth])

  return null
}
