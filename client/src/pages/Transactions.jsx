import { useState, useEffect } from 'react'
import api from '../api'
import { formatCurrency } from '../utils'
import toast from 'react-hot-toast'

export default function Transactions() {
  const [transactions, setTransactions] = useState([])
  const [categories, setCategories] = useState([])
  const [total, setTotal] = useState(0)
  const [loading, setLoading] = useState(true)
  const [filters, setFilters] = useState({
    page: 1, limit: 50, category_id: '', search: '', start_date: '', end_date: '',
    min_amount: '', max_amount: '',
  })
  const [selected, setSelected] = useState([])
  const [bulkCategory, setBulkCategory] = useState('')
  const [editingId, setEditingId] = useState(null)
  const [showManualEntry, setShowManualEntry] = useState(false)
  const [manualForm, setManualForm] = useState({
    name: '', amount: '', date: new Date().toISOString().slice(0, 10),
    category_id: '', merchant: '', notes: '',
  })

  useEffect(() => { loadCategories() }, [])
  useEffect(() => { loadTransactions() }, [filters])

  async function loadCategories() {
    const res = await api.get('/categories')
    setCategories(res.data)
  }

  async function loadTransactions() {
    setLoading(true)
    try {
      const params = { ...filters }
      if (!params.category_id) delete params.category_id
      if (!params.search) delete params.search
      if (!params.start_date) delete params.start_date
      if (!params.end_date) delete params.end_date
      if (!params.min_amount) delete params.min_amount
      if (!params.max_amount) delete params.max_amount
      const res = await api.get('/transactions', { params })
      setTransactions(res.data.transactions)
      setTotal(res.data.total)
    } catch { toast.error('Failed to load transactions') }
    finally { setLoading(false) }
  }

  async function updateCategory(id, categoryId) {
    try {
      await api.patch(`/transactions/${id}`, { category_id: categoryId || null })
      setEditingId(null)
      loadTransactions()
      toast.success('Category updated')
    } catch { toast.error('Update failed') }
  }

  async function bulkUpdateCategory() {
    if (!selected.length || !bulkCategory) return
    try {
      await api.post('/transactions/bulk-update-category', {
        transaction_ids: selected, category_id: parseInt(bulkCategory),
      })
      setSelected([])
      setBulkCategory('')
      loadTransactions()
      toast.success(`Updated ${selected.length} transactions`)
    } catch { toast.error('Bulk update failed') }
  }

  async function createManualTransaction() {
    if (!manualForm.name || !manualForm.amount || !manualForm.date) {
      return toast.error('Name, amount, and date are required')
    }
    try {
      await api.post('/transactions', manualForm)
      setShowManualEntry(false)
      setManualForm({ name: '', amount: '', date: new Date().toISOString().slice(0, 10), category_id: '', merchant: '', notes: '' })
      loadTransactions()
      toast.success('Transaction added!')
    } catch { toast.error('Failed to create transaction') }
  }

  function exportCSV() {
    const params = new URLSearchParams()
    if (filters.start_date) params.set('start_date', filters.start_date)
    if (filters.end_date) params.set('end_date', filters.end_date)
    if (filters.category_id) params.set('category_id', filters.category_id)
    const link = document.createElement('a')
    link.href = `/api/export/transactions?${params.toString()}`
    link.download = `transactions-${new Date().toISOString().slice(0, 10)}.csv`
    link.click()
  }

  const toggleSelect = (id) => {
    setSelected(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id])
  }

  const toggleAll = () => {
    if (selected.length === transactions.length) setSelected([])
    else setSelected(transactions.map(t => t.id))
  }

  const totalPages = Math.ceil(total / filters.limit)

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Action Bar */}
      <div className="flex flex-wrap items-center gap-3">
        <button className="btn btn-primary" onClick={() => setShowManualEntry(true)}>
          <i className="ri-add-line"></i> Add Transaction
        </button>
        <button className="btn btn-secondary" onClick={exportCSV}>
          <i className="ri-file-download-line"></i> Export CSV
        </button>
      </div>

      {/* Manual Entry Modal */}
      {showManualEntry && (
        <div className="card border-indigo-500/30 bg-indigo-500/5">
          <h3 className="text-sm font-semibold text-white mb-4 flex items-center gap-2">
            <i className="ri-add-circle-line text-indigo-400"></i> Add Manual Transaction
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className="text-xs text-[#8b8b9e] mb-1 block">Description *</label>
              <input value={manualForm.name} onChange={e => setManualForm(f => ({ ...f, name: e.target.value }))} placeholder="e.g., Coffee at Starbucks" />
            </div>
            <div>
              <label className="text-xs text-[#8b8b9e] mb-1 block">Amount * <span className="text-[#5b5b6e]">(negative = spending)</span></label>
              <input type="number" step="0.01" value={manualForm.amount} onChange={e => setManualForm(f => ({ ...f, amount: e.target.value }))} placeholder="-4.50" />
            </div>
            <div>
              <label className="text-xs text-[#8b8b9e] mb-1 block">Date *</label>
              <input type="date" value={manualForm.date} onChange={e => setManualForm(f => ({ ...f, date: e.target.value }))} />
            </div>
            <div>
              <label className="text-xs text-[#8b8b9e] mb-1 block">Category</label>
              <select value={manualForm.category_id} onChange={e => setManualForm(f => ({ ...f, category_id: e.target.value }))}>
                <option value="">Uncategorized</option>
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
              <label className="text-xs text-[#8b8b9e] mb-1 block">Merchant</label>
              <input value={manualForm.merchant} onChange={e => setManualForm(f => ({ ...f, merchant: e.target.value }))} placeholder="Optional" />
            </div>
            <div>
              <label className="text-xs text-[#8b8b9e] mb-1 block">Notes</label>
              <input value={manualForm.notes} onChange={e => setManualForm(f => ({ ...f, notes: e.target.value }))} placeholder="Optional" />
            </div>
          </div>
          <div className="flex gap-3 mt-4">
            <button className="btn btn-primary" onClick={createManualTransaction}>Add Transaction</button>
            <button className="btn btn-secondary" onClick={() => setShowManualEntry(false)}>Cancel</button>
          </div>
        </div>
      )}

      {/* Filters */}
      <div className="card">
        <div className="flex flex-wrap gap-3 items-end">
          <div className="flex-1 min-w-[180px]">
            <label className="text-xs text-[#8b8b9e] mb-1 block">Search</label>
            <div className="relative">
              <i className="ri-search-line absolute left-3 top-1/2 -translate-y-1/2 text-[#5b5b6e]"></i>
              <input type="text" placeholder="Search transactions..." className="pl-9"
                value={filters.search} onChange={e => setFilters(f => ({ ...f, search: e.target.value, page: 1 }))} />
            </div>
          </div>
          <div className="min-w-[160px]">
            <label className="text-xs text-[#8b8b9e] mb-1 block">Category</label>
            <select value={filters.category_id} onChange={e => setFilters(f => ({ ...f, category_id: e.target.value, page: 1 }))}>
              <option value="">All Categories</option>
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
            <label className="text-xs text-[#8b8b9e] mb-1 block">From</label>
            <input type="date" value={filters.start_date} onChange={e => setFilters(f => ({ ...f, start_date: e.target.value, page: 1 }))} />
          </div>
          <div>
            <label className="text-xs text-[#8b8b9e] mb-1 block">To</label>
            <input type="date" value={filters.end_date} onChange={e => setFilters(f => ({ ...f, end_date: e.target.value, page: 1 }))} />
          </div>
          <div className="min-w-[100px]">
            <label className="text-xs text-[#8b8b9e] mb-1 block">Min $</label>
            <input type="number" placeholder="Min" value={filters.min_amount} onChange={e => setFilters(f => ({ ...f, min_amount: e.target.value, page: 1 }))} />
          </div>
          <div className="min-w-[100px]">
            <label className="text-xs text-[#8b8b9e] mb-1 block">Max $</label>
            <input type="number" placeholder="Max" value={filters.max_amount} onChange={e => setFilters(f => ({ ...f, max_amount: e.target.value, page: 1 }))} />
          </div>
          <button className="btn btn-secondary h-[42px]" onClick={() => setFilters({ page: 1, limit: 50, category_id: '', search: '', start_date: '', end_date: '', min_amount: '', max_amount: '' })}>
            <i className="ri-refresh-line"></i> Clear
          </button>
        </div>
      </div>

      {/* Bulk Actions */}
      {selected.length > 0 && (
        <div className="card flex items-center gap-3 bg-indigo-500/5 border-indigo-500/30">
          <span className="text-sm font-medium text-white">{selected.length} selected</span>
          <select value={bulkCategory} onChange={e => setBulkCategory(e.target.value)} className="w-auto">
            <option value="">Assign category...</option>
            {categories.map(cat => (
              <>
                <option key={cat.id} value={cat.id}>{cat.name}</option>
                {cat.children?.map(child => (
                  <option key={child.id} value={child.id}>  └ {child.name}</option>
                ))}
              </>
            ))}
          </select>
          <button className="btn btn-primary btn-sm" onClick={bulkUpdateCategory} disabled={!bulkCategory}>Apply</button>
          <button className="btn btn-secondary btn-sm" onClick={() => { setSelected([]); setBulkCategory('') }}><i className="ri-close-line"></i> Clear</button>
        </div>
      )}

      {/* Transactions List */}
      <div className="card p-0 overflow-hidden">
        {loading ? (
          <div className="flex items-center justify-center py-20">
            <div className="animate-spin w-6 h-6 border-2 border-indigo-500 border-t-transparent rounded-full"></div>
          </div>
        ) : transactions.length > 0 ? (
          <>
            <div className="flex items-center gap-3 px-5 py-3 border-b border-[#2a2a35] text-xs text-[#5b5b6e] uppercase tracking-wider">
              <input type="checkbox" checked={selected.length === transactions.length && transactions.length > 0} onChange={toggleAll} className="w-4 h-4" />
              <div className="flex-1">Description</div>
              <div className="w-32 hidden md:block">Category</div>
              <div className="w-24 hidden md:block">Date</div>
              <div className="w-28 text-right">Amount</div>
            </div>
            {transactions.map((txn) => (
              <div key={txn.id} className="flex items-center gap-3 px-5 py-3 hover:bg-[#1e1e28] transition-colors border-b border-[#2a2a35] last:border-0">
                <input type="checkbox" checked={selected.includes(txn.id)} onChange={() => toggleSelect(txn.id)} className="w-4 h-4" />
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-medium text-white truncate">{txn.name}</div>
                  <div className="text-xs text-[#5b5b6e]">{txn.merchant && txn.merchant !== txn.name ? txn.merchant : ''}</div>
                </div>
                <div className="w-32 items-center gap-2 hidden md:flex">
                  {editingId === txn.id ? (
                    <select defaultValue={txn.category_id || ''} onChange={e => updateCategory(txn.id, e.target.value)}
                      onBlur={() => setEditingId(null)} autoFocus className="text-xs py-1">
                      <option value="">None</option>
                      {categories.map(cat => (
                        <>
                          <option key={cat.id} value={cat.id}>{cat.name}</option>
                          {cat.children?.map(child => (
                            <option key={child.id} value={child.id}>  └ {child.name}</option>
                          ))}
                        </>
                      ))}
                    </select>
                  ) : (
                    <button onClick={() => setEditingId(txn.id)} className="badge text-[11px] cursor-pointer hover:opacity-80 transition-opacity"
                      style={{ background: `${txn.category_color || '#6366f1'}15`, color: txn.category_color || '#6366f1' }}>
                      <i className={`ri-${txn.category_icon || 'more-line'} text-xs`}></i>
                      {txn.category_name || 'Uncategorized'}
                    </button>
                  )}
                </div>
                <div className="w-24 hidden md:block text-sm text-[#8b8b9e]">
                  {new Date(txn.date + 'T00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                </div>
                <div className={`w-28 text-right text-sm font-semibold ${txn.amount < 0 ? 'text-red-400' : 'text-green-400'}`}>
                  {txn.amount < 0 ? '-' : '+'}{formatCurrency(Math.abs(txn.amount))}
                </div>
              </div>
            ))}
          </>
        ) : (
          <div className="text-center py-16">
            <i className="ri-inbox-line text-4xl text-[#2a2a35] block mb-3"></i>
            <p className="text-[#8b8b9e]">No transactions found</p>
            <p className="text-xs text-[#5b5b6e] mt-1">Connect your bank, add manually, or adjust filters</p>
          </div>
        )}
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between">
          <button className="btn btn-secondary btn-sm" disabled={filters.page <= 1} onClick={() => setFilters(f => ({ ...f, page: f.page - 1 }))}>
            <i className="ri-arrow-left-s-line"></i> Previous
          </button>
          <span className="text-sm text-[#8b8b9e]">Page {filters.page} of {totalPages} ({total} total)</span>
          <button className="btn btn-secondary btn-sm" disabled={filters.page >= totalPages} onClick={() => setFilters(f => ({ ...f, page: f.page + 1 }))}>
            Next <i className="ri-arrow-right-s-line"></i>
          </button>
        </div>
      )}
    </div>
  )
}
