import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Truck } from 'lucide-react'
import { isApiMode } from '@/lib/api'
import { useAuthStore } from '@/store/authStore'
import { PasswordInput } from '@/components/ui/PasswordInput'

export function MobileLoginPage() {
  const navigate = useNavigate()
  const { login, loading } = useAuthStore()
  const [username, setUsername] = useState('dispatch')
  const [password, setPassword] = useState('dispatch@123')
  const [error, setError] = useState('')

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    try {
      if (isApiMode) {
        await login(username, password)
      }
      navigate('/m/orders')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Login failed')
    }
  }

  const handleDemo = () => navigate('/m/orders')

  return (
    <div className="h-full min-h-0 overflow-y-auto bg-background flex flex-col justify-center px-6 py-8">
      <div className="text-center mb-10">
        <div className="w-20 h-20 rounded-2xl bg-primary flex items-center justify-center mx-auto mb-6 ring-4 ring-secondary/25 shadow-level-2">
          <Truck className="w-10 h-10 text-white" />
        </div>
        <h1 className="text-3xl font-bold text-primary">ECOVENT Dispatch</h1>
        <p className="text-text-secondary mt-2 text-sm">Mobile dispatch for duct orders</p>
      </div>

      <div className="bg-surface rounded-2xl p-6 shadow-level-3 max-w-md mx-auto w-full">
        {isApiMode ? (
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-sm font-medium mb-1.5">Username</label>
              <input
                type="text"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                required
                className="w-full h-12 px-4 rounded-lg border-2 border-border bg-background text-base"
                autoComplete="username"
              />
            </div>
            <PasswordInput
              label="Password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              inputClassName="h-12 px-4 pr-11 rounded-lg border-2 border-border bg-background text-base focus:outline-none focus:border-primary"
            />
            {error && <p className="text-error text-sm">{error}</p>}
            <button
              type="submit"
              disabled={loading}
              className="w-full h-14 rounded-xl bg-primary text-white font-bold text-base active:opacity-90 disabled:opacity-50 touch-manipulation"
            >
              {loading ? 'Signing in…' : 'Sign In'}
            </button>
            <p className="text-xs text-text-secondary text-center">
              dispatch / Dispatch@123 (or any seeded user)
            </p>
          </form>
        ) : (
          <button
            type="button"
            onClick={handleDemo}
            className="w-full h-14 rounded-xl bg-primary text-white font-bold text-base touch-manipulation"
          >
            Enter Dispatch Demo
          </button>
        )}
      </div>

      <p className="text-center text-white/50 text-xs mt-8">
        Install: browser menu → Add to Home screen
      </p>
    </div>
  )
}
