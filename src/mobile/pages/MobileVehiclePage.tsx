import { useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { ArrowLeft } from 'lucide-react'
import { orderService } from '@/services/orderService'
import { useAppStore } from '@/store/appStore'
import { getTodayISO } from '@/lib/calculations'
import type { VehicleDetails } from '@/types'

export function MobileVehiclePage() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const { dispatchDraft, setDispatchDraft } = useAppStore()
  const order = orderService.getOrderById(id!)

  const [vehicle, setVehicle] = useState<VehicleDetails>({
    vehicleNumber: '',
    driverName: '',
    driverMobile: '',
    transporter: '',
    vehicleType: '32 ft',
    loadingDate: getTodayISO(),
    loadingTime: '10:30',
  })

  if (!order || !dispatchDraft?.quantities) {
    navigate(`/m/orders/${id}/dispatch`)
    return null
  }

  const isValid =
    vehicle.vehicleNumber &&
    vehicle.driverName &&
    vehicle.driverMobile &&
    vehicle.transporter &&
    vehicle.loadingDate &&
    vehicle.loadingTime

  const update = (field: keyof VehicleDetails, value: string) => {
    setVehicle((prev) => ({ ...prev, [field]: value }))
  }

  const handleContinue = () => {
    setDispatchDraft({ ...dispatchDraft, vehicle })
    navigate(`/m/orders/${id}/preview`)
  }

  const fieldClass =
    'w-full h-12 px-4 rounded-xl border-2 border-border bg-surface text-base'

  return (
    <div className="space-y-4 pb-8">
      <button
        type="button"
        onClick={() => navigate(`/m/orders/${id}/dispatch`)}
        className="flex items-center gap-2 text-text-secondary min-h-11 touch-manipulation"
      >
        <ArrowLeft className="w-5 h-5" />
        Tags
      </button>

      <h2 className="text-xl font-bold">Vehicle Details</h2>
      <p className="text-sm text-text-secondary">{order.orderNo}</p>

      <div className="space-y-4 bg-surface rounded-xl border border-border p-4">
        <label className="block">
          <span className="text-sm font-medium mb-1 block">Vehicle Number *</span>
          <input
            className={fieldClass}
            value={vehicle.vehicleNumber}
            onChange={(e) => update('vehicleNumber', e.target.value)}
            placeholder="AP02AB1234"
          />
        </label>
        <label className="block">
          <span className="text-sm font-medium mb-1 block">Driver Name *</span>
          <input className={fieldClass} value={vehicle.driverName} onChange={(e) => update('driverName', e.target.value)} />
        </label>
        <label className="block">
          <span className="text-sm font-medium mb-1 block">Driver Mobile *</span>
          <input
            type="tel"
            className={fieldClass}
            value={vehicle.driverMobile}
            onChange={(e) => update('driverMobile', e.target.value)}
          />
        </label>
        <label className="block">
          <span className="text-sm font-medium mb-1 block">Transporter *</span>
          <input className={fieldClass} value={vehicle.transporter} onChange={(e) => update('transporter', e.target.value)} />
        </label>
        <label className="block">
          <span className="text-sm font-medium mb-1 block">Vehicle Type</span>
          <input className={fieldClass} value={vehicle.vehicleType} onChange={(e) => update('vehicleType', e.target.value)} />
        </label>
        <div className="grid grid-cols-2 gap-3">
          <label className="block">
            <span className="text-sm font-medium mb-1 block">Loading Date *</span>
            <input
              type="date"
              className={fieldClass}
              value={vehicle.loadingDate}
              onChange={(e) => update('loadingDate', e.target.value)}
            />
          </label>
          <label className="block">
            <span className="text-sm font-medium mb-1 block">Time *</span>
            <input
              type="time"
              className={fieldClass}
              value={vehicle.loadingTime}
              onChange={(e) => update('loadingTime', e.target.value)}
            />
          </label>
        </div>
      </div>

      <button
        type="button"
        disabled={!isValid}
        onClick={handleContinue}
        className="w-full min-h-14 rounded-xl bg-primary text-white font-bold disabled:opacity-40 touch-manipulation"
      >
        Preview Dispatch
      </button>
    </div>
  )
}
