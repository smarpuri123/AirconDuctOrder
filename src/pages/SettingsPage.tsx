import { useNavigate } from 'react-router-dom'
import { MasterDataPanel } from '@/components/settings/MasterDataPanel'
import { DuctScheduleImportColumnsPanel } from '@/components/settings/DuctScheduleImportColumnsPanel'
import { NotificationPreferences } from '@/components/notifications/NotificationPreferences'
import { OrganizationPanel } from '@/components/settings/OrganizationPanel'
import { UserManagementPanel } from '@/components/settings/UserManagementPanel'
import { usePortalRoles } from '@/hooks/usePortalRoles'
import { canManagePortalUsers } from '@/lib/portalAccess'
import { Card } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { LogOut, Smartphone } from 'lucide-react'
import { useAuthStore } from '@/store/authStore'

export function SettingsPage() {
  const navigate = useNavigate()
  const logout = useAuthStore((s) => s.logout)
  const roles = usePortalRoles()
  const showUserManagement = canManagePortalUsers(roles)

  const handleSignOut = () => {
    logout()
    navigate('/login', { replace: true })
  }

  return (
    <div className="space-y-6 max-w-4xl">
      {showUserManagement && (
        <Card>
          <h3 className="font-semibold mb-2">Portal users</h3>
          <UserManagementPanel />
        </Card>
      )}

      <Card>
        <h3 className="font-semibold mb-2">Notification preferences</h3>
        <p className="text-sm text-text-secondary mb-4">
          Control in-app and browser notifications for dispatch and workflow updates.
        </p>
        <NotificationPreferences />
      </Card>

      <Card>
        <h3 className="font-semibold mb-2">Organization</h3>
        <p className="text-sm text-text-secondary mb-4">
          Departments, internal job roles, and employees assigned to workflow stages.
        </p>
        <OrganizationPanel />
      </Card>

      <Card>
        <h3 className="font-semibold mb-2">Duct schedule import</h3>
        <p className="text-sm text-text-secondary mb-4">
          Shop-drawing profile: W1–H2 inputs, calculated billable SFT, 24G/22G/20G columns, and footer pivot
          totals. Simple template keeps the original single width/height layout.
        </p>
        <DuctScheduleImportColumnsPanel />
      </Card>

      <Card>
        <h3 className="font-semibold mb-2">Master data</h3>
        <p className="text-sm text-text-secondary mb-4">
          Configure lookup values used for project contact roles, enquiry sources, and priorities.
        </p>
        <MasterDataPanel />
      </Card>

      <Card>
        <h3 className="font-semibold mb-2">Mobile Dispatch (PWA)</h3>
        <p className="text-sm text-text-secondary mb-4">
          Touch-optimized dispatch app for phones. Install via browser → Add to Home screen.
        </p>
        <Button variant="secondary" onClick={() => navigate('/m')}>
          <Smartphone className="w-4 h-4" />
          Open Mobile Dispatch
        </Button>
      </Card>

      <Card>
        <h3 className="font-semibold mb-2">About</h3>
        <dl className="text-sm space-y-2">
          <div className="flex justify-between"><dt className="text-text-secondary">Application</dt><dd>ECOVENT Operations</dd></div>
          <div className="flex justify-between"><dt className="text-text-secondary">Workflow</dt><dd>Enquiry → Design → Order → Dispatch</dd></div>
          <div className="flex justify-between"><dt className="text-text-secondary">Company</dt><dd>ECOVENT AIR SYSTEMS INDIA LLP</dd></div>
        </dl>
      </Card>

      <Button variant="ghost" onClick={handleSignOut}>
        <LogOut className="w-4 h-4" />
        Sign out
      </Button>
    </div>
  )
}
