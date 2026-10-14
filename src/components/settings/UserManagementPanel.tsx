import { useCallback, useEffect, useState } from 'react'
import { userService } from '@/services/userService'
import type { PortalUser } from '@/types/portalUser'
import { PORTAL_USER_ROLE_OPTIONS } from '@/types/portalUser'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { Select } from '@/components/ui/Select'

export function UserManagementPanel() {
  const [users, setUsers] = useState<PortalUser[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [status, setStatus] = useState('')

  const [form, setForm] = useState({
    username: '',
    name: '',
    password: '',
    phone: '',
    roleCode: 'SUPERVISOR',
  })

  const load = useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      setUsers(await userService.listUsers())
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load users')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    load()
  }, [load])

  const handleCreate = async () => {
    setError('')
    setStatus('')
    if (!form.username.trim() || !form.name.trim() || !form.password) {
      setError('Username, name, and password are required.')
      return
    }
    try {
      await userService.createUser({
        username: form.username.trim(),
        name: form.name.trim(),
        password: form.password,
        phone: form.phone.trim() || undefined,
        roleCode: form.roleCode,
      })
      setForm({ username: '', name: '', password: '', phone: '', roleCode: 'SUPERVISOR' })
      setStatus('User created. They can sign in and appear in enquiry responsibility lists.')
      await load()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to create user')
    }
  }

  const toggleActive = async (user: PortalUser) => {
    setError('')
    try {
      await userService.updateUser(user.id, { active: !user.active })
      await load()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to update user')
    }
  }

  return (
    <div className="space-y-4">
      <p className="text-sm text-text-secondary">
        Portal logins for your team. Active users appear in <strong>Responsibility (person in charge)</strong>{' '}
        on new enquiries. At each workflow stage, only users whose portal role matches that stage are
        offered (e.g. designers on design handoff).
      </p>

      {error && <p className="text-error text-sm">{error}</p>}
      {status && <p className="text-success text-sm">{status}</p>}

      {loading ? (
        <p className="text-sm text-text-secondary">Loading users…</p>
      ) : (
        <div className="overflow-auto border border-border rounded-md">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-background text-left text-text-secondary">
                <th className="py-2 px-3">Name</th>
                <th className="py-2 px-3">Username</th>
                <th className="py-2 px-3">Phone</th>
                <th className="py-2 px-3">Role</th>
                <th className="py-2 px-3">Status</th>
                <th className="py-2 px-3" />
              </tr>
            </thead>
            <tbody>
              {users.map((u) => (
                <tr key={u.id} className="border-t border-border">
                  <td className="py-2 px-3 font-medium">{u.name}</td>
                  <td className="py-2 px-3 font-mono text-xs">{u.username}</td>
                  <td className="py-2 px-3">{u.phone ?? '—'}</td>
                  <td className="py-2 px-3">{u.roles.join(', ') || '—'}</td>
                  <td className="py-2 px-3">{u.active ? 'Active' : 'Disabled'}</td>
                  <td className="py-2 px-3">
                    <Button type="button" size="sm" variant="ghost" onClick={() => toggleActive(u)}>
                      {u.active ? 'Disable' : 'Enable'}
                    </Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <div className="rounded-lg border border-border bg-background p-4 space-y-3">
        <p className="text-sm font-medium">Add portal user</p>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <Input
            label="Username"
            required
            value={form.username}
            onChange={(e) => setForm((f) => ({ ...f, username: e.target.value }))}
            placeholder="e.g. karthik.s"
          />
          <Input
            label="Display name"
            required
            value={form.name}
            onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
          />
          <Input
            label="Phone"
            value={form.phone}
            onChange={(e) => setForm((f) => ({ ...f, phone: e.target.value }))}
          />
          <Select
            label="Portal role"
            value={form.roleCode}
            onChange={(e) => setForm((f) => ({ ...f, roleCode: e.target.value }))}
            options={PORTAL_USER_ROLE_OPTIONS}
          />
          <Input
            label="Password"
            type="password"
            required
            value={form.password}
            onChange={(e) => setForm((f) => ({ ...f, password: e.target.value }))}
            className="sm:col-span-2"
          />
        </div>
        <Button type="button" size="sm" onClick={handleCreate}>Create user</Button>
      </div>
    </div>
  )
}
