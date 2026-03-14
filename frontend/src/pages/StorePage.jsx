import { useEffect, useState, useCallback, useRef } from 'react'
import {
  Store,
  Package,
  ShoppingCart,
  DollarSign,
  Users,
  TrendingUp,
} from 'lucide-react'

const STAT_CARDS = [
  { key: 'total_products', label: 'Total Products', icon: Package, color: 'text-accent' },
  { key: 'active_products', label: 'Active Products', icon: Package, color: 'text-green-400' },
  { key: 'total_orders', label: 'Total Orders', icon: ShoppingCart, color: 'text-blue-400' },
  { key: 'orders_today', label: 'Orders Today', icon: TrendingUp, color: 'text-yellow-400' },
  { key: 'total_revenue', label: 'Total Revenue', icon: DollarSign, color: 'text-green-400', format: (v) => `$${v.toFixed(2)}` },
  { key: 'total_subscribers', label: 'Subscribers', icon: Users, color: 'text-purple-400' },
]

export default function StorePage() {
  const [summary, setSummary] = useState(null)
  const [orders, setOrders] = useState([])
  const [loading, setLoading] = useState(false)
  const intervalRef = useRef(null)

  const fetchData = useCallback(() => {
    setLoading(true)
    Promise.all([
      fetch('/api/store/summary').then((r) => r.json()),
      fetch('/api/store/recent-orders').then((r) => r.json()),
    ])
      .then(([summaryData, ordersData]) => {
        setSummary(summaryData)
        setOrders(ordersData.orders || [])
      })
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [])

  useEffect(() => {
    fetchData()
    intervalRef.current = setInterval(fetchData, 60000)
    return () => clearInterval(intervalRef.current)
  }, [fetchData])

  return (
    <div>
      {/* Header */}
      <div className="mb-6">
        <h2 className="text-2xl font-bold text-white">Phyllis Dianne Studio</h2>
        <p className="text-text-dim text-sm mt-1">
          Store analytics and recent orders
        </p>
      </div>

      {/* Stat cards */}
      <div className="grid grid-cols-3 gap-4 mb-8">
        {STAT_CARDS.map((card) => {
          const Icon = card.icon
          const value = summary?.[card.key] ?? 0
          const display = card.format ? card.format(value) : value
          return (
            <div
              key={card.key}
              className="bg-card rounded-xl border border-border p-4 flex items-center gap-3"
            >
              <Icon size={20} className={card.color} />
              <div>
                <p className="text-text-dim text-xs uppercase tracking-wider">
                  {card.label}
                </p>
                <p className="text-xl font-bold text-white">
                  {loading && !summary ? '—' : display}
                </p>
              </div>
            </div>
          )
        })}
      </div>

      {/* Recent Orders Table */}
      <div className="bg-card rounded-xl border border-border overflow-hidden">
        <div className="px-6 py-4 border-b border-border">
          <h3 className="text-white font-semibold">Recent Orders</h3>
        </div>
        <div className="overflow-x-auto max-h-96 overflow-y-auto">
          <table className="w-full text-sm">
            <thead className="sticky top-0 bg-sidebar">
              <tr className="text-text-dim text-left text-xs">
                <th className="px-6 py-2.5">Date</th>
                <th className="px-6 py-2.5">Customer</th>
                <th className="px-6 py-2.5">Products</th>
                <th className="px-6 py-2.5 w-24">Amount</th>
                <th className="px-6 py-2.5 w-24">Status</th>
              </tr>
            </thead>
            <tbody>
              {orders.length === 0 ? (
                <tr>
                  <td
                    colSpan={5}
                    className="px-6 py-8 text-center text-text-dim italic"
                  >
                    {loading ? 'Loading...' : 'No orders yet'}
                  </td>
                </tr>
              ) : (
                orders.map((order) => (
                  <tr
                    key={order.id}
                    className="border-t border-border/50 hover:bg-sidebar/50"
                  >
                    <td className="px-6 py-2.5 font-mono text-text-dim">
                      {order.created_at}
                    </td>
                    <td className="px-6 py-2.5 text-text-dim">
                      {order.email}
                    </td>
                    <td className="px-6 py-2.5 text-white">
                      {order.products?.join(', ') || '—'}
                    </td>
                    <td className="px-6 py-2.5 font-mono text-green-400">
                      ${order.amount.toFixed(2)}
                    </td>
                    <td className="px-6 py-2.5">
                      {order.status === 'completed' ? (
                        <span className="text-xs px-2 py-0.5 rounded bg-green-500/15 text-green-400">
                          Completed
                        </span>
                      ) : order.status === 'pending' ? (
                        <span className="text-xs px-2 py-0.5 rounded bg-yellow-500/15 text-yellow-400">
                          Pending
                        </span>
                      ) : order.status === 'refunded' ? (
                        <span className="text-xs px-2 py-0.5 rounded bg-red-500/15 text-red-400">
                          Refunded
                        </span>
                      ) : (
                        <span className="text-xs px-2 py-0.5 rounded bg-border text-text-dim">
                          {order.status}
                        </span>
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Revenue today card */}
      {summary && summary.revenue_today > 0 && (
        <div className="mt-6 bg-card rounded-xl border border-border p-5 flex items-center gap-4">
          <DollarSign size={24} className="text-green-400" />
          <div>
            <p className="text-text-dim text-xs uppercase tracking-wider">
              Revenue Today
            </p>
            <p className="text-2xl font-bold text-green-400">
              ${summary.revenue_today.toFixed(2)}
            </p>
          </div>
        </div>
      )}
    </div>
  )
}
