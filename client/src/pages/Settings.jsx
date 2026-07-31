import { useState, useEffect, useCallback, useRef } from 'react'
import api from '../api'
import { formatCurrency } from '../utils'
import toast from 'react-hot-toast'

export default function Settings() {
  const [status, setStatus] = useState(null)
  const [accounts, setAccounts] = useState([])
  const [loading, setLoading] = useState(true)
  const [connecting, setConnecting] = useState(false)
  const [syncing, setSyncing] = useState(false)

  useEffect(() => {
    loadStatus()
  }, [])

  async function loadStatus() {
    try {
      const [statusRes, accountsRes] = await Promise.all([
        api.get('/plaid/status'),
        api.get('/accounts'),
      ])
      setStatus(statusRes.data)
      setAccounts(accountsRes.data)
    } catch { /* ignore */ }
    finally { setLoading(false) }
  }

  const loadStatusRef = useRef(loadStatus)
  loadStatusRef.current = loadStatus

  const connectBank = useCallback(async () => {
    setConnecting(true)
    try {
      // Create link token
      const { data } = await api.post('/plaid/create-link-token')
      const linkToken = data.link_token

      // Load Plaid Link
      const script = document.createElement('script')
      script.src = 'https://cdn.plaid.com/link/v2/stable/link-initialize.js'
      script.id = 'plaid-link-script'
      script.onload = () => {
        const handler = window.Plaid.create({
          token: linkToken,
          onSuccess: async (publicToken) => {
            try {
              await api.post('/plaid/exchange-token', { public_token: publicToken })
              toast.success('Bank connected successfully!')
              loadStatusRef.current()
            } catch {
              toast.error('Failed to connect bank')
            } finally {
              setConnecting(false)
              // Clean up script
              document.getElementById('plaid-link-script')?.remove()
            }
          },
          onExit: () => {
            setConnecting(false)
            document.getElementById('plaid-link-script')?.remove()
          },
          onLoad: () => {},
        })
        handler.open()
      }
      document.body.appendChild(script)
    } catch {
      toast.error('Failed to initialize bank connection. Check your Plaid API credentials.')
      setConnecting(false)
    }
  }, [])

  async function syncTransactions() {
    setSyncing(true)
    try {
      const { data } = await api.post('/plaid/sync')
      toast.success(`Synced ${data.synced} transactions`)
      loadStatus()
    } catch {
      toast.error('Failed to sync transactions')
    } finally {
      setSyncing(false)
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="animate-spin w-6 h-6 border-2 border-indigo-500 border-t-transparent rounded-full"></div>
      </div>
    )
  }

  return (
    <div className="space-y-6 max-w-2xl animate-fade-in">
      {/* Bank Connection */}
      <div className="card">
        <div className="flex items-center gap-3 mb-4">
          <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${
            status?.connected ? 'bg-green-500/10 text-green-400' : 'bg-[#252530] text-[#8b8b9e]'
          }`}>
            <i className={`ri-bank-line text-lg`}></i>
          </div>
          <div>
            <h3 className="text-sm font-semibold text-white">Bank Connection</h3>
            <p className="text-xs text-[#5b5b6e]">
              {status?.connected
                ? `Connected to ${status.institutions.join(', ')}`
                : 'Connect your bank via Plaid to automatically import transactions'}
            </p>
          </div>
        </div>

        <div className="flex flex-wrap gap-3">
          <button className="btn btn-primary" onClick={connectBank} disabled={connecting}>
            {connecting ? (
              <><div className="animate-spin w-4 h-4 border-2 border-white border-t-transparent rounded-full"></div> Connecting...</>
            ) : (
              <><i className="ri-link"></i> {status?.connected ? 'Connect Another Bank' : 'Connect Bank Account'}</>
            )}
          </button>
          {status?.connected && (
            <button className="btn btn-secondary" onClick={syncTransactions} disabled={syncing}>
              {syncing ? (
                <><div className="animate-spin w-4 h-4 border-2 border-indigo-500 border-t-transparent rounded-full"></div> Syncing...</>
              ) : (
                <><i className="ri-refresh-line"></i> Sync Transactions</>
              )}
            </button>
          )}
        </div>

        {status?.connected && (
          <div className="mt-4 flex items-center gap-6 text-sm">
            <div>
              <span className="text-[#5b5b6e]">Accounts: </span>
              <span className="text-white font-medium">{status.accountCount}</span>
            </div>
            <div>
              <span className="text-[#5b5b6e]">Transactions: </span>
              <span className="text-white font-medium">{status.transactionCount}</span>
            </div>
          </div>
        )}

        {!status?.connected && (
          <div className="mt-4 p-3 rounded-lg bg-[#141418] text-xs text-[#8b8b9e]">
            <div className="flex items-start gap-2">
              <i className="ri-information-line text-indigo-400 mt-0.5"></i>
              <div>
                <p className="font-medium text-white mb-1">Plaid Sandbox Mode</p>
                <p>Set your Plaid API credentials in the <code className="bg-[#252530] px-1.5 py-0.5 rounded text-indigo-400">.env</code> file.</p>
                <p className="mt-1">Use sandbox credentials: username <code className="bg-[#252530] px-1.5 py-0.5 rounded text-indigo-400">user_good</code>, password <code className="bg-[#252530] px-1.5 py-0.5 rounded text-indigo-400">pass_good</code></p>
                <a href="https://dashboard.plaid.com/signup" target="_blank" rel="noopener noreferrer"
                  className="inline-flex items-center gap-1 mt-2 text-indigo-400 hover:text-indigo-300 transition-colors">
                  Get Plaid API keys <i className="ri-external-link-line text-xs"></i>
                </a>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Accounts */}
      {accounts.length > 0 && (
        <div className="card">
          <h3 className="text-sm font-semibold text-white mb-4 flex items-center gap-2">
            <i className="ri-bank-card-line text-indigo-400"></i>
            Linked Accounts
          </h3>
          <div className="space-y-2">
            {accounts.map(acct => (
              <div key={acct.id} className="flex items-center justify-between p-3 rounded-lg bg-[#141418] hover:bg-[#1c1c24] transition-colors">
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-lg bg-[#252530] flex items-center justify-center text-[#8b8b9e]">
                    <i className={`${acct.type === 'depository' ? 'ri-bank-line' : acct.type === 'credit' ? 'ri-bank-card-line' : 'ri-funds-line'} text-sm`}></i>
                  </div>
                  <div>
                    <div className="text-sm font-medium text-white">{acct.name}</div>
                    <div className="text-xs text-[#5b5b6e] capitalize">{acct.subtype || acct.type}</div>
                  </div>
                </div>
                <div className="text-right">
                  <div className="text-sm font-semibold text-white">{formatCurrency(acct.balance)}</div>
                  {acct.total_outflow > 0 && (
                    <div className="text-xs text-red-400">-{formatCurrency(acct.total_outflow)} this month</div>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* App Info */}
      <div className="card">
        <h3 className="text-sm font-semibold text-white mb-4 flex items-center gap-2">
          <i className="ri-information-line text-indigo-400"></i>
          About
        </h3>
        <div className="space-y-3">
          <div className="flex items-center justify-between py-2 border-b border-[#2a2a35]">
            <span className="text-sm text-[#8b8b9e]">App Version</span>
            <span className="text-sm text-white font-medium">1.0.0</span>
          </div>
          <div className="flex items-center justify-between py-2 border-b border-[#2a2a35]">
            <span className="text-sm text-[#8b8b9e]">Database</span>
            <span className="text-sm text-white font-medium">SQLite (local)</span>
          </div>
          <div className="flex items-center justify-between py-2">
            <span className="text-sm text-[#8b8b9e]">Phone Access</span>
            <span className="text-sm text-white font-medium">Via local network IP</span>
          </div>
          <div className="mt-3 p-3 rounded-lg bg-[#141418] text-xs text-[#8b8b9e]">
            <p className="font-medium text-white mb-1">💡 How to access from your phone</p>
            <p>1. Make sure your phone is on the same Wi-Fi as this computer</p>
            <p>2. Start the app with <code className="bg-[#252530] px-1.5 py-0.5 rounded text-indigo-400">npm start</code></p>
            <p>3. Look for the "Phone access" URL in the terminal output</p>
            <p>4. Open that URL in your phone's browser</p>
          </div>
        </div>
      </div>
    </div>
  )
}
