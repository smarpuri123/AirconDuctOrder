import { useCallback, useEffect, useState } from 'react'
import { orgService } from '@/services/orgService'
import type { Department, Employee, JobRole } from '@/types/org'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { Select } from '@/components/ui/Select'

type Tab = 'departments' | 'roles' | 'employees'

export function OrganizationPanel() {
  const [tab, setTab] = useState<Tab>('employees')
  const [departments, setDepartments] = useState<Department[]>([])
  const [jobRoles, setJobRoles] = useState<JobRole[]>([])
  const [employees, setEmployees] = useState<Employee[]>([])
  const [status, setStatus] = useState('')

  const [deptForm, setDeptForm] = useState({ code: '', name: '' })
  const [roleForm, setRoleForm] = useState({ code: '', label: '', departmentId: '' })
  const [empForm, setEmpForm] = useState({
    name: '',
    email: '',
    departmentId: '',
    jobRoleCode: '',
  })

  const load = useCallback(async () => {
    const [d, r, e] = await Promise.all([
      orgService.listDepartments(),
      orgService.listJobRoles(),
      orgService.listEmployees(),
    ])
    setDepartments(d)
    setJobRoles(r)
    setEmployees(e)
  }, [])

  useEffect(() => {
    load()
  }, [load])

  const tabs: { id: Tab; label: string }[] = [
    { id: 'employees', label: 'Employees' },
    { id: 'departments', label: 'Departments' },
    { id: 'roles', label: 'Job roles' },
  ]

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-2">
        {tabs.map((t) => (
          <button
            key={t.id}
            type="button"
            onClick={() => setTab(t.id)}
            className={`px-3 py-1.5 rounded-md text-sm font-medium ${
              tab === t.id ? 'bg-primary text-white' : 'bg-background border border-border'
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {status && <p className="text-sm text-success">{status}</p>}

      {tab === 'employees' && (
        <div className="space-y-4">
          <table className="w-full text-sm border border-border rounded-md overflow-hidden">
            <thead>
              <tr className="bg-background text-left text-text-secondary">
                <th className="py-2 px-3">Name</th>
                <th className="py-2 px-3">Department</th>
                <th className="py-2 px-3">Job roles</th>
              </tr>
            </thead>
            <tbody>
              {employees.map((e) => (
                <tr key={e.id} className="border-t border-border">
                  <td className="py-2 px-3 font-medium">{e.name}</td>
                  <td className="py-2 px-3">{e.departmentName ?? '—'}</td>
                  <td className="py-2 px-3 text-text-secondary">
                    {e.jobRoles.map((r) => r.label).join(', ') || '—'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          <div className="rounded-lg border border-border bg-background p-4 space-y-3">
            <p className="text-sm font-medium">Add employee</p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <Input
                label="Name"
                value={empForm.name}
                onChange={(e) => setEmpForm((f) => ({ ...f, name: e.target.value }))}
              />
              <Input
                label="Email"
                value={empForm.email}
                onChange={(e) => setEmpForm((f) => ({ ...f, email: e.target.value }))}
              />
              <Select
                label="Department"
                value={empForm.departmentId}
                onChange={(e) => setEmpForm((f) => ({ ...f, departmentId: e.target.value }))}
                options={[
                  { value: '', label: 'Select' },
                  ...departments.map((d) => ({ value: d.id, label: d.name })),
                ]}
              />
              <Select
                label="Primary job role"
                value={empForm.jobRoleCode}
                onChange={(e) => setEmpForm((f) => ({ ...f, jobRoleCode: e.target.value }))}
                options={[
                  { value: '', label: 'Select' },
                  ...jobRoles.map((r) => ({ value: r.code, label: r.label })),
                ]}
              />
            </div>
            <Button
              type="button"
              size="sm"
              onClick={async () => {
                if (!empForm.name.trim()) return
                await orgService.createEmployee({
                  name: empForm.name.trim(),
                  email: empForm.email || undefined,
                  departmentId: empForm.departmentId || undefined,
                  jobRoleCodes: empForm.jobRoleCode ? [empForm.jobRoleCode] : undefined,
                })
                setEmpForm({ name: '', email: '', departmentId: '', jobRoleCode: '' })
                setStatus('Employee added')
                await load()
              }}
            >
              Save employee
            </Button>
          </div>
        </div>
      )}

      {tab === 'departments' && (
        <div className="space-y-4">
          <ul className="text-sm space-y-1">
            {departments.map((d) => (
              <li key={d.id} className="flex justify-between border-b border-border py-2">
                <span className="font-medium">{d.name}</span>
                <span className="text-text-secondary font-mono text-xs">{d.code}</span>
              </li>
            ))}
          </ul>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <Input
              label="Code"
              value={deptForm.code}
              onChange={(e) => setDeptForm((f) => ({ ...f, code: e.target.value }))}
            />
            <Input
              label="Name"
              value={deptForm.name}
              onChange={(e) => setDeptForm((f) => ({ ...f, name: e.target.value }))}
            />
          </div>
          <Button
            type="button"
            size="sm"
            onClick={async () => {
              if (!deptForm.code.trim() || !deptForm.name.trim()) return
              await orgService.createDepartment({ code: deptForm.code, name: deptForm.name })
              setDeptForm({ code: '', name: '' })
              setStatus('Department added')
              await load()
            }}
          >
            Add department
          </Button>
        </div>
      )}

      {tab === 'roles' && (
        <div className="space-y-4">
          <ul className="text-sm space-y-1">
            {jobRoles.map((r) => (
              <li key={r.id} className="flex justify-between border-b border-border py-2">
                <span>{r.label}</span>
                <span className="text-text-secondary font-mono text-xs">{r.code}</span>
              </li>
            ))}
          </ul>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <Input
              label="Code"
              value={roleForm.code}
              onChange={(e) => setRoleForm((f) => ({ ...f, code: e.target.value }))}
            />
            <Input
              label="Label"
              value={roleForm.label}
              onChange={(e) => setRoleForm((f) => ({ ...f, label: e.target.value }))}
            />
            <Select
              label="Department"
              value={roleForm.departmentId}
              onChange={(e) => setRoleForm((f) => ({ ...f, departmentId: e.target.value }))}
              options={[
                { value: '', label: 'Optional' },
                ...departments.map((d) => ({ value: d.id, label: d.name })),
              ]}
            />
          </div>
          <Button
            type="button"
            size="sm"
            onClick={async () => {
              if (!roleForm.code.trim() || !roleForm.label.trim()) return
              await orgService.createJobRole({
                code: roleForm.code,
                label: roleForm.label,
                departmentId: roleForm.departmentId || undefined,
              })
              setRoleForm({ code: '', label: '', departmentId: '' })
              setStatus('Job role added')
              await load()
            }}
          >
            Add job role
          </Button>
        </div>
      )}
    </div>
  )
}
