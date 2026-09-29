import { useState } from 'react'

import { useNavigate } from 'react-router-dom'

import { Wind } from 'lucide-react'

import { isApiMode } from '@/lib/api'

import { useAuthStore } from '@/store/authStore'
import { defaultPortalPath } from '@/lib/portalAccess'

import { Button } from '@/components/ui/Button'

import { Input } from '@/components/ui/Input'
import { PasswordInput } from '@/components/ui/PasswordInput'
import { DEV_LOGIN_USERS } from '@/lib/devLoginUsers'



export function LoginPage() {

  const navigate = useNavigate()

  const { login, loading } = useAuthStore()

  const [username, setUsername] = useState('admin')

  const [password, setPassword] = useState('admin@123')

  const [error, setError] = useState('')



  const handleDemo = () => navigate('/')



  const handleLogin = async (e: React.FormEvent) => {

    e.preventDefault()

    setError('')

    try {

      await login(username, password)
      const roles = useAuthStore.getState().user?.roles ?? []
      navigate(defaultPortalPath(roles))

    } catch (err) {

      setError(err instanceof Error ? err.message : 'Login failed')

    }

  }



  return (

    <div className="h-full min-h-0 overflow-y-auto bg-background flex items-center justify-center p-6">

      <div className="w-full max-w-md text-center">

        <div className="w-20 h-20 rounded-2xl bg-primary flex items-center justify-center mx-auto mb-8 ring-4 ring-secondary/25 shadow-level-2">

          <Wind className="w-10 h-10 text-white" />

        </div>

        <h1 className="text-primary text-4xl font-bold tracking-tight mb-2">ECOVENT</h1>

        <p className="text-text-primary text-lg mb-1">Air Systems India LLP</p>

        <p className="text-text-secondary text-sm mb-12">Quality Ducts Is Our Business</p>



        <div className="bg-surface rounded-xl p-8 shadow-level-3 text-left">

          <h2 className="text-xl font-semibold mb-2 text-center">Operations</h2>

          <p className="text-text-secondary text-sm mb-8 text-center">

            Customer enquiry → design review → order → manufacture → dispatch

          </p>



          {isApiMode ? (

            <form onSubmit={handleLogin} className="space-y-4">

              <Input

                label="Username"

                type="text"

                value={username}

                onChange={(e) => setUsername(e.target.value)}

                autoComplete="username"

                required

              />

              <PasswordInput
                label="Password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
              />

              {error && <p className="text-error text-sm">{error}</p>}

              <Button fullWidth size="lg" type="submit" disabled={loading}>

                {loading ? 'Signing in...' : 'Sign In'}

              </Button>

              <div className="rounded-lg border border-border bg-background p-3 text-xs text-text-secondary">
                <p className="font-medium text-text-primary mb-2 text-center">Demo logins</p>
                <ul className="space-y-1.5">
                  {DEV_LOGIN_USERS.map((u) => (
                    <li key={u.username}>
                      <button
                        type="button"
                        className="w-full flex justify-between gap-2 text-left rounded px-1 py-0.5 hover:bg-primary-muted/40"
                        onClick={() => {
                          setUsername(u.username)
                          setPassword(u.password)
                          setError('')
                        }}
                      >
                        <span>
                          <span className="font-mono text-text-primary">{u.username}</span>
                          <span className="text-text-secondary"> · {u.role}</span>
                        </span>
                        <span className="font-mono shrink-0">{u.password}</span>
                      </button>
                    </li>
                  ))}
                </ul>
              </div>

            </form>

          ) : (

            <Button fullWidth size="lg" onClick={handleDemo}>

              Enter Demo

            </Button>

          )}

        </div>

      </div>

    </div>

  )

}


