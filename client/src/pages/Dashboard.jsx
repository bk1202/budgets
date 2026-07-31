import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import { PieChart, Pie, Cell, ResponsiveContainer, XAxis, YAxis, Tooltip, BarChart, Bar } from 'recharts'
import api from '../api'
import { formatCurrency } from '../utils'
import toast from 'react-hot-toast'

export default function Dashboard() {
  const [summary, setSummary] = useState(null)
  const [recommendations, setRecommendations] = useState([])
  const [recentTxns, setRecentTxns] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    loadDashboard()
  }, [])

  async function loadDashboard() {
    try {
      const [summaryRes, recsRes, txnsRes] = await Promise.all([
        api.get('/analytics/summary'),
        api.get('/analytics/recommendations'),
        api.get('/transactions', { params: { limit: 8, sort: 'date', order: 'desc' } }),
      ])
      setSummary(summaryRes.data)
      setRecommendations(recsRes.data)
      setRecentTxns(txnsRes.data.transactions)
    } catch (err) {
      toast.error('Failed to load dashboard')
    } finally {
      setLoading(false)
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin w-8 h-8 border-2 border-indigo-500 border-t-transparent rounded-full"></div>
      </div>
    )
  }

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Hero Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="card">
          <div className="flex items-center gap-2 text-[#8b8b9e] text-xs uppercase tracking-wider mb-2">
            <i className="ri-arrow-down-circle-line text-red-400"></i> Spending (30d)
          </div>
          <div className="text-2xl md:text-3xl font-bold text-white">
            {formatCurrency(summary?.totalSpending || 0)}
          </div>
        </div>
        <div className="card">
          <div className="flex items-center gap-2 text-[#8b8b9e] text-xs uppercase tracking-wider mb-2">
            <i className="ri-arrow-up-circle-line text-green-400"></i> Income (30d)
          </div>
          <div className="text-2xl md:text-3xl font-bold text-green-400">
            {formatCurrency(summary?.totalIncome || 0)}
          </div>
        </div>
        <div className="card">
          <div className="flex items-center gap-2 text-[#8b8b9e] text-xs uppercase tracking-wider mb-2">
            <i className="ri-percent-line text-indigo-400"></i> Week over Week
          </div>
          <div className={`text-2xl md:text-3xl font-bold ${(summary?.weekOverWeek?.change || 0) > 0 ? 'text-red-400' : 'text-green-400'}`}>
            {(summary?.weekOverWeek?.change || 0) > 0 ? '+' : ''}{summary?.weekOverWeek?.change?.toFixed(0) || 0}%
          </div>
        </div>
        <div className="card">
          <div className="flex items-center gap-2 text-[#8b8b9e] text-xs uppercase tracking-wider mb-2">
            <i className="ri-exchange-dollar-line text-purple-400"></i> Transactions
          </div>
          <div className="text-2xl md:text-3xl font-bold text-white">
            {summary?.transactionCount || 0}
          </div>
        </div>
      </div>

      {/* Charts Row */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Daily Spending Trend */}
        <div className="card">
          <h3 className="text-sm font-semibold text-white mb-4 flex items-center gap-2">
            <i className="ri-line-chart-line text-indigo-400"></i>
            Daily Spending Trend
          </h3>
          {summary?.dailyTrend?.length > 0 ? (
            <ResponsiveContainer width="100%" height={220}>
              <BarChart data={summary.dailyTrend}>
                <XAxis dataKey="date" tick={{ fontSize: 11, fill: '#5b5b6e' }} axisLine={false} tickLine={false}
                  tickFormatter={d => new Date(d + 'T00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric' })} />
                <Tooltip
                  contentStyle={{ background: '#1a1a20', border: '1px solid #2a2a35', borderRadius: '8px', color: '#fff' }}
                  formatter={(val) => [formatCurrency(val), 'Spent']}
                  labelFormatter={(l) => new Date(l + 'T00:00').toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })}
                />
                <Bar dataKey="total" fill="#6366f1" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <div className="text-center py-10 text-[#5b5b6e] text-sm">No spending data yet</div>
          )}
        </div>

        {/* Category Breakdown */}
        <div className="card">
          <h3 className="text-sm font-semibold text-white mb-4 flex items-center gap-2">
            <i className="ri-pie-chart-line text-indigo-400"></i>
            Top Categories
          </h3>
          {summary?.topCategories?.length > 0 ? (
            <div className="flex items-center gap-4">
              <ResponsiveContainer width="55%" height={200}>
                <PieChart>
                  <Pie data={summary.topCategories} dataKey="total" nameKey="name" cx="50%" cy="50%" outerRadius={80} innerRadius={50}>
                    {summary.topCategories.map((_, i) => (
                      <Cell key={i} fill={_.color} stroke="transparent" />
                    ))}
                  </Pie>
                  <Tooltip
                    contentStyle={{ background: '#1a1a20', border: '1px solid #2a2a35', borderRadius: '8px', color: '#fff' }}
                    formatter={(val) => [formatCurrency(val), '']}
                  />
                </PieChart>
              </ResponsiveContainer>
              <div className="flex-1 space-y-2">
                {summary.topCategories.slice(0, 5).map((cat, i) => {
                  const total = summary.topCategories.reduce((s, c) => s + c.total, 0)
                  const pct = total > 0 ? ((cat.total / total) * 100).toFixed(0) : 0
                  return (
                    <div key={i} className="flex items-center justify-between text-sm">
                      <div className="flex items-center gap-2">
                        <div className="w-2.5 h-2.5 rounded-full" style={{ background: cat.color }}></div>
                        <span className="text-[#8b8b9e]">{cat.name}</span>
                      </div>
                      <span className="text-white font-medium">{pct}%</span>
                    </div>
                  )
                })}
              </div>
            </div>
          ) : (
            <div className="text-center py-10 text-[#5b5b6e] text-sm">No category data yet</div>
          )}
        </div>
      </div>

      {/* Recommendations */}
      {recommendations.length > 0 && (
        <div>
          <h3 className="text-sm font-semibold text-white mb-3 flex items-center gap-2">
            <i className="ri-lightbulb-line text-yellow-400"></i>
            Smart Recommendations
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {recommendations.slice(0, 3).map((rec, i) => (
              <div key={i} className="card border-l-4" style={{ borderLeftColor: rec.color || '#6366f1' }}>
                <div className="flex items-start gap-3">
                  <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${
                    rec.severity === 'high' ? 'bg-red-500/10 text-red-400' :
                    rec.severity === 'medium' ? 'bg-yellow-500/10 text-yellow-400' :
                    'bg-blue-500/10 text-blue-400'
                  }`}>
                    <i className={rec.severity === 'high' ? 'ri-alert-line' : rec.severity === 'medium' ? 'ri-error-warning-line' : 'ri-information-line'}></i>
                  </div>
                  <div className="flex-1 min-w-0">
                    <h4 className="text-sm font-semibold text-white">{rec.title}</h4>
                    <p className="text-xs text-[#8b8b9e] mt-1 line-clamp-2">{rec.description}</p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Recent Transactions */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-sm font-semibold text-white flex items-center gap-2">
            <i className="ri-history-line text-indigo-400"></i>
            Recent Transactions
          </h3>
          <Link to="/transactions" className="text-xs text-indigo-400 hover:text-indigo-300 font-medium transition-colors">
            View all <i className="ri-arrow-right-line"></i>
          </Link>
        </div>
        <div className="card p-0 overflow-hidden">
          {recentTxns.length > 0 ? (
            recentTxns.map((txn, i) => (
              <div key={txn.id}
                className={`flex items-center justify-between px-5 py-3.5 hover:bg-[#1e1e28] transition-colors cursor-pointer ${
                  i < recentTxns.length - 1 ? 'border-b border-[#2a2a35]' : ''
                }`}
              >
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-lg flex items-center justify-center text-sm"
                    style={{ background: `${txn.category_color || '#6366f1'}15`, color: txn.category_color || '#6366f1' }}
                  >
                    <i className={`ri-${txn.category_icon || 'more-line'}`}></i>
                  </div>
                  <div>
                    <div className="text-sm font-medium text-white truncate max-w-[180px]">{txn.name}</div>
                    <div className="text-xs text-[#5b5b6e]">
                      {txn.category_name} · {new Date(txn.date + 'T00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                    </div>
                  </div>
                </div>
                <div className={`text-sm font-semibold ${txn.amount < 0 ? 'text-red-400' : 'text-green-400'}`}>
                  {txn.amount < 0 ? '-' : '+'}{formatCurrency(Math.abs(txn.amount))}
                </div>
              </div>
            ))
          ) : (
            <div className="text-center py-10 text-[#5b5b6e]">
              <i className="ri-inbox-line text-3xl block mb-2"></i>
              <span className="text-sm">No transactions yet. Connect your bank to get started!</span>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
