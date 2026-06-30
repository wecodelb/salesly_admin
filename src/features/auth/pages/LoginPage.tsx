import { useState, type FormEvent } from 'react'
import { useNavigate } from 'react-router-dom'
import { Zap, Eye, EyeOff } from 'lucide-react'
import { apiClient } from '@/core/api/client'
import { ENDPOINTS } from '@/core/api/endpoints'
import { useAuthStore } from '@/core/auth/auth-store'
import { ROLE_PERMISSIONS } from '@/core/auth/permissions'
import { Input } from '@/shared/components/Input'
import { Button } from '@/shared/components/Button'
import { SplashScreen } from '@/shared/components/SplashScreen/SplashScreen'
import { useSplashStore } from '@/shared/components/SplashScreen/splash-store'

// Backend response: { status, message, data: { token, user } }
interface LoginResponse {
  status: string
  message: string
  data: {
    token: string
    user: {
      id: number
      name: string
      email: string
      image?: string
      companies: unknown[]
    }
  }
}

export function LoginPage() {
  const navigate = useNavigate()
  const setAuth = useAuthStore((s) => s.setAuth)
  const { trigger: triggerSplash } = useSplashStore()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPass, setShowPass] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [postLoginSplash, setPostLoginSplash] = useState(false)

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault()
    setError('')
    setLoading(true)
    try {
      const response = await apiClient.post<LoginResponse>(ENDPOINTS.AUTH.LOGIN, { email, password })
      const { token, user } = response.data.data

      // Backend has no RBAC yet — all admin console users get owner-level access
      setAuth(
        token,
        { id: String(user.id), name: user.name, email: user.email, avatar: user.image },
        'owner',
        ROLE_PERMISSIONS['owner'],
      )

      // Show post-login splash before navigating
      setPostLoginSplash(true)
      triggerSplash()
    } catch (err: unknown) {
      const axiosErr = err as { response?: { data?: { errors?: Record<string, string[]>; data?: Record<string, string[]>; message?: string } }; message?: string }
      const resData = axiosErr?.response?.data
      let msg: string
      if (!axiosErr?.response) {
        msg = 'Cannot reach server. Make sure the backend is running on http://localhost:8000'
      } else if (resData?.errors) {
        msg = Object.values(resData.errors).flat()[0] as string
      } else if (resData?.data) {
        msg = Object.values(resData.data).flat()[0] as string
      } else {
        msg = resData?.message ?? 'Login failed. Please try again.'
      }
      setError(msg)
      setLoading(false)
    }
  }

  const handlePostLoginDone = () => {
    setPostLoginSplash(false)
    navigate('/dashboard', { replace: true })
  }

  if (postLoginSplash) {
    return <SplashScreen onDone={handlePostLoginDone} duration={1600} />
  }

  return (
    <div
      className="min-h-screen flex items-center justify-center p-4"
      style={{ background: 'linear-gradient(160deg, #1A6FC4 0%, #0A3D8F 55%, #061F55 100%)' }}
    >
      <div className="w-full max-w-sm">
        {/* Logo */}
        <div className="flex flex-col items-center mb-8">
          <div className="w-14 h-14 rounded-2xl bg-white/15 backdrop-blur-sm flex items-center justify-center mb-3 shadow-lg">
            <Zap size={28} className="text-white" />
          </div>
          <h1 className="text-2xl font-bold text-white font-heading">Salesly</h1>
          <p className="text-sm text-white/50 mt-1">Admin Console</p>
        </div>

        {/* Card */}
        <div className="bg-[var(--bg-surface)] rounded-[var(--radius-card)] p-6 shadow-[var(--shadow-modal)]">
          <h2 className="text-lg font-semibold text-[var(--text-primary)] font-heading mb-5">Sign in</h2>

          {error && (
            <div className="mb-4 px-3 py-2.5 rounded-[var(--radius-btn)] bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 text-sm text-[var(--accent-red)]">
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <Input
              label="Email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@company.com"
              required
              autoFocus
            />
            <Input
              label="Password"
              type={showPass ? 'text' : 'password'}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
              required
              rightIcon={
                <button
                  type="button"
                  onClick={() => setShowPass((s) => !s)}
                  className="text-[var(--text-muted)] hover:text-[var(--text-primary)] transition-colors"
                >
                  {showPass ? <EyeOff size={14} /> : <Eye size={14} />}
                </button>
              }
            />
            <Button type="submit" loading={loading} className="w-full mt-2">
              Sign in
            </Button>
          </form>

          {/* Dev hint */}
          <div className="mt-5 px-3 py-2.5 rounded-btn bg-(--bg-surface-raised) border border-(--border-default) text-xs text-center text-(--text-secondary)">
            <span className="font-semibold">Test account:</span>{' '}
            <span className="font-mono">admin@admin.com</span>{' '}
            / <span className="font-mono">123456</span>
          </div>
        </div>
      </div>
    </div>
  )
}
