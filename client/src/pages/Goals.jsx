import { useState, useEffect } from 'react'
import api from '../api'
import { formatCurrency } from '../utils'
import toast from 'react-hot-toast'

export default function Goals() {
  const [goals, setGoals] = useState([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [form, setForm] = useState({ name: '', target_amount: '', current_amount: '', target_date: '' })
  const [addAmounts, setAddAmounts] = useState({})

  useEffect(() => { loadGoals() }, [])

  async function loadGoals() {
    setLoading(true)
    try {
      const res = await api.get('/goals')
      setGoals(res.data)
    } catch { toast.error('Failed to load goals') }
    finally { setLoading(false) }
  }

  async function createGoal() {
    if (!form.name || !form.target_amount) return toast.error('Name and target amount required')
    try {
      await api.post('/goals', form)
      setShowForm(false)
      setForm({ name: '', target_amount: '', current_amount: '', target_date: '' })
      loadGoals()
      toast.success('Goal created!')
    } catch { toast.error('Failed to create goal') }
  }

  async function addFunds(id) {
    const amount = parseFloat(addAmounts[id])
    if (!amount || amount <= 0) return toast.error('Enter a valid amount')
    try {
      await api.patch(`/goals/${id}`, { add_amount: amount })
      setAddAmounts(prev => ({ ...prev, [id]: '' }))
      loadGoals()
      toast.success(`Added ${formatCurrency(amount)}!`)
    } catch { toast.error('Failed to add funds') }
  }

  async function deleteGoal(id) {
    if (!window.confirm('Delete this savings goal?')) return
    try {
      await api.delete(`/goals/${id}`)
      loadGoals()
      toast.success('Goal deleted')
    } catch { toast.error('Failed to delete goal') }
  }

  const totalSaved = goals.reduce((s, g) => s + (g.current_amount || 0), 0)
  const totalTarget = goals.reduce((s, g) => s + g.target_amount, 0)

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-baseline gap-2">
            <span className="text-3xl font-bold text-white">{formatCurrency(totalSaved)}</span>
            <span className="text-[#8b8b9e] text-sm">saved of {formatCurrency(totalTarget)}</span>
          </div>
          <div className="mt-2">
            <div className="progress-bar w-full max-w-sm">
              <div
                className="progress-bar-fill bg-gradient-to-r from-emerald-500 to-teal-400"
                style={{ width: `${Math.min((totalSaved / (totalTarget || 1)) * 100, 100)}%` }}
              ></div>
            </div>
            <span className="text-xs text-[#5b5b6e] mt-1 block">
              {totalTarget > 0 ? ((totalSaved / totalTarget) * 100).toFixed(0) : 0}% of total goal
            </span>
          </div>
        </div>
        <button className="btn btn-primary" onClick={() => setShowForm(true)}>
          <i className="ri-add-line"></i> New Goal
        </button>
      </div>

      {/* Create Form */}
      {showForm && (
        <div className="card border-emerald-500/30 bg-emerald-500/5">
          <h3 className="text-sm font-semibold text-white mb-4 flex items-center gap-2">
            <i className="ri-add-circle-line text-emerald-400"></i> Create Savings Goal
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="text-xs text-[#8b8b9e] mb-1 block">Goal Name *</label>
              <input value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} placeholder="e.g., Emergency Fund" />
            </div>
            <div>
              <label className="text-xs text-[#8b8b9e] mb-1 block">Target Amount ($) *</label>
              <input type="number" value={form.target_amount} onChange={e => setForm(f => ({ ...f, target_amount: e.target.value }))} placeholder="10000" />
            </div>
            <div>
              <label className="text-xs text-[#8b8b9e] mb-1 block">Current Amount ($)</label>
              <input type="number" value={form.current_amount} onChange={e => setForm(f => ({ ...f, current_amount: e.target.value }))} placeholder="0" />
            </div>
            <div>
              <label className="text-xs text-[#8b8b9e] mb-1 block">Target Date (optional)</label>
              <input type="date" value={form.target_date} onChange={e => setForm(f => ({ ...f, target_date: e.target.value }))} />
            </div>
          </div>
          <div className="flex gap-3 mt-4">
            <button className="btn btn-primary" onClick={createGoal}>Create Goal</button>
            <button className="btn btn-secondary" onClick={() => setShowForm(false)}>Cancel</button>
          </div>
        </div>
      )}

      {/* Goals Grid */}
      {loading ? (
        <div className="flex items-center justify-center py-20">
          <div className="animate-spin w-6 h-6 border-2 border-indigo-500 border-t-transparent rounded-full"></div>
        </div>
      ) : goals.length > 0 ? (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {goals.map(goal => {
            const pct = (goal.current_amount || 0) / goal.target_amount
            const isComplete = pct >= 1
            const daysLeft = goal.target_date
              ? Math.ceil((new Date(goal.target_date + 'T00:00') - new Date()) / (1000 * 60 * 60 * 24))
              : null
            const monthlyNeeded = daysLeft && daysLeft > 0 && pct < 1
              ? (goal.target_amount - (goal.current_amount || 0)) / Math.max(1, daysLeft / 30)
              : 0

            return (
              <div key={goal.id} className={`card relative overflow-hidden ${isComplete ? 'border-emerald-500/30' : ''}`}>
                <div className={`absolute top-0 left-0 right-0 h-1 ${isComplete ? 'bg-emerald-500' : 'bg-emerald-500/50'}`}></div>

                <div className="flex items-start justify-between mb-4">
                  <div>
                    <div className="flex items-center gap-2">
                      <div className="w-8 h-8 rounded-lg bg-emerald-500/15 flex items-center justify-center text-emerald-400">
                        <i className={isComplete ? 'ri-checkbox-circle-line' : 'ri-piggy-bank-line'}></i>
                      </div>
                      <div>
                        <h3 className="text-sm font-semibold text-white">{goal.name}</h3>
                        {goal.target_date && (
                          <span className={`text-xs ${daysLeft < 0 ? 'text-red-400' : daysLeft <= 30 ? 'text-yellow-400' : 'text-[#5b5b6e]'}`}>
                            {daysLeft < 0 ? `${Math.abs(daysLeft)} days past deadline` : `${daysLeft} days left`}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                  <button className="text-[#5b5b6e] hover:text-red-400 transition-colors p-1" onClick={() => deleteGoal(goal.id)} title="Delete">
                    <i className="ri-delete-bin-line"></i>
                  </button>
                </div>

                <div className="flex items-baseline justify-between mb-2">
                  <span className="text-2xl font-bold text-white">{formatCurrency(goal.current_amount || 0)}</span>
                  <span className="text-sm text-[#8b8b9e]">of {formatCurrency(goal.target_amount)}</span>
                </div>

                {/* Progress Bar */}
                <div className="progress-bar mb-3">
                  <div
                    className="progress-bar-fill bg-gradient-to-r from-emerald-500 to-teal-400"
                    style={{ width: `${Math.min(pct * 100, 100)}%`, transition: 'width 0.8s cubic-bezier(0.4, 0, 0.2, 1)' }}
                  ></div>
                </div>

                <div className="flex items-center justify-between mb-4">
                  <span className={`text-xs font-medium ${isComplete ? 'text-emerald-400' : 'text-[#8b8b9e]'}`}>
                    {isComplete ? '🎉 Goal reached!' : `${(pct * 100).toFixed(0)}% complete`}
                  </span>
                  {!isComplete && monthlyNeeded > 0 && (
                    <span className="text-xs text-[#5b5b6e]">
                      {formatCurrency(monthlyNeeded)}/mo needed
                    </span>
                  )}
                </div>

                {/* Add Funds */}
                {!isComplete && (
                  <div className="flex items-center gap-2 p-3 rounded-lg bg-[#141418]">
                    <input
                      type="number"
                      placeholder="Amount"
                      className="flex-1 text-sm py-1.5"
                      value={addAmounts[goal.id] || ''}
                      onChange={e => setAddAmounts(prev => ({ ...prev, [goal.id]: e.target.value }))}
                      onKeyDown={e => e.key === 'Enter' && addFunds(goal.id)}
                    />
                    <button className="btn btn-primary btn-sm" onClick={() => addFunds(goal.id)}>
                      <i className="ri-add-line"></i> Add
                    </button>
                  </div>
                )}
              </div>
            )
          })}
        </div>
      ) : (
        <div className="text-center py-16 card">
          <i className="ri-piggy-bank-line text-4xl text-[#2a2a35] block mb-3"></i>
          <p className="text-[#8b8b9e]">No savings goals yet</p>
          <p className="text-xs text-[#5b5b6e] mt-1 mb-4">Set a savings goal and track your progress</p>
          <button className="btn btn-primary" onClick={() => setShowForm(true)}>Create Your First Goal</button>
        </div>
      )}
    </div>
  )
}
