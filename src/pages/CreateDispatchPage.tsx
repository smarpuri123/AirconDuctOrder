import { useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { ArrowLeft, Truck } from 'lucide-react'
import { orderService } from '@/services/orderService'
import { dispatchService } from '@/services/dispatchService'
import { useAppStore } from '@/store/appStore'
import { getTodayISO } from '@/lib/calculations'
import type { VehicleDetails } from '@/types'
import { Card } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'

export function CreateDispatchPage() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const { dispatchDraft, setDispatchDraft } = useAppStore()
  const order = orderService.getOrderById(id!)

  const existingVehicle =
    dispatchDraft?.orderId === id && dispatchDraft?.vehicle ? dispatchDraft.vehicle : undefined

  const [vehicle, setVehicle] = useState<VehicleDetails>(
    existingVehicle ?? {
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
    },
  )

  const [showOptional, setShowOptional] = useState(false)
  const [creatingTrip, setCreatingTrip] = useState(false)
  const [error, setError] = useState('')

  if (!order) return <p className="text-text-secondary">Order not found.</p>

  const isValid = Boolean(
    vehicle.vehicleNumber.trim() &&
      vehicle.driverName.trim() &&
      vehicle.driverMobile.trim() &&
      vehicle.transporter.trim() &&
      vehicle.vehicleType.trim() &&
      vehicle.loadingDate &&
      vehicle.loadingTime,
  )

  const update = (field: keyof VehicleDetails, value: string) => {
    setVehicle((prev) => ({ ...prev, [field]: value }))
  }

  const handleCreateTripAndLoad = async () => {
    if (!isValid || creatingTrip) return
    setCreatingTrip(true)
    setError('')
    try {
      let dispatchId =
        dispatchDraft?.orderId === order.id ? dispatchDraft.dispatchId : undefined
      if (!dispatchId) {
        const trip = await dispatchService.createTrip(order.id, vehicle)
        dispatchId = trip.id
      }
      setDispatchDraft({
        orderId: order.id,
        dispatchId,
        vehicle,
        quantities:
          dispatchDraft?.orderId === order.id ? (dispatchDraft.quantities ?? {}) : {},
        loadSequence:
          dispatchDraft?.orderId === order.id ? (dispatchDraft.loadSequence ?? []) : [],
      })
      navigate(`/orders/${order.id}/dispatch/vehicle`)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create dispatch trip')
    } finally {
      setCreatingTrip(false)
    }
  }

  return (
    <div className="space-y-6">
      <button
        onClick={() => navigate(`/orders/${order.id}`)}
        className="flex items-center gap-2 text-text-secondary hover:text-primary transition-colors"
      >
        <ArrowLeft className="w-4 h-4" />
        Back to Order
      </button>

      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-primary">
            Step 1 of 3 · Create Dispatch Trip
          </p>
          <h2 className="text-2xl font-semibold mt-0.5">Vehicle &amp; Driver Details</h2>
          <p className="text-text-secondary">
            {order.jobName} · {order.customerName}
          </p>
        </div>
        <span className="inline-flex items-center gap-2 text-xs font-medium px-3 py-1.5 rounded-full bg-amber-500/15 text-amber-700 border border-amber-500/30">
          <Truck className="w-3.5 h-3.5" />
          Creates trip with status: Loading
        </span>
      </div>

      <Card>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <Input
            label="Vehicle Number"
            required
            value={vehicle.vehicleNumber}
            onChange={(e) => update('vehicleNumber', e.target.value)}
            placeholder="AP02AB1234"
          />
          <Input
            label="Driver Name"
            required
            value={vehicle.driverName}
            onChange={(e) => update('driverName', e.target.value)}
            placeholder="Ramesh"
          />
          <Input
            label="Driver Mobile"
            required
            value={vehicle.driverMobile}
            onChange={(e) => update('driverMobile', e.target.value)}
            placeholder="98XXXXXXXX"
            type="tel"
          />
          <Input
            label="Transporter"
            required
            value={vehicle.transporter}
            onChange={(e) => update('transporter', e.target.value)}
            placeholder="ABC Transport"
          />
          <Input
            label="Vehicle Type"
            required
            value={vehicle.vehicleType}
            onChange={(e) => update('vehicleType', e.target.value)}
            placeholder="32 ft"
          />
          <Input
            label="Loading Date"
            required
            value={vehicle.loadingDate}
            onChange={(e) => update('loadingDate', e.target.value)}
            type="date"
          />
          <Input
            label="Loading Time"
            required
            value={vehicle.loadingTime}
            onChange={(e) => update('loadingTime', e.target.value)}
            type="time"
          />
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
            <Input
              label="LR Number"
              value={vehicle.lrNumber}
              onChange={(e) => update('lrNumber', e.target.value)}
            />
            <Input
              label="E-way Bill Number"
              value={vehicle.ewayBillNumber}
              onChange={(e) => update('ewayBillNumber', e.target.value)}
            />
            <Input
              label="Driver ID"
              value={vehicle.driverId}
              onChange={(e) => update('driverId', e.target.value)}
            />
            <Input
              label="Transporter Contact"
              value={vehicle.transporterContact}
              onChange={(e) => update('transporterContact', e.target.value)}
            />
            <Input
              label="Destination"
              value={vehicle.destination}
              onChange={(e) => update('destination', e.target.value)}
            />
            <Input
              label="Remarks"
              value={vehicle.remarks}
              onChange={(e) => update('remarks', e.target.value)}
            />
          </div>
        )}
      </Card>

      {error && <p className="text-error text-sm">{error}</p>}

      <div className="flex justify-end">
        <Button disabled={!isValid || creatingTrip} onClick={handleCreateTripAndLoad}>
          <Truck className="w-4 h-4" />
          {creatingTrip ? 'Creating Trip…' : 'Create Trip & Start Loading Ducts'}
        </Button>
      </div>
    </div>
  )
}
