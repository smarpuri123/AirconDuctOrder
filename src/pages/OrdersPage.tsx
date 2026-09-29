import { useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { Truck } from 'lucide-react'
import { useAppStore } from '@/store/appStore'
import { orderService } from '@/services/orderService'
import { dispatchService } from '@/services/dispatchService'
import type { Order, OrderFilter, OrderStatus } from '@/types'
import { PageToolbar } from '@/components/layout/PageToolbar'
import { KanbanBoard } from '@/components/views/KanbanBoard'
import { OrderCard } from '@/components/orders/OrderCard'
import { SearchInput } from '@/components/ui/SearchInput'
import { Card } from '@/components/ui/Card'
import { Chip } from '@/components/ui/Chip'
import { Button } from '@/components/ui/Button'
import { OrderStatusChip } from '@/components/ui/Chip'
import { useViewStore } from '@/store/viewStore'
import { formatArea, getOrderBalanceQty, getOrderDispatchedQty } from '@/lib/calculations'

const filters: { key: OrderFilter; label: string }[] = [
  { key: 'all', label: 'All' },
  { key: 'ready', label: 'Ready' },
  { key: 'partial', label: 'Partial' },
  { key: 'fully_dispatched', label: 'Fully Dispatched' },
  { key: 'today', label: 'Today' },
  { key: 'overdue', label: 'Overdue' },
]

const kanbanColumns: { id: OrderStatus | 'other'; title: string; statuses: OrderStatus[] }[] = [
  { id: 'production', title: 'Production', statuses: ['production', 'imported', 'draft'] },
  { id: 'ready', title: 'Ready', statuses: ['ready'] },
  { id: 'partially_dispatched', title: 'Partial Dispatch', statuses: ['partially_dispatched'] },
  { id: 'fully_dispatched', title: 'Fully Dispatched', statuses: ['fully_dispatched', 'closed'] },
]

export function OrdersPage() {
  const navigate = useNavigate()
  const { searchQuery, orderFilter, setSearchQuery, setOrderFilter } = useAppStore()
  const view = useViewStore((s) => s.preferences.orders)

  const orders = useMemo(() => {
    let result = orderService.filterOrders(orderFilter as OrderFilter)
    if (searchQuery) {
      const q = searchQuery.toLowerCase()
      result = result.filter(
        (o) =>
          o.orderNo.toLowerCase().includes(q) ||
          o.customerName.toLowerCase().includes(q) ||
          o.jobName.toLowerCase().includes(q),
      )
      const dispatchMatches = dispatchService.searchDispatches(searchQuery)
      const orderIds = new Set(dispatchMatches.map((d) => d.orderId))
      const dispatchOrders = orderService.getOrders().filter((o) => orderIds.has(o.id))
      const combined = new Map(result.map((o) => [o.id, o]))
      dispatchOrders.forEach((o) => combined.set(o.id, o))
      result = Array.from(combined.values())
    }
    return result
  }, [searchQuery, orderFilter])

  const firstDispatchable = orders.find(
    (o) => getOrderBalanceQty(o) > 0 && o.status !== 'production',
  )

  const openOrder = (id: string) => navigate(`/orders/${id}`)

  return (
    <div className="space-y-6">
      <PageToolbar
        screen="orders"
        actions={
          firstDispatchable ? (
            <Button size="sm" onClick={() => navigate(`/orders/${firstDispatchable.id}/dispatch`)}>
              <Truck className="w-4 h-4" />
              Create Dispatch
            </Button>
          ) : (
            <Button size="sm" variant="secondary" disabled>
              <Truck className="w-4 h-4" />
              No orders ready
            </Button>
          )
        }
      />

      <SearchInput value={searchQuery} onChange={setSearchQuery} placeholder="Search orders..." />

      {view !== 'kanban' && (
        <div className="flex flex-wrap gap-2">
          {filters.map((f) => (
            <button key={f.key} onClick={() => setOrderFilter(f.key)}>
              <Chip variant={orderFilter === f.key ? 'primary' : 'default'}>{f.label}</Chip>
            </button>
          ))}
        </div>
      )}

      {orders.length === 0 && (
        <p className="text-center text-text-secondary py-12">No orders match your search.</p>
      )}

      {view === 'card' && orders.length > 0 && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {orders.map((order) => (
            <OrderCard key={order.id} order={order} />
          ))}
        </div>
      )}

      {view === 'grid' && orders.length > 0 && (
        <Card padding="sm">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border text-text-secondary text-left">
                  <th className="py-3 px-3">Order No</th>
                  <th className="py-3 px-3">Customer</th>
                  <th className="py-3 px-3 text-right">Qty</th>
                  <th className="py-3 px-3 text-right">Dispatched</th>
                  <th className="py-3 px-3 text-right">Balance</th>
                  <th className="py-3 px-3 text-right">Area</th>
                  <th className="py-3 px-3">Status</th>
                </tr>
              </thead>
              <tbody>
                {orders.map((order) => (
                  <tr
                    key={order.id}
                    onClick={() => openOrder(order.id)}
                    className="border-b border-border hover:bg-background cursor-pointer"
                  >
                    <td className="py-3 px-3 font-medium">{order.orderNo}</td>
                    <td className="py-3 px-3">{order.customerName}</td>
                    <td className="py-3 px-3 text-right tabular-nums">{order.totalQuantity}</td>
                    <td className="py-3 px-3 text-right tabular-nums text-success">{getOrderDispatchedQty(order)}</td>
                    <td className="py-3 px-3 text-right tabular-nums text-warning">{getOrderBalanceQty(order)}</td>
                    <td className="py-3 px-3 text-right tabular-nums">{formatArea(order.totalArea)}</td>
                    <td className="py-3 px-3"><OrderStatusChip status={order.status} /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}

      {view === 'kanban' && orders.length > 0 && (
        <KanbanBoard
          columns={kanbanColumns.map((col) => ({
            id: col.id,
            title: col.title,
            items: orders.filter((o) => col.statuses.includes(o.status)),
          }))}
          getKey={(o) => o.id}
          onCardClick={(o) => openOrder(o.id)}
          renderCard={(order: Order) => (
            <>
              <p className="font-semibold text-sm">{order.orderNo}</p>
              <p className="text-xs text-text-secondary mt-1">{order.customerName}</p>
              <p className="text-xs tabular-nums mt-2">
                {getOrderDispatchedQty(order)}/{order.totalQuantity} dispatched
              </p>
            </>
          )}
        />
      )}
    </div>
  )
}
