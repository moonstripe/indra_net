import { useState, useEffect } from 'react'
import { Navigate, useSearchParams } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'
import { apiFetch } from '../lib/api'
import { Key, AlertTriangle, Check } from 'lucide-react'

interface ApiKey {
  id: string
  name: string
  created_at: string
  last_used?: string
  prefix: string
}

type Tab = 'profile' | 'billing' | 'api-keys'
type PlanInterval = 'monthly' | 'yearly'

export default function Settings() {
  const { user, loading: authLoading, refresh } = useAuth()
  const [searchParams, setSearchParams] = useSearchParams()
  const [activeTab, setActiveTab] = useState<Tab>('profile')
  const [apiKeys, setApiKeys] = useState<ApiKey[]>([])
  const [loadingKeys, setLoadingKeys] = useState(false)
  const [showCreateKey, setShowCreateKey] = useState(false)
  const [newKeyName, setNewKeyName] = useState('')
  const [newKeyValue, setNewKeyValue] = useState('')
  const [upgradeLoading, setUpgradeLoading] = useState(false)
  const [selectedInterval, setSelectedInterval] = useState<PlanInterval>('monthly')
  const [billingMessage, setBillingMessage] = useState<{ type: 'success' | 'error' | 'info', text: string } | null>(null)
  
  // Profile form state
  const [displayName, setDisplayName] = useState('')
  const [savingProfile, setSavingProfile] = useState(false)
  const [profileMessage, setProfileMessage] = useState<{ type: 'success' | 'error', text: string } | null>(null)

  // Handle success/canceled URL params from Stripe
  useEffect(() => {
    const success = searchParams.get('success')
    const canceled = searchParams.get('canceled')
    
    if (success === 'true') {
      setBillingMessage({ type: 'success', text: 'Welcome to Pro! Your subscription is now active.' })
      setActiveTab('billing')
      // Refresh user to get updated tier
      refresh()
      // Clean up URL
      setSearchParams({})
    } else if (canceled === 'true') {
      setBillingMessage({ type: 'info', text: 'Checkout was canceled. No charges were made.' })
      setActiveTab('billing')
      setSearchParams({})
    }
  }, [searchParams, setSearchParams, refresh])

  useEffect(() => {
    if (user && activeTab === 'api-keys') {
      fetchApiKeys()
    }
  }, [user, activeTab])
  
  useEffect(() => {
    if (user) {
      setDisplayName(user.name || '')
    }
  }, [user])

  const fetchApiKeys = async () => {
    setLoadingKeys(true)
    try {
      const res = await apiFetch('/api/api-keys')
      const data = await res.json()
      setApiKeys(data.keys || [])
    } catch (err) {
      console.error('Failed to fetch API keys:', err)
    } finally {
      setLoadingKeys(false)
    }
  }

  const createApiKey = async () => {
    if (!newKeyName.trim()) return

    try {
      const res = await apiFetch('/api/api-keys', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ name: newKeyName }),
      })
      const data = await res.json()
      
      if (data.key) {
        setNewKeyValue(data.key)
        setApiKeys([data.apiKey, ...apiKeys])
      }
    } catch (err) {
      console.error('Failed to create API key:', err)
    }
  }

  const deleteApiKey = async (id: string) => {
    if (!confirm('Are you sure you want to delete this API key?')) return

    try {
      await apiFetch(`/api/api-keys/${id}`, {
        method: 'DELETE',
        credentials: 'include',
      })
      setApiKeys(apiKeys.filter(k => k.id !== id))
    } catch (err) {
      console.error('Failed to delete API key:', err)
    }
  }

  const handleUpgrade = async (plan: 'pro_monthly' | 'pro_yearly' = 'pro_monthly') => {
    setUpgradeLoading(true)
    setBillingMessage(null)
    try {
      const res = await apiFetch('/api/billing/checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ plan }),
      })
      const data = await res.json()
      if (data.url) {
        window.location.href = data.url
      } else if (data.error) {
        setBillingMessage({ type: 'error', text: data.error })
      }
    } catch (err: any) {
      console.error('Failed to start checkout:', err)
      setBillingMessage({ type: 'error', text: err.message || 'Failed to start checkout' })
    } finally {
      setUpgradeLoading(false)
    }
  }

  const openBillingPortal = async () => {
    setBillingMessage(null)
    try {
      const res = await apiFetch('/api/billing/portal', {
        method: 'POST',
        credentials: 'include',
      })
      const data = await res.json()
      if (data.url) {
        window.location.href = data.url
      } else if (data.error) {
        setBillingMessage({ type: 'error', text: data.error })
      }
    } catch (err: any) {
      console.error('Failed to open billing portal:', err)
      setBillingMessage({ type: 'error', text: err.message || 'Failed to open billing portal' })
    }
  }
  
  const handleSaveProfile = async () => {
    setSavingProfile(true)
    setProfileMessage(null)
    
    try {
      const res = await apiFetch('/api/users/me', {
        method: 'PATCH',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: displayName }),
      })
      
      if (!res.ok) {
        const data = await res.json()
        throw new Error(data.error || 'Failed to save profile')
      }
      
      setProfileMessage({ type: 'success', text: 'Profile saved successfully' })
    } catch (err: any) {
      setProfileMessage({ type: 'error', text: err.message })
    } finally {
      setSavingProfile(false)
    }
  }

  if (authLoading) {
    return (
      <div className="min-h-[60vh] flex items-center justify-center">
        <div className="animate-spin h-8 w-8 border-2 border-purple-500 border-t-transparent rounded-full" />
      </div>
    )
  }

  if (!user) {
    return <Navigate to="/login" replace />
  }

  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <h1 className="text-3xl font-bold mb-8">Settings</h1>

      {/* Tabs */}
      <div className="border-b border-gray-800 mb-8">
        <nav className="flex gap-6">
          {(['profile', 'billing', 'api-keys'] as Tab[]).map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`pb-3 px-1 text-sm font-medium transition-colors relative ${
                activeTab === tab
                  ? 'text-purple-400'
                  : 'text-gray-400 hover:text-white'
              }`}
            >
              {tab === 'api-keys' ? 'API Keys' : tab.charAt(0).toUpperCase() + tab.slice(1)}
              {activeTab === tab && (
                <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-purple-500" />
              )}
            </button>
          ))}
        </nav>
      </div>

      {/* Profile Tab */}
      {activeTab === 'profile' && (
        <div className="space-y-6">
          <div className="bg-gray-900/50 border border-gray-800 rounded-lg p-6">
            <h2 className="text-lg font-semibold mb-4">Profile Information</h2>
            <div className="flex items-center gap-6 mb-6">
              {user.avatar_url ? (
                <img
                  src={user.avatar_url}
                  alt={user.name}
                  className="w-20 h-20 rounded-full"
                />
              ) : (
                <div className="w-20 h-20 rounded-full bg-purple-600 flex items-center justify-center text-2xl font-bold">
                  {user.name?.charAt(0).toUpperCase() || '?'}
                </div>
              )}
              <div>
                <h3 className="text-xl font-semibold">{user.name}</h3>
                <p className="text-gray-400">{user.email}</p>
                <p className="text-sm text-gray-500 mt-1">
                  Member since {new Date(user.created_at).toLocaleDateString()}
                </p>
              </div>
            </div>

            {profileMessage && (
              <div className={`mb-4 p-3 rounded-lg text-sm ${
                profileMessage.type === 'success' 
                  ? 'bg-green-900/50 text-green-400 border border-green-800' 
                  : 'bg-red-900/50 text-red-400 border border-red-800'
              }`}>
                {profileMessage.text}
              </div>
            )}

            <div className="space-y-4">
              <div>
                <label className="block text-sm text-gray-400 mb-1">Display Name</label>
                <input
                  type="text"
                  value={displayName}
                  onChange={(e) => setDisplayName(e.target.value)}
                  className="w-full bg-gray-800 border border-gray-700 rounded-lg px-4 py-2 focus:outline-none focus:border-purple-500"
                />
              </div>
              <div>
                <label className="block text-sm text-gray-400 mb-1">Email</label>
                <input
                  type="email"
                  defaultValue={user.email}
                  className="w-full bg-gray-800 border border-gray-700 rounded-lg px-4 py-2 focus:outline-none focus:border-purple-500 text-gray-500"
                  disabled
                />
                <p className="text-xs text-gray-500 mt-1">
                  Email is managed by your OAuth provider
                </p>
              </div>
              <button 
                onClick={handleSaveProfile}
                disabled={savingProfile || displayName === user.name}
                className="bg-purple-600 hover:bg-purple-500 disabled:opacity-50 disabled:cursor-not-allowed px-4 py-2 rounded-lg text-sm font-medium transition-colors"
              >
                {savingProfile ? 'Saving...' : 'Save Changes'}
              </button>
            </div>
          </div>

          {/* Connected Accounts */}
          <div className="bg-gray-900/50 border border-gray-800 rounded-lg p-6">
            <h2 className="text-lg font-semibold mb-4">Connected Accounts</h2>
            <div className="space-y-3">
              <div className="flex items-center justify-between p-3 bg-gray-800/50 rounded-lg">
                <div className="flex items-center gap-3">
                  <svg className="w-6 h-6" viewBox="0 0 24 24" fill="currentColor">
                    <path d="M12 0c-6.626 0-12 5.373-12 12 0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23.957-.266 1.983-.399 3.003-.404 1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576 4.765-1.589 8.199-6.086 8.199-11.386 0-6.627-5.373-12-12-12z"/>
                  </svg>
                  <span>GitHub</span>
                </div>
                {user.github_id ? (
                  <span className="text-green-400 text-sm">Connected</span>
                ) : (
                  <button className="text-purple-400 hover:text-purple-300 text-sm">
                    Connect
                  </button>
                )}
              </div>
              <div className="flex items-center justify-between p-3 bg-gray-800/50 rounded-lg">
                <div className="flex items-center gap-3">
                  <svg className="w-6 h-6" viewBox="0 0 24 24">
                    <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
                    <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                    <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
                    <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
                  </svg>
                  <span>Google</span>
                </div>
                {user.google_id ? (
                  <span className="text-green-400 text-sm">Connected</span>
                ) : (
                  <button className="text-purple-400 hover:text-purple-300 text-sm">
                    Connect
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Billing Tab */}
      {activeTab === 'billing' && (
        <div className="space-y-6">
          {/* Billing Message */}
          {billingMessage && (
            <div className={`p-4 rounded-lg ${
              billingMessage.type === 'success' 
                ? 'bg-green-900/50 text-green-400 border border-green-800' 
                : billingMessage.type === 'error'
                ? 'bg-red-900/50 text-red-400 border border-red-800'
                : 'bg-blue-900/50 text-blue-400 border border-blue-800'
            }`}>
              {billingMessage.text}
            </div>
          )}

          {/* Current Plan */}
          <div className="bg-gray-900/50 border border-gray-800 rounded-lg p-6">
            <h2 className="text-lg font-semibold mb-4">Current Plan</h2>
            <div className="flex items-center justify-between">
              <div>
                <p className="text-2xl font-bold capitalize">{user.tier}</p>
                <p className="text-gray-400">
                  {user.tier === 'hobby' && '1 database, 1,000 thoughts'}
                  {user.tier === 'pro' && 'Unlimited databases, 100,000 thoughts'}
                  {user.tier === 'enterprise' && 'Custom limits, dedicated support'}
                </p>
              </div>
              {user.tier === 'pro' && (
                <button
                  onClick={openBillingPortal}
                  className="bg-gray-700 hover:bg-gray-600 px-6 py-2 rounded-lg font-medium transition-colors"
                >
                  Manage Subscription
                </button>
              )}
            </div>
          </div>

          {/* Upgrade Section for Hobby Users */}
          {user.tier === 'hobby' && (
            <div className="bg-gradient-to-r from-purple-900/30 to-pink-900/30 border border-purple-800/50 rounded-lg p-6">
              <h2 className="text-xl font-semibold mb-2">Upgrade to Pro</h2>
              <p className="text-gray-400 mb-6">
                Unlock unlimited databases, advanced analytics, and API access.
              </p>
              
              {/* Interval Toggle */}
              <div className="flex items-center gap-4 mb-6">
                <button
                  onClick={() => setSelectedInterval('monthly')}
                  className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                    selectedInterval === 'monthly'
                      ? 'bg-purple-600 text-white'
                      : 'bg-gray-800 text-gray-400 hover:text-white'
                  }`}
                >
                  Monthly
                </button>
                <button
                  onClick={() => setSelectedInterval('yearly')}
                  className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                    selectedInterval === 'yearly'
                      ? 'bg-purple-600 text-white'
                      : 'bg-gray-800 text-gray-400 hover:text-white'
                  }`}
                >
                  Yearly <span className="text-green-400 text-xs ml-1">Save 17%</span>
                </button>
              </div>

              {/* Price Display */}
              <div className="flex items-baseline gap-2 mb-6">
                <span className="text-4xl font-bold">
                  {selectedInterval === 'monthly' ? '$8' : '$80'}
                </span>
                <span className="text-gray-400">
                  /{selectedInterval === 'monthly' ? 'month' : 'year'}
                </span>
              </div>

              <button
                onClick={() => handleUpgrade(selectedInterval === 'monthly' ? 'pro_monthly' : 'pro_yearly')}
                disabled={upgradeLoading}
                className="w-full sm:w-auto bg-purple-600 hover:bg-purple-500 disabled:opacity-50 px-8 py-3 rounded-lg font-medium transition-colors"
              >
                {upgradeLoading ? (
                  <span className="flex items-center gap-2">
                    <div className="animate-spin h-4 w-4 border-2 border-white border-t-transparent rounded-full" />
                    Redirecting to checkout...
                  </span>
                ) : (
                  `Upgrade to Pro - ${selectedInterval === 'monthly' ? '$8/mo' : '$80/yr'}`
                )}
              </button>
            </div>
          )}

          {/* Plans Comparison */}
          <div className="grid md:grid-cols-3 gap-4">
            <PlanCard
              name="Hobby"
              price="Free"
              features={[
                '1 database',
                '1,000 thoughts',
                '10 MB storage',
                'Community support',
              ]}
              current={user.tier === 'hobby'}
            />
            <PlanCard
              name="Pro"
              price={selectedInterval === 'monthly' ? '$8/mo' : '$80/yr'}
              features={[
                'Unlimited databases',
                '100,000 thoughts',
                '1 GB storage',
                'API access',
                'Full analytics',
                'Email support',
              ]}
              current={user.tier === 'pro'}
              highlighted
              onUpgrade={user.tier === 'hobby' ? () => handleUpgrade(selectedInterval === 'monthly' ? 'pro_monthly' : 'pro_yearly') : undefined}
              upgradeLoading={upgradeLoading}
            />
            <PlanCard
              name="Enterprise"
              price="Custom"
              features={[
                'Unlimited everything',
                'SSO/SAML',
                'Audit logs',
                'Dedicated support',
                'Custom integrations',
              ]}
              current={user.tier === 'enterprise'}
              contactSales
            />
          </div>
        </div>
      )}

      {/* API Keys Tab */}
      {activeTab === 'api-keys' && (
        <div className="space-y-6">
          {user.tier === 'hobby' ? (
            <div className="bg-gray-900/50 border border-gray-800 rounded-lg p-8 text-center">
              <Key className="w-12 h-12 mx-auto mb-4 text-gray-400" />
              <h3 className="text-xl font-semibold mb-2">API Access Requires Pro</h3>
              <p className="text-gray-400 mb-6">
                Upgrade to Pro to get programmatic access to your databases via API keys.
              </p>
              <button
                onClick={() => handleUpgrade('pro_monthly')}
                disabled={upgradeLoading}
                className="bg-purple-600 hover:bg-purple-500 disabled:opacity-50 px-6 py-2 rounded-lg font-medium transition-colors"
              >
                {upgradeLoading ? 'Loading...' : 'Upgrade to Pro'}
              </button>
            </div>
          ) : (
            <>
              <div className="bg-gray-900/50 border border-gray-800 rounded-lg p-6">
                <div className="flex justify-between items-center mb-4">
                  <h2 className="text-lg font-semibold">Your API Keys</h2>
                  <button
                    onClick={() => setShowCreateKey(true)}
                    className="bg-purple-600 hover:bg-purple-500 px-4 py-2 rounded-lg text-sm font-medium transition-colors"
                  >
                    Create New Key
                  </button>
                </div>

                {loadingKeys ? (
                  <div className="py-8 text-center">
                    <div className="animate-spin h-6 w-6 border-2 border-purple-500 border-t-transparent rounded-full mx-auto" />
                  </div>
                ) : apiKeys.length === 0 ? (
                  <p className="text-gray-500 text-center py-8">
                    No API keys yet. Create one to get started.
                  </p>
                ) : (
                  <div className="space-y-3">
                    {apiKeys.map((key) => (
                      <div
                        key={key.id}
                        className="flex items-center justify-between p-4 bg-gray-800/50 rounded-lg"
                      >
                        <div>
                          <p className="font-medium">{key.name}</p>
                          <p className="text-sm text-gray-500">
                            <code>{key.prefix}...</code> • Created {new Date(key.created_at).toLocaleDateString()}
                            {key.last_used && ` • Last used ${new Date(key.last_used).toLocaleDateString()}`}
                          </p>
                        </div>
                        <button
                          onClick={() => deleteApiKey(key.id)}
                          className="text-red-400 hover:text-red-300 text-sm"
                        >
                          Delete
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Usage Info */}
              <div className="bg-gray-900/50 border border-gray-800 rounded-lg p-6">
                <h3 className="font-semibold mb-4">API Usage</h3>
                <code className="block bg-black/50 p-4 rounded text-sm font-mono text-green-400 overflow-x-auto">
{`curl -X GET https://api.indra.dev/v1/bases \\
  -H "Authorization: Bearer YOUR_API_KEY"`}
                </code>
                <p className="text-gray-500 text-sm mt-4">
                  See the <a href="/docs/api" className="text-purple-400 hover:text-purple-300">API documentation</a> for more details.
                </p>
              </div>
            </>
          )}

          {/* Create Key Modal */}
          {showCreateKey && (
            <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
              <div className="bg-gray-900 border border-gray-800 rounded-xl p-6 max-w-md w-full mx-4">
                {newKeyValue ? (
                  <>
                    <h2 className="text-xl font-bold mb-4">Your New API Key</h2>
                    <div className="bg-yellow-900/20 border border-yellow-700/50 rounded-lg p-4 mb-4">
                      <p className="text-yellow-400 text-sm flex items-center gap-2">
                        <AlertTriangle className="w-4 h-4" />
                        Copy this key now. You won't be able to see it again!
                      </p>
                    </div>
                    <code className="block bg-black/50 p-4 rounded text-sm font-mono text-green-400 break-all">
                      {newKeyValue}
                    </code>
                    <div className="flex justify-end mt-6">
                      <button
                        onClick={() => {
                          navigator.clipboard.writeText(newKeyValue)
                          setShowCreateKey(false)
                          setNewKeyValue('')
                          setNewKeyName('')
                        }}
                        className="bg-purple-600 hover:bg-purple-500 px-4 py-2 rounded-lg font-medium transition-colors"
                      >
                        Copy & Close
                      </button>
                    </div>
                  </>
                ) : (
                  <>
                    <h2 className="text-xl font-bold mb-4">Create API Key</h2>
                    <div>
                      <label className="block text-sm text-gray-400 mb-1">Key Name</label>
                      <input
                        type="text"
                        value={newKeyName}
                        onChange={(e) => setNewKeyName(e.target.value)}
                        className="w-full bg-gray-800 border border-gray-700 rounded-lg px-4 py-2 focus:outline-none focus:border-purple-500"
                        placeholder="My CLI Key"
                      />
                    </div>
                    <div className="flex justify-end gap-3 mt-6">
                      <button
                        onClick={() => {
                          setShowCreateKey(false)
                          setNewKeyName('')
                        }}
                        className="px-4 py-2 text-gray-400 hover:text-white transition-colors"
                      >
                        Cancel
                      </button>
                      <button
                        onClick={createApiKey}
                        disabled={!newKeyName.trim()}
                        className="bg-purple-600 hover:bg-purple-500 disabled:opacity-50 px-4 py-2 rounded-lg font-medium transition-colors"
                      >
                        Create
                      </button>
                    </div>
                  </>
                )}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

function PlanCard({
  name,
  price,
  features,
  current,
  highlighted,
  contactSales,
  onUpgrade,
  upgradeLoading,
}: {
  name: string
  price: string
  features: string[]
  current?: boolean
  highlighted?: boolean
  contactSales?: boolean
  onUpgrade?: () => void
  upgradeLoading?: boolean
}) {
  return (
    <div
      className={`bg-gray-900/50 border rounded-lg p-6 ${
        highlighted
          ? 'border-purple-500 ring-1 ring-purple-500'
          : 'border-gray-800'
      }`}
    >
      <h3 className="text-lg font-semibold">{name}</h3>
      <p className="text-3xl font-bold mt-2">{price}</p>
      {current && (
        <span className="inline-block bg-purple-600/20 text-purple-400 text-xs px-2 py-1 rounded mt-2">
          Current Plan
        </span>
      )}
      <ul className="mt-6 space-y-3">
        {features.map((feature) => (
          <li key={feature} className="flex items-center gap-2 text-sm text-gray-300">
            <Check className="w-4 h-4 text-green-400" />
            {feature}
          </li>
        ))}
      </ul>
      {onUpgrade && !current && (
        <button
          onClick={onUpgrade}
          disabled={upgradeLoading}
          className="w-full mt-6 bg-purple-600 hover:bg-purple-500 disabled:opacity-50 px-4 py-2 rounded-lg text-sm font-medium transition-colors"
        >
          {upgradeLoading ? 'Loading...' : 'Upgrade'}
        </button>
      )}
      {contactSales && !current && (
        <button className="w-full mt-6 border border-gray-700 hover:border-gray-600 px-4 py-2 rounded-lg text-sm transition-colors">
          Contact Sales
        </button>
      )}
    </div>
  )
}
