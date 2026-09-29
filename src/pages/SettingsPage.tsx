import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { clearDataCache } from '@/lib/dataCache'
import { clearEnquiryFileBlobs } from '@/lib/enquiryDocuments'
import { clearStorage } from '@/lib/storage'
import { orderService } from '@/services/orderService'
import { dispatchService } from '@/services/dispatchService'
import { enquiryService } from '@/services/enquiryService'
import { crmService } from '@/services/crmService'
import { MasterDataPanel } from '@/components/settings/MasterDataPanel'
import { NotificationPreferences } from '@/components/notifications/NotificationPreferences'
import { isApiMode } from '@/lib/api'
import { OrganizationPanel } from '@/components/settings/OrganizationPanel'
import { orgService } from '@/services/orgService'
import { useAppStore } from '@/store/appStore'
import { Card } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { RotateCcw, LogOut, Smartphone } from 'lucide-react'

export function SettingsPage() {
  const navigate = useNavigate()
  const { reset } = useAppStore()
  const [resetDone, setResetDone] = useState(false)

  const handleReset = () => {
    clearStorage()
    clearDataCache()
    clearEnquiryFileBlobs()
    orderService.resetToSeed()
    dispatchService.resetToSeed()
    enquiryService.resetToSeed()
    crmService.resetToSeed()
    orgService.resetToSeed()
    reset()
    setResetDone(true)
    setTimeout(() => setResetDone(false), 3000)
  }

  return (
    <div className="space-y-6 max-w-4xl">
      <Card>
        <h3 className="font-semibold mb-2">Demo Settings</h3>
        <p className="text-sm text-text-secondary mb-6">
          Reset all demo data — enquiries, orders, and dispatches.
        </p>
        <Button variant="secondary" onClick={handleReset}>
          <RotateCcw className="w-4 h-4" />
          Reset Demo Data
        </Button>
        {resetDone && (
          <p className="text-success text-sm mt-3">Demo data has been reset.</p>
        )}
      </Card>

      {isApiMode && (
        <Card>
          <h3 className="font-semibold mb-2">Notification preferences</h3>
          <p className="text-sm text-text-secondary mb-4">
            Control in-app and browser notifications for dispatch and workflow updates.
          </p>
          <NotificationPreferences />
        </Card>
      )}

      <Card>
        <h3 className="font-semibold mb-2">Organization</h3>
        <p className="text-sm text-text-secondary mb-4">
          Departments, internal job roles, and employees assigned to workflow stages.
        </p>
        <OrganizationPanel />
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

      <Button variant="ghost" onClick={() => navigate('/login')}>
        <LogOut className="w-4 h-4" />
        Exit Demo
      </Button>
    </div>
  )
}
