import { useEffect, useState } from 'react'
import { login } from '../../api/auth'
import { useAuthStore } from '../../stores/authStore'

const AUTH_URL = import.meta.env.VITE_AUTH_URL as string | undefined

interface LoginPageProps {
  onSwitchToRegister: () => void
  onClose: () => void
}

export default function LoginPage({ onSwitchToRegister, onClose }: LoginPageProps) {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const setAuth = useAuthStore((s) => s.setAuth)

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [onClose])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setLoading(true)

    try {
      const data = await login(email, password)
      setAuth(data.user, data.accessToken, data.refreshToken)
      onClose()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Login failed')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60">
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="login-title"
        className="w-full max-w-sm rounded-lg bg-gray-900 p-4 shadow-xl sm:p-6"
      >
        <div className="mb-4 flex items-center justify-between">
          <h2 id="login-title" className="text-lg font-semibold text-white">Sign In</h2>
          <button onClick={onClose} aria-label="Close" className="text-gray-400 hover:text-white">
            &times;
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          {error && <p className="text-sm text-red-400">{error}</p>}

          <input
            type="email"
            placeholder="Email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            className="w-full rounded bg-gray-800 px-3 py-2 text-sm text-white placeholder-gray-500 outline-none focus:ring-1 focus:ring-blue-500"
          />
          <input
            type="password"
            placeholder="Password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            className="w-full rounded bg-gray-800 px-3 py-2 text-sm text-white placeholder-gray-500 outline-none focus:ring-1 focus:ring-blue-500"
          />

          <button
            type="submit"
            disabled={loading}
            className="w-full rounded bg-blue-600 py-2 text-sm font-medium text-white hover:bg-blue-500 disabled:opacity-50"
          >
            {loading ? 'Signing in...' : 'Sign In'}
          </button>
        </form>

        {AUTH_URL && (
          <div className="mt-4 space-y-2">
            <div className="text-center text-xs text-gray-500">or continue with</div>
            <div className="flex gap-2">
              <a
                href={`${AUTH_URL}/auth/github`}
                className="flex-1 rounded bg-gray-800 py-2 text-center text-sm text-white hover:bg-gray-700"
              >
                GitHub
              </a>
              <a
                href={`${AUTH_URL}/auth/google`}
                className="flex-1 rounded bg-gray-800 py-2 text-center text-sm text-white hover:bg-gray-700"
              >
                Google
              </a>
            </div>
          </div>
        )}

        <p className="mt-4 text-center text-xs text-gray-400">
          Don&apos;t have an account?{' '}
          <button onClick={onSwitchToRegister} className="text-blue-400 hover:underline">
            Register
          </button>
        </p>
      </div>
    </div>
  )
}
