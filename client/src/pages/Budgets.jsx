import { useState, useEffect } from 'react'
import api from '../api'
import { formatCurrency } from '../utils'
import toast from 'react-hot-toast'

const SEVERITY_COLORS = { high: 'bg-red-500', medium: 'bg-yellow-500', low: 'bg-indigo-500' }
const SEVERITY_TEXT = { high: 'text-red-400', medium: 'text-yellow-400', low: 'text-indigo-400' }

function getSeverity(pct) {
  if (pct >= 1) return 'high'
  if (pct >= 0.8) return 'medium'
  return 'low'
}

export default function Budgets() {
  const [budgets, setBudgets] = useState([])
  const [categories, setCategories] = useState([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [form, setForm] = useState({
    name: '', amount: '', category_id: '',
    start_date: new Date().toISOString().slice(0, 10),
    end_date: new Date(new Date().setMonth(new Date().getMonth() + 1)).toISOString().slice(0, 10),
    alert_threshold: 0.8,
  })

  useEffect(() => {
    loadData()
  }, [])

  async function loadData() {
    setLoading(true)
    try {
      const [budgetsRes, catsRes] = await Promise.all([
        api.get('/budgets'),
        api.get('/categories'),
      ])
      setBudgets(budgetsRes.data)
      setCategories(catsRes.data)
    } catch { toast.error('Failed to load data') }
    finally { setLoading(false) }
  }

  async function createBudget() {
    if (!form.name || !form.amount) return toast.error('Name and amount required')
    try {
      await api.post('/budgets', form)
      setShowForm(false)
      setForm({ name: '', amount: '', category_id: '', start_date: new Date().toISOString().slice(0, 10), end_date: new Date(new Date().setMonth(new Date().getMonth() + 1)).toISOString().slice(0, 10), alert_threshold: 0.8 })
      loadData()
      toast.success('Budget created!')
    } catch { toast.error('Failed to create budget') }
  }

  async function deleteBudget(id) {
    if (!window.confirm('Are you sure you want to delete this budget?')) return
    try {
      await api.delete(`/budgets/${id}`)
      loadData()
      toast.success('Budget deleted')
    } catch { toast.error('Failed to delete budget') }
  }

  const getTotalBudgeted = () => budgets.reduce((s, b) => s + parseFloat(b.amount), 0)
  const getTotalSpent = () => budgets.reduce((s, b) => s + (b.spent || 0), 0)

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-3">
            <div className="flex items-baseline gap-1">
              <span className="text-3xl font-bold text-white">{formatCurrency(getTotalSpent())}</span>
              <span className="text-[#8b8b9e] text-sm">of {formatCurrency(getTotalBudgeted())}</span>
            </div>
          </div>
          <div className="mt-2">
            <div className="progress-bar w-full max-w-sm">
              <div
                className="progress-bar-fill bg-indigo-500"
                style={{ width: `${Math.min((getTotalSpent() / (getTotalBudgeted() || 1)) * 100, 100)}%` }}
              ></div>
            </div>
          </div>
        </div>
        <button className="btn btn-primary" onClick={() => setShowForm(true)}>
          <i className="ri-add-line"></i> New Budget
        </button>
      </div>

      {/* Create Form */}
      {showForm && (
        <div className="card border-indigo-500/30 bg-indigo-500/5">
          <h3 className="text-sm font-semibold text-white mb-4 flex items-center gap-2">
            <i className="ri-add-circle-line text-indigo-400"></i> Create Budget
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className="text-xs text-[#8b8b9e] mb-1 block">Budget Name *</label>
              <input value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} placeholder="e.g., Groceries Budget" />
            </div>
            <div>
              <label className="text-xs text-[#8b8b9e] mb-1 block">Monthly Amount ($) *</label>
              <input type="number" value={form.amount} onChange={e => setForm(f => ({ ...f, amount: e.target.value }))} placeholder="500" />
            </div>
            <div>
              <label className="text-xs text-[#8b8b9e] mb-1 block">Category</label>
              <select value={form.category_id} onChange={e => setForm(f => ({ ...f, category_id: e.target.value }))}>
                <option value="">All Spending</option>
                {categories.map(cat => (
                  <>
                    <option key={cat.id} value={cat.id}>{cat.name}</option>
                    {cat.children?.map(child => (
                      <option key={child.id} value={child.id}>  └ {child.name}</option>
                    ))}
                  </>
                ))}
              </select>
            </div>
            <div>
              <label className="text-xs text-[#8b8b9e] mb-1 block">Start Date</label>
              <input type="date" value={form.start_date} onChange={e => setForm(f => ({ ...f, start_date: e.target.value }))} />
            </div>
            <div>
              <label className="text-xs text-[#8b8b9e] mb-1 block">End Date</label>
              <input type="date" value={form.end_date} onChange={e => setForm(f => ({ ...f, end_date: e.target.value }))} />
            </div>
            <div>
              <label className="text-xs text-[#8b8b9e] mb-1 block">Alert Threshold</label>
              <select value={form.alert_threshold} onChange={e => setForm(f => ({ ...f, alert_threshold: parseFloat(e.target.value) }))}>
                <option value="0.5">50%</option>
                <option value="0.6">60%</option>
                <option value="0.7">70%</option>
                <option value="0.8">80%</option>
                <option value="0.9">90%</option>
                <option value="1.0">100%</option>
              </select>
            </div>
          </div>
          <div className="flex gap-3 mt-4">
            <button className="btn btn-primary" onClick={createBudget}>Create Budget</button>
            <button className="btn btn-secondary" onClick={() => setShowForm(false)}>Cancel</button>
          </div>
        </div>
      )}

      {/* Budgets Grid */}
      {loading ? (
        <div className="flex items-center justify-center py-20">
          <div className="animate-spin w-6 h-6 border-2 border-indigo-500 border-t-transparent rounded-full"></div>
        </div>
      ) : budgets.length > 0 ? (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {budgets.map(budget => {
            const pct = (budget.spent || 0) / budget.amount
            const severity = getSeverity(pct)
            return (
              <div key={budget.id} className={`card relative overflow-hidden ${pct >= 1 ? 'border-red-500/30' : pct >= 0.8 ? 'border-yellow-500/30' : ''}`}>
                {/* Decorative top bar */}
                <div className={`absolute top-0 left-0 right-0 h-1 ${SEVERITY_COLORS[severity]}`}></div>
                <div className="flex items-start justify-between mb-3">
                  <div>
                    <div className="flex items-center gap-2">
                      <div className="w-8 h-8 rounded-lg flex items-center justify-center"
                        style={{ background: `${budget.category_color || '#6366f1'}15`, color: budget.category_color || '#6366f1' }}>
                        <i className={`ri-${budget.category_icon || 'wallet-line'}`}></i>
                      </div>
                      <div>
                        <h3 className="text-sm font-semibold text-white">{budget.name}</h3>
                        <span className="text-xs text-[#5b5b6e]">{budget.category_name || 'All Categories'}</span>
                      </div>
                    </div>
                  </div>
                  <button className="text-[#5b5b6e] hover:text-red-400 transition-colors p-1" onClick={() => deleteBudget(budget.id)} title="Delete">
                    <i className="ri-delete-bin-line"></i>
                  </button>
                </div>

                <div className="flex items-baseline justify-between mb-2">
                  <span className="text-2xl font-bold text-white">{formatCurrency(budget.spent || 0)}</span>
                  <span className="text-sm text-[#8b8b9e]">of {formatCurrency(budget.amount)}</span>
                </div>

                {/* Progress Bar */}
                <div className="progress-bar mb-2">
                  <div
                    className={`progress-bar-fill ${SEVERITY_COLORS[severity]}`}
                    style={{ width: `${Math.min(pct * 100, 100)}%`, transition: 'width 0.8s cubic-bezier(0.4, 0, 0.2, 1)' }}
                  ></div>
                </div>

                <div className="flex items-center justify-between">
                  <span className={`text-xs font-medium ${SEVERITY_TEXT[severity]}`}>
                    {pct >= 1 ? 'Over budget!' : pct >= budget.alert_threshold ? 'Almost there' : `${(pct * 100).toFixed(0)}% spent`}
                  </span>
                  <span className="text-xs text-[#5b5b6e]">
                    {new Date(budget.start_date + 'T00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric' })} –
                    {new Date(budget.end_date + 'T00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                  </span>
                </div>
              </div>
            )
          })}
        </div>
      ) : (
        <div className="text-center py-16 card">
          <i className="ri-wallet-line text-4xl text-[#2a2a35] block mb-3"></i>
          <p className="text-[#8b8b9e]">No budgets yet</p>
          <p className="text-xs text-[#5b5b6e] mt-1 mb-4">Create a budget to start tracking your spending limits</p>
          <button className="btn btn-primary" onClick={() => setShowForm(true)}>Create Your First Budget</button>
        </div>
      )}
    </div>
  )
}
