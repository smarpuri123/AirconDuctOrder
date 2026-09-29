import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { ChevronRight, Search } from 'lucide-react'
import { searchInputFieldClass } from '@/components/ui/SearchInput'
import { orderService } from '@/services/orderService'
import { useApiData } from '@/hooks/useApiData'
import { getOrderBalanceQty, getOrderDispatchedQty } from '@/lib/calculations'

export function MobileOrdersPage() {
  const navigate = useNavigate()
  const dataTick = useApiData()
  const [search, setSearch] = useState('')

  const orders = useMemo(() => {
    let list = orderService
      .getOrders()
      .filter((o) => getOrderBalanceQty(o) > 0 && o.status !== 'production')
      .sort((a, b) => a.orderNo.localeCompare(b.orderNo))
    if (!search.trim()) return list
    const q = search.toLowerCase()
    return list.filter(
      (o) =>
        o.orderNo.toLowerCase().includes(q) ||
        o.customerName.toLowerCase().includes(q) ||
        o.jobName.toLowerCase().includes(q),
    )
  }, [search, dataTick])

  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-xl font-bold">Orders to Dispatch</h2>
        <p className="text-sm text-text-secondary">{orders.length} with balance remaining</p>
      </div>

      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-text-secondary" />
        <input
          type="search"
          placeholder="Search order or customer…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className={`${searchInputFieldClass} pl-10 rounded-xl text-base`}
        />
      </div>

      {orders.length === 0 && (
        <p className="text-center text-text-secondary py-12">No orders ready for dispatch.</p>
      )}

      <ul className="space-y-3">
        {orders.map((order) => {
          const balance = getOrderBalanceQty(order)
          const dispatched = getOrderDispatchedQty(order)
          return (
            <li key={order.id}>
              <button
                type="button"
                onClick={() => navigate(`/m/orders/${order.id}`)}
                className="w-full text-left bg-surface rounded-xl border border-border p-4 active:bg-background touch-manipulation shadow-level-1"
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="font-bold text-lg truncate">{order.orderNo}</p>
                    <p className="text-sm text-text-secondary truncate">{order.customerName}</p>
                  </div>
                  <ChevronRight className="w-6 h-6 text-text-secondary shrink-0 mt-1" />
                </div>
                <div className="flex gap-4 mt-3 text-sm tabular-nums">
                  <span>
                    <span className="text-text-secondary">Balance </span>
                    <span className="font-bold text-warning">{balance}</span>
                  </span>
                  <span>
                    <span className="text-text-secondary">Dispatched </span>
                    <span className="font-semibold text-success">{dispatched}</span>
                  </span>
                  <span>
                    <span className="text-text-secondary">Total </span>
                    <span className="font-semibold">{order.totalQuantity}</span>
                  </span>
                </div>
              </button>
            </li>
          )
        })}
      </ul>
    </div>
  )
}
