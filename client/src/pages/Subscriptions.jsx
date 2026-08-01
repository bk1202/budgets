import { useState, useEffect } from 'react'
import api from '../api'
import { formatCurrency } from '../utils'
import toast from 'react-hot-toast'

const CONFIDENCE_COLORS = {
  high: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30',
  medium: 'bg-yellow-500/10 text-yellow-400 border-yellow-500/30',
  low: 'bg-slate-500/10 text-slate-400 border-slate-500/30',
}

const FREQ_COLORS = {
  Monthly: 'bg-indigo-500/15 text-indigo-400',
  Weekly: 'bg-purple-500/15 text-purple-400',
  Quarterly: 'bg-cyan-500/15 text-cyan-400',
  Variable: 'bg-slate-500/15 text-slate-400',
}

export default function Subscriptions() {
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => { loadData() }, [])

  async function loadData() {
    setLoading(true)
    try {
      const res = await api.get('/subscriptions')
      setData(res.data)
    } catch { toast.error('Failed to load subscriptions') }
    finally { setLoading(false) }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="animate-spin w-6 h-6 border-2 border-indigo-500 border-t-transparent rounded-full"></div>
      </div>
    )
  }

  const { subscriptions, summary } = data || { subscriptions: [], summary: {} }

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Summary Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="card">
          <div className="flex items-center gap-2 text-[#8b8b9e] text-xs uppercase tracking-wider mb-2">
            <i className="ri-repeat-line text-indigo-400"></i> Confirmed Subs
          </div>
          <div className="text-2xl md:text-3xl font-bold text-white">{summary.total_subscriptions || 0}</div>
        </div>
        <div className="card">
          <div className="flex items-center gap-2 text-[#8b8b9e] text-xs uppercase tracking-wider mb-2">
            <i className="ri-question-line text-yellow-400"></i> Likely Subs
          </div>
          <div className="text-2xl md:text-3xl font-bold text-yellow-400">{summary.total_likely || 0}</div>
        </div>
        <div className="card">
          <div className="flex items-center gap-2 text-[#8b8b9e] text-xs uppercase tracking-wider mb-2">
            <i className="ri-calendar-check-line text-emerald-400"></i> Monthly Cost
          </div>
          <div className="text-2xl md:text-3xl font-bold text-emerald-400">{formatCurrency(summary.monthly_spend || 0)}</div>
        </div>
        <div className="card">
          <div className="flex items-center gap-2 text-[#8b8b9e] text-xs uppercase tracking-wider mb-2">
            <i className="ri-calendar-line text-purple-400"></i> Yearly Projection
          </div>
          <div className="text-2xl md:text-3xl font-bold text-purple-400">{formatCurrency(summary.yearly_spend || 0)}</div>
        </div>
      </div>

      {/* All subscriptions breakdown */}
      <div className="card">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-sm font-semibold text-white flex items-center gap-2">
            <i className="ri-file-list-3-line text-indigo-400"></i>
            All Detected Recurring Transactions
          </h3>
          <span className="text-xs text-[#5b5b6e]">
            {subscriptions.length} found · {formatCurrency(summary.all_monthly_spend || 0)}/mo total
          </span>
        </div>

        {subscriptions.length > 0 ? (
          <div className="space-y-2">
            {/* Header */}
            <div className="flex items-center gap-3 px-4 py-2 text-xs text-[#5b5b6e] uppercase tracking-wider border-b border-[#2a2a35]">
              <div className="flex-1">Name</div>
              <div className="w-20 text-center">Frequency</div>
              <div className="w-24 text-right hidden md:block">Monthly Est.</div>
              <div className="w-24 text-right hidden md:block">Next Due</div>
              <div className="w-16 text-right">Confidence</div>
            </div>

            {subscriptions.map((sub, i) => {
              const nextDueDate = sub.next_due ? new Date(sub.next_due + 'T00:00') : null
              const daysUntilDue = nextDueDate
                ? Math.ceil((nextDueDate - new Date()) / (1000 * 60 * 60 * 24))
                : null

              return (
                <div key={i} className="flex items-center gap-3 px-4 py-3 rounded-lg hover:bg-[#1c1c24] transition-colors">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <div className="w-8 h-8 rounded-lg flex items-center justify-center text-xs shrink-0"
                        style={{ background: `${sub.category_color}15`, color: sub.category_color }}>
                        <i className="ri-repeat-line"></i>
                      </div>
                      <div>
                        <div className="text-sm font-medium text-white truncate max-w-[200px] md:max-w-[300px]">{sub.name}</div>
                        <div className="text-xs text-[#5b5b6e]">
                          {sub.occurrences}x since {new Date(sub.first_date + 'T00:00').toLocaleDateString('en-US', { month: 'short', year: 'numeric' })}
                          {' · '}
                          <span style={{ color: sub.category_color }}>{sub.category_name}</span>
                        </div>
                      </div>
                    </div>
                  </div>
                  <div className="w-20 text-center">
                    <span className={`badge text-[10px] px-2 ${FREQ_COLORS[sub.frequency] || FREQ_COLORS.Variable}`}>
                      {sub.frequency}
                    </span>
                  </div>
                  <div className="w-24 text-right hidden md:block">
                    <span className="text-sm font-semibold text-white">{formatCurrency(sub.estimated_monthly)}</span>
                    <div className="text-[10px] text-[#5b5b6e]">/mo</div>
                  </div>
                  <div className="w-24 text-right hidden md:block">
                    {daysUntilDue !== null ? (
                      <div>
                        <span className={`text-sm font-medium ${daysUntilDue < 0 ? 'text-red-400' : daysUntilDue <= 7 ? 'text-yellow-400' : 'text-white'}`}>
                          {daysUntilDue < 0 ? 'Overdue' : `${daysUntilDue}d`}
                        </span>
                        <div className="text-[10px] text-[#5b5b6e]">
                          {new Date(sub.next_due + 'T00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                        </div>
                      </div>
                    ) : (
                      <span className="text-xs text-[#5b5b6e]">—</span>
                    )}
                  </div>
                  <div className="w-16 text-right">
                    <span className={`badge text-[10px] px-2 border ${CONFIDENCE_COLORS[sub.confidence]}`}>
                      {sub.confidence}
                    </span>
                  </div>
                </div>
              )
            })}
          </div>
        ) : (
          <div className="text-center py-12">
            <i className="ri-inbox-line text-3xl text-[#2a2a35] block mb-2"></i>
            <p className="text-[#8b8b9e] text-sm">No recurring transactions detected yet</p>
            <p className="text-xs text-[#5b5b6e] mt-1">Connect your bank and sync transactions to detect subscriptions</p>
          </div>
        )}
      </div>

      {/* How it works */}
      <div className="card bg-[#141418] border-[#2a2a35]">
        <h3 className="text-sm font-semibold text-white mb-3 flex items-center gap-2">
          <i className="ri-lightbulb-line text-yellow-400"></i>
          How Detection Works
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-xs text-[#8b8b9e]">
          <div className="p-3 rounded-lg bg-[#1c1c24]">
            <div className="font-medium text-white mb-1">🔍 Pattern Matching</div>
            <p>Groups transactions by name. Any merchant appearing 2+ times in 180 days is flagged as recurring.</p>
          </div>
          <div className="p-3 rounded-lg bg-[#1c1c24]">
            <div className="font-medium text-white mb-1">📊 Frequency Analysis</div>
            <p>Calculates average days between occurrences to classify as Weekly, Monthly, or Quarterly.</p>
          </div>
          <div className="p-3 rounded-lg bg-[#1c1c24]">
            <div className="font-medium text-white mb-1">✅ Confidence Scoring</div>
            <p>4+ occurrences with identical amounts = High confidence. 3+ with &lt;10% variance = Medium. Others = Low.</p>
          </div>
        </div>
      </div>
    </div>
  )
}
