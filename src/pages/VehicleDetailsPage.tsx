import { useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { ArrowLeft } from 'lucide-react'
import { orderService } from '@/services/orderService'
import { useAppStore } from '@/store/appStore'
import { getTodayISO } from '@/lib/calculations'
import type { VehicleDetails } from '@/types'
import { Card } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'

export function VehicleDetailsPage() {
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
    lrNumber: '',
    ewayBillNumber: '',
    driverId: '',
    transporterContact: '',
    destination: '',
    remarks: '',
  })

  const [showOptional, setShowOptional] = useState(false)

  if (!order || !dispatchDraft?.quantities) {
    navigate(`/orders/${id}/dispatch`)
    return null
  }

  const isValid =
    vehicle.vehicleNumber &&
    vehicle.driverName &&
    vehicle.driverMobile &&
    vehicle.transporter &&
    vehicle.vehicleType &&
    vehicle.loadingDate &&
    vehicle.loadingTime

  const handleContinue = () => {
    setDispatchDraft({ ...dispatchDraft, vehicle })
    navigate(`/orders/${id}/dispatch/preview`)
  }

  const update = (field: keyof VehicleDetails, value: string) => {
    setVehicle((prev) => ({ ...prev, [field]: value }))
  }

  return (
    <div className="space-y-6">
      <button
        onClick={() => navigate(`/orders/${id}/dispatch`)}
        className="flex items-center gap-2 text-text-secondary hover:text-primary transition-colors"
      >
        <ArrowLeft className="w-4 h-4" />
        Back to Items
      </button>

      <div>
        <h2 className="text-2xl font-semibold">Vehicle Details</h2>
        <p className="text-text-secondary">{order.jobName} · {order.customerName}</p>
      </div>

      <Card>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <Input label="Vehicle Number" required value={vehicle.vehicleNumber} onChange={(e) => update('vehicleNumber', e.target.value)} placeholder="AP02AB1234" />
          <Input label="Driver Name" required value={vehicle.driverName} onChange={(e) => update('driverName', e.target.value)} placeholder="Ramesh" />
          <Input label="Driver Mobile" required value={vehicle.driverMobile} onChange={(e) => update('driverMobile', e.target.value)} placeholder="98XXXXXXXX" type="tel" />
          <Input label="Transporter" required value={vehicle.transporter} onChange={(e) => update('transporter', e.target.value)} placeholder="ABC Transport" />
          <Input label="Vehicle Type" required value={vehicle.vehicleType} onChange={(e) => update('vehicleType', e.target.value)} placeholder="32 ft" />
          <Input label="Loading Date" required value={vehicle.loadingDate} onChange={(e) => update('loadingDate', e.target.value)} type="date" />
          <Input label="Loading Time" required value={vehicle.loadingTime} onChange={(e) => update('loadingTime', e.target.value)} type="time" />
        </div>

        <button
          type="button"
          onClick={() => setShowOptional(!showOptional)}
          className="text-sm text-primary font-medium mt-6 hover:underline"
        >
          {showOptional ? 'Hide' : 'Show'} optional fields
        </button>

        {showOptional && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mt-4">
            <Input label="LR Number" value={vehicle.lrNumber} onChange={(e) => update('lrNumber', e.target.value)} />
            <Input label="E-way Bill Number" value={vehicle.ewayBillNumber} onChange={(e) => update('ewayBillNumber', e.target.value)} />
            <Input label="Driver ID" value={vehicle.driverId} onChange={(e) => update('driverId', e.target.value)} />
            <Input label="Transporter Contact" value={vehicle.transporterContact} onChange={(e) => update('transporterContact', e.target.value)} />
            <Input label="Destination" value={vehicle.destination} onChange={(e) => update('destination', e.target.value)} />
            <Input label="Remarks" value={vehicle.remarks} onChange={(e) => update('remarks', e.target.value)} />
          </div>
        )}
      </Card>

      <div className="flex justify-end">
        <Button disabled={!isValid} onClick={handleContinue}>
          Preview Dispatch
        </Button>
      </div>
    </div>
  )
}
