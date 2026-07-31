import { useState, useEffect } from 'react'
import {
  BarChart, Bar, LineChart, Line, PieChart, Pie, Cell,
  ResponsiveContainer, XAxis, YAxis, Tooltip, CartesianGrid, AreaChart, Area,
} from 'recharts'
import api from '../api'
import { formatCurrency } from '../utils'
import toast from 'react-hot-toast'

export default function Analytics() {
  const [monthlyBreakdown, setMonthlyBreakdown] = useState([])
  const [categoryBreakdown, setCategoryBreakdown] = useState([])
  const [recommendations, setRecommendations] = useState([])
  const [loading, setLoading] = useState(true)
  const [dateRange, setDateRange] = useState({ start: '', end: '' })

  useEffect(() => {
    loadAnalytics()
  }, [dateRange])

  async function loadAnalytics() {
    setLoading(true)
    try {
      const [monthlyRes, catsRes, recsRes] = await Promise.all([
        api.get('/analytics/monthly-breakdown'),
        api.get('/analytics/category-breakdown', { params: dateRange }),
        api.get('/analytics/recommendations'),
      ])
      setMonthlyBreakdown(monthlyRes.data)
      setCategoryBreakdown(catsRes.data)
      setRecommendations(recsRes.data)
    } catch { toast.error('Failed to load analytics') }
    finally { setLoading(false) }
  }

  const totalSpending = categoryBreakdown.reduce((s, c) => s + c.total, 0)

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Date Range Filter */}
      <div className="flex items-center gap-3">
        <input type="date" value={dateRange.start} onChange={e => setDateRange(d => ({ ...d, start: e.target.value }))}
          className="w-auto" />
        <span className="text-[#8b8b9e]">to</span>
        <input type="date" value={dateRange.end} onChange={e => setDateRange(d => ({ ...d, end: e.target.value }))}
          className="w-auto" />
        {dateRange.start || dateRange.end ? (
          <button className="btn btn-secondary btn-sm" onClick={() => setDateRange({ start: '', end: '' })}>
            <i className="ri-close-line"></i> Clear
          </button>
        ) : null}
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-20">
          <div className="animate-spin w-6 h-6 border-2 border-indigo-500 border-t-transparent rounded-full"></div>
        </div>
      ) : (
        <>
          {/* Monthly Overview */}
          <div className="card">
            <h3 className="text-sm font-semibold text-white mb-4 flex items-center gap-2">
              <i className="ri-bar-chart-grouped-line text-indigo-400"></i>
              Monthly Income vs Spending
            </h3>
            {monthlyBreakdown.length > 0 ? (
              <ResponsiveContainer width="100%" height={300}>
                <BarChart data={monthlyBreakdown}>
                  <CartesianGrid stroke="#2a2a35" strokeDasharray="3 3" />
                  <XAxis dataKey="month" tick={{ fontSize: 12, fill: '#5b5b6e' }} axisLine={false} tickLine={false}
                    tickFormatter={m => {
                      const [y, mo] = m.split('-')
                      return new Date(y, mo - 1).toLocaleDateString('en-US', { month: 'short', year: '2-digit' })
                    }} />
                  <YAxis tick={{ fontSize: 11, fill: '#5b5b6e' }} axisLine={false} tickLine={false}
                    tickFormatter={v => `$${(v / 1000).toFixed(0)}k`} />
                  <Tooltip
                    contentStyle={{ background: '#1a1a20', border: '1px solid #2a2a35', borderRadius: '8px', color: '#fff' }}
                    formatter={(val, name) => [formatCurrency(val), name.charAt(0).toUpperCase() + name.slice(1)]}
                  />
                  <Bar dataKey="income" fill="#22c55e" radius={[4, 4, 0, 0]} name="income" />
                  <Bar dataKey="spending" fill="#ef4444" radius={[4, 4, 0, 0]} name="spending" />
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <p className="text-center py-10 text-[#5b5b6e] text-sm">No data for this period</p>
            )}
          </div>

          {/* Category Breakdown */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="card">
              <h3 className="text-sm font-semibold text-white mb-4 flex items-center gap-2">
                <i className="ri-pie-chart-2-line text-indigo-400"></i>
                Spending by Category
              </h3>
              {categoryBreakdown.length > 0 ? (
                <ResponsiveContainer width="100%" height={280}>
                  <PieChart>
                    <Pie data={categoryBreakdown.slice(0, 10)} dataKey="total" nameKey="name" cx="50%" cy="50%"
                      outerRadius={110} innerRadius={60} paddingAngle={2}>
                      {categoryBreakdown.slice(0, 10).map((cat, i) => (
                        <Cell key={i} fill={cat.color} stroke="transparent" />
                      ))}
                    </Pie>
                    <Tooltip
                      contentStyle={{ background: '#1a1a20', border: '1px solid #2a2a35', borderRadius: '8px', color: '#fff' }}
                      formatter={(val, name) => [formatCurrency(val), name]}
                    />
                  </PieChart>
                </ResponsiveContainer>
              ) : (
                <p className="text-center py-10 text-[#5b5b6e] text-sm">No category data</p>
              )}
            </div>

            <div className="card">
              <h3 className="text-sm font-semibold text-white mb-4 flex items-center gap-2">
                <i className="ri-list-check-2 text-indigo-400"></i>
                Category Breakdown
              </h3>
              {categoryBreakdown.length > 0 ? (
                <div className="space-y-3 max-h-[280px] overflow-y-auto pr-1">
                  {categoryBreakdown.map((cat, i) => {
                    const pct = totalSpending > 0 ? ((cat.total / totalSpending) * 100).toFixed(1) : 0
                    return (
                      <div key={cat.id}>
                        <div className="flex items-center justify-between mb-1">
                          <div className="flex items-center gap-2">
                            <div className="w-3 h-3 rounded-full" style={{ background: cat.color }}></div>
                            <span className="text-sm text-white">{cat.name}</span>
                          </div>
                          <div className="text-sm">
                            <span className="text-white font-medium">{formatCurrency(cat.total)}</span>
                            <span className="text-[#5b5b6e] ml-1">({pct}%)</span>
                          </div>
                        </div>
                        <div className="progress-bar">
                          <div className="progress-bar-fill" style={{
                            width: `${Math.min(pct + 5, 100)}%`,
                            background: `linear-gradient(90deg, ${cat.color}, ${cat.color}88)`
                          }}></div>
                        </div>
                      </div>
                    )
                  })}
                </div>
              ) : (
                <p className="text-center py-10 text-[#5b5b6e] text-sm">No category data</p>
              )}
            </div>
          </div>

          {/* All Recommendations */}
          {recommendations.length > 0 && (
            <div className="card">
              <h3 className="text-sm font-semibold text-white mb-4 flex items-center gap-2">
                <i className="ri-lightbulb-flash-line text-yellow-400"></i>
                All Recommendations
              </h3>
              <div className="space-y-3">
                {recommendations.map((rec, i) => (
                  <div key={i} className="flex items-start gap-3 p-3 rounded-lg bg-[#141418] hover:bg-[#1c1c24] transition-colors">
                    <div className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 ${
                      rec.severity === 'high' ? 'bg-red-500/10 text-red-400' :
                      rec.severity === 'medium' ? 'bg-yellow-500/10 text-yellow-400' :
                      'bg-blue-500/10 text-blue-400'
                    }`}>
                      <i className={rec.severity === 'high' ? 'ri-alert-line' :
                        rec.severity === 'medium' ? 'ri-error-warning-line' : 'ri-information-line'}></i>
                    </div>
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <h4 className="text-sm font-semibold text-white">{rec.title}</h4>
                        <span className={`badge text-[10px] ${
                          rec.severity === 'high' ? 'bg-red-500/15 text-red-400' :
                          rec.severity === 'medium' ? 'bg-yellow-500/15 text-yellow-400' :
                          'bg-blue-500/15 text-blue-400'
                        }`}>
                          {rec.type?.replace('_', ' ')}
                        </span>
                      </div>
                      <p className="text-xs text-[#8b8b9e] mt-1">{rec.description}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </>
      )}
    </div>
  )
}
