import { useState, useEffect } from 'react'
import { useParams, useNavigate, Link } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'

interface IndraBase {
  id: string
  name: string
  description?: string
  visibility: 'public' | 'private'
  size_bytes: number
  thought_count: number
  created_at: string
  updated_at: string
  storage_key: string
}

interface Thought {
  id: string
  thought_id: string
  content: string
  created_at: string
  committed_at: string
}

interface Commit {
  id: string
  hash: string
  message?: string
  author?: string
  timestamp: string
  parent_hash?: string
}

type Tab = 'overview' | 'thoughts' | 'history' | 'settings'

export default function BaseDetail() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const { user, loading: authLoading } = useAuth()
  
  const [base, setBase] = useState<IndraBase | null>(null)
  const [thoughts, setThoughts] = useState<Thought[]>([])
  const [commits, setCommits] = useState<Commit[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [activeTab, setActiveTab] = useState<Tab>('overview')
  const [searchQuery, setSearchQuery] = useState('')
  const [searchResults, setSearchResults] = useState<Thought[] | null>(null)
  const [searching, setSearching] = useState(false)
  
  const [copyFeedback, setCopyFeedback] = useState<boolean>(false)
  
  // Selection state for visualize selected feature
  const [selectedThoughtIds, setSelectedThoughtIds] = useState<Set<string>>(new Set())

  // Settings form state
  const [settingsDescription, setSettingsDescription] = useState('')
  const [settingsVisibility, setSettingsVisibility] = useState<'public' | 'private'>('private')
  const [savingSettings, setSavingSettings] = useState(false)
  const [settingsMessage, setSettingsMessage] = useState<{ type: 'success' | 'error', text: string } | null>(null)

  useEffect(() => {
    if (id) {
      fetchBase()
    }
  }, [id])

  // Initialize settings form when base loads
  useEffect(() => {
    if (base) {
      setSettingsDescription(base.description || '')
      setSettingsVisibility(base.visibility)
    }
  }, [base])

  useEffect(() => {
    if (base && (activeTab === 'thoughts' || activeTab === 'overview')) {
      fetchThoughts()
    }
    if (base && activeTab === 'history') {
      fetchCommits()
    }
  }, [base, activeTab])

  const fetchBase = async () => {
    try {
      const res = await fetch(`/api/bases/${id}`, { credentials: 'include' })
      if (!res.ok) {
        if (res.status === 404) {
          setError('Database not found')
        } else {
          throw new Error('Failed to fetch database')
        }
        return
      }
      const data = await res.json()
      setBase(data.base)
    } catch (err: any) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  const fetchThoughts = async () => {
    try {
      const res = await fetch(`/api/bases/${id}/thoughts?limit=50`, { credentials: 'include' })
      const data = await res.json()
      setThoughts(data.thoughts || [])
    } catch (err) {
      console.error('Failed to fetch thoughts:', err)
    }
  }

  const fetchCommits = async () => {
    try {
      const res = await fetch(`/api/bases/${id}/commits?limit=50`, { credentials: 'include' })
      const data = await res.json()
      setCommits(data.commits || [])
    } catch (err) {
      console.error('Failed to fetch commits:', err)
    }
  }

  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!searchQuery.trim()) {
      setSearchResults(null)
      return
    }
    
    setSearching(true)
    try {
      const res = await fetch(
        `/api/bases/${id}/search?q=${encodeURIComponent(searchQuery)}`,
        { credentials: 'include' }
      )
      const data = await res.json()
      setSearchResults(data.results || [])
    } catch (err) {
      console.error('Search failed:', err)
    } finally {
      setSearching(false)
    }
  }

  const handleDelete = async () => {
    if (!confirm(`Are you sure you want to delete "${base?.name}"? This cannot be undone.`)) {
      return
    }

    try {
      const res = await fetch(`/api/bases/${id}`, {
        method: 'DELETE',
        credentials: 'include',
      })
      if (!res.ok) throw new Error('Failed to delete')
      navigate('/dashboard')
    } catch (err: any) {
      alert('Failed to delete database: ' + err.message)
    }
  }

  const handleSaveSettings = async () => {
    setSavingSettings(true)
    setSettingsMessage(null)
    
    try {
      const res = await fetch(`/api/bases/${id}`, {
        method: 'PATCH',
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          description: settingsDescription,
          visibility: settingsVisibility,
        }),
      })
      
      if (!res.ok) {
        const data = await res.json()
        throw new Error(data.error || 'Failed to save settings')
      }
      
      const data = await res.json()
      setBase(data.base)
      setSettingsMessage({ type: 'success', text: 'Settings saved successfully' })
    } catch (err: any) {
      setSettingsMessage({ type: 'error', text: err.message })
    } finally {
      setSavingSettings(false)
    }
  }

  const copySyncCommand = () => {
    const cmd = `indra pull ${base?.name} && indra push ${base?.name}`
    navigator.clipboard.writeText(cmd)
    setCopyFeedback(true)
    setTimeout(() => setCopyFeedback(false), 2000)
  }
  
  const toggleThoughtSelection = (thoughtId: string) => {
    setSelectedThoughtIds(prev => {
      const next = new Set(prev)
      if (next.has(thoughtId)) {
        next.delete(thoughtId)
      } else {
        next.add(thoughtId)
      }
      return next
    })
  }
  
  const clearSelection = () => {
    setSelectedThoughtIds(new Set())
  }
  
  const visualizeSelected = () => {
    if (selectedThoughtIds.size === 0) return
    const focusParam = Array.from(selectedThoughtIds).join(',')
    navigate(`/bases/${id}/viz?focus=${encodeURIComponent(focusParam)}`)
  }

  if (authLoading || loading) {
    return (
      <div className="min-h-[60vh] flex items-center justify-center">
        <div className="animate-spin h-8 w-8 border-2 border-purple-500 border-t-transparent rounded-full" />
      </div>
    )
  }

  if (error) {
    return (
      <div className="max-w-4xl mx-auto px-4 py-16 text-center">
        <div className="text-6xl mb-4">😕</div>
        <h1 className="text-2xl font-bold mb-2">{error}</h1>
        <p className="text-gray-400 mb-6">
          The database you're looking for doesn't exist or you don't have access to it.
        </p>
        <Link
          to="/dashboard"
          className="text-purple-400 hover:text-purple-300"
        >
          ← Back to Dashboard
        </Link>
      </div>
    )
  }

  if (!base) return null

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4 mb-8">
        <div>
          <div className="flex items-center gap-3 mb-2">
            <h1 className="text-3xl font-bold">{base.name}</h1>
            <span className={`text-xs px-2 py-1 rounded ${
              base.visibility === 'public' 
                ? 'bg-green-900/50 text-green-400' 
                : 'bg-gray-800 text-gray-400'
            }`}>
              {base.visibility}
            </span>
          </div>
          {base.description && (
            <p className="text-gray-400">{base.description}</p>
          )}
        </div>
        
        <div className="flex gap-2">
          <Link
            to={`/bases/${id}/viz`}
            className="bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-500 hover:to-pink-500 px-4 py-2 rounded-lg text-sm transition-all"
            title="Open 3D visualization"
          >
            🌌 Visualize
          </Link>
          <button
            onClick={copySyncCommand}
            className="bg-purple-600 hover:bg-purple-500 px-4 py-2 rounded-lg text-sm transition-colors flex items-center gap-2"
            title="Copy sync command to clipboard"
          >
            {copyFeedback ? '✓ Copied!' : (
              <>
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                </svg>
                Sync
              </>
            )}
          </button>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-8">
        <StatCard label="Thoughts" value={base.thought_count.toLocaleString()} />
        <StatCard label="Size" value={formatBytes(base.size_bytes)} />
        <StatCard label="Created" value={formatDate(base.created_at)} />
        <StatCard label="Updated" value={formatRelativeTime(base.updated_at)} />
      </div>

      {/* Tabs */}
      <div className="border-b border-gray-800 mb-6">
        <nav className="flex gap-6">
          {(['overview', 'thoughts', 'history', 'settings'] as Tab[]).map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`pb-3 px-1 text-sm font-medium transition-colors relative ${
                activeTab === tab
                  ? 'text-purple-400'
                  : 'text-gray-400 hover:text-white'
              }`}
            >
              {tab.charAt(0).toUpperCase() + tab.slice(1)}
              {activeTab === tab && (
                <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-purple-500" />
              )}
            </button>
          ))}
        </nav>
      </div>

      {/* Tab Content */}
      {activeTab === 'overview' && (
        <div className="space-y-6">
          {thoughts.length === 0 ? (
            /* Quick Start - shown when no thoughts exist */
            <div className="bg-gray-900/50 border border-gray-800 rounded-lg p-6">
              <h3 className="font-semibold mb-4">🚀 Get Started</h3>
              <p className="text-gray-400 mb-6">
                This database is empty. Follow these steps to start syncing your thoughts:
              </p>
              
              <div className="space-y-6">
                {/* Step 1: Install */}
                <div className="border-l-2 border-purple-500 pl-4">
                  <h4 className="font-medium text-purple-400 mb-2">1. Install the CLI</h4>
                  <p className="text-sm text-gray-400 mb-2">
                    Install the Indra CLI using Cargo:
                  </p>
                  <code className="block bg-black/50 p-3 rounded text-sm font-mono text-green-400">
                    cargo install indra_db
                  </code>
                </div>

                {/* Step 2: Login */}
                <div className="border-l-2 border-purple-500 pl-4">
                  <h4 className="font-medium text-purple-400 mb-2">2. Authenticate</h4>
                  <p className="text-sm text-gray-400 mb-2">
                    Login to connect your CLI to IndraNet:
                  </p>
                  <code className="block bg-black/50 p-3 rounded text-sm font-mono text-green-400">
                    indra login
                  </code>
                </div>

                {/* Step 3: Clone or Create */}
                <div className="border-l-2 border-purple-500 pl-4">
                  <h4 className="font-medium text-purple-400 mb-2">3. Clone this database</h4>
                  <p className="text-sm text-gray-400 mb-2">
                    Download this database to your machine:
                  </p>
                  <code className="block bg-black/50 p-3 rounded text-sm font-mono text-green-400">
                    indra clone {user?.name || 'username'}/{base.name}
                  </code>
                  <p className="text-sm text-gray-400 mt-3 mb-2">
                    Or link an existing local database:
                  </p>
                  <code className="block bg-black/50 p-3 rounded text-sm font-mono text-green-400">
                    indra remote add origin {user?.name || 'username'}/{base.name}
                  </code>
                </div>

                {/* Step 4: Add thoughts */}
                <div className="border-l-2 border-purple-500 pl-4">
                  <h4 className="font-medium text-purple-400 mb-2">4. Add your first thought</h4>
                  <p className="text-sm text-gray-400 mb-2">
                    Create a thought with automatic embedding:
                  </p>
                  <code className="block bg-black/50 p-3 rounded text-sm font-mono text-green-400">
                    indra add "Your first thought goes here"
                  </code>
                </div>

                {/* Step 5: Push */}
                <div className="border-l-2 border-purple-500 pl-4">
                  <h4 className="font-medium text-purple-400 mb-2">5. Push to IndraNet</h4>
                  <p className="text-sm text-gray-400 mb-2">
                    Sync your database with visualization:
                  </p>
                  <code className="block bg-black/50 p-3 rounded text-sm font-mono text-green-400">
                    indra push origin --viz
                  </code>
                </div>
              </div>

              <div className="mt-6 p-4 bg-purple-900/20 border border-purple-800/50 rounded-lg">
                <p className="text-sm text-purple-300">
                  💡 <strong>Tip:</strong> Use the MCP server (<code className="text-purple-400">indra_db_mcp</code>) to let AI agents interact with your knowledge base directly.
                </p>
              </div>
            </div>
          ) : (
            /* Recent Thoughts - shown when thoughts exist */
            <div className="bg-gray-900/50 border border-gray-800 rounded-lg p-6">
              <div className="flex items-center justify-between mb-4">
                <h3 className="font-semibold">Recent Thoughts</h3>
                <Link
                  to={`/bases/${id}/viz`}
                  className="text-sm text-purple-400 hover:text-purple-300"
                >
                  View in 3D →
                </Link>
              </div>
              <div className="space-y-3">
                {thoughts.slice(0, 5).map((thought) => (
                  <div key={thought.id} className="text-sm border-l-2 border-gray-700 pl-3">
                    <p className="text-gray-300 line-clamp-2">{thought.content}</p>
                    <p className="text-gray-600 text-xs mt-1">
                      {formatRelativeTime(thought.committed_at)}
                    </p>
                  </div>
                ))}
              </div>
              {thoughts.length > 5 && (
                <button
                  onClick={() => setActiveTab('thoughts')}
                  className="mt-4 text-sm text-purple-400 hover:text-purple-300"
                >
                  View all {thoughts.length} thoughts →
                </button>
              )}
            </div>
          )}
        </div>
      )}

      {activeTab === 'thoughts' && (
        <div className="space-y-6">
          {/* Search and selection controls */}
          <div className="flex flex-col sm:flex-row gap-4">
            <form onSubmit={handleSearch} className="flex gap-2 flex-1">
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search thoughts semantically..."
                className="flex-1 bg-gray-800 border border-gray-700 rounded-lg px-4 py-2 focus:outline-none focus:border-purple-500"
              />
              <button
                type="submit"
                disabled={searching}
                className="bg-purple-600 hover:bg-purple-500 disabled:opacity-50 px-6 py-2 rounded-lg font-medium transition-colors"
              >
                {searching ? 'Searching...' : 'Search'}
              </button>
            </form>
            
            {/* Selection actions */}
            {selectedThoughtIds.size > 0 && (
              <div className="flex gap-2 items-center">
                <span className="text-sm text-gray-400">
                  {selectedThoughtIds.size} selected
                </span>
                <button
                  onClick={visualizeSelected}
                  className="bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-500 hover:to-pink-500 px-4 py-2 rounded-lg text-sm transition-all flex items-center gap-2"
                >
                  🌌 Visualize Selected
                </button>
                <button
                  onClick={clearSelection}
                  className="text-gray-400 hover:text-white px-2 py-2"
                  title="Clear selection"
                >
                  ✕
                </button>
              </div>
            )}
          </div>

          {/* Results */}
          <div className="space-y-4">
            {(searchResults || thoughts).map((thought) => (
              <div
                key={thought.id}
                onClick={() => toggleThoughtSelection(thought.thought_id)}
                className={`bg-gray-900/50 border rounded-lg p-4 cursor-pointer transition-colors ${
                  selectedThoughtIds.has(thought.thought_id)
                    ? 'border-purple-500 bg-purple-900/20'
                    : 'border-gray-800 hover:border-gray-700'
                }`}
              >
                <div className="flex items-start gap-3">
                  <div className={`mt-1 w-4 h-4 rounded border-2 flex items-center justify-center transition-colors ${
                    selectedThoughtIds.has(thought.thought_id)
                      ? 'border-purple-500 bg-purple-500'
                      : 'border-gray-600'
                  }`}>
                    {selectedThoughtIds.has(thought.thought_id) && (
                      <svg className="w-3 h-3 text-white" fill="currentColor" viewBox="0 0 20 20">
                        <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                      </svg>
                    )}
                  </div>
                  <div className="flex-1">
                    <p className="text-gray-200 whitespace-pre-wrap">{thought.content}</p>
                    <div className="flex gap-4 mt-3 text-xs text-gray-500">
                      <span>ID: {thought.thought_id}</span>
                      <span>{formatRelativeTime(thought.committed_at)}</span>
                    </div>
                  </div>
                </div>
              </div>
            ))}
            {(searchResults || thoughts).length === 0 && (
              <p className="text-center text-gray-500 py-8">
                {searchResults ? 'No results found' : 'No thoughts in this database yet'}
              </p>
            )}
          </div>
        </div>
      )}

      {activeTab === 'history' && (
        <div className="space-y-4">
          {commits.length === 0 ? (
            <p className="text-center text-gray-500 py-8">
              No commit history yet
            </p>
          ) : (
            <div className="relative">
              {/* Timeline line */}
              <div className="absolute left-4 top-0 bottom-0 w-0.5 bg-gray-800" />
              
              {commits.map((commit, i) => (
                <div key={commit.id} className="relative pl-10 pb-6">
                  {/* Timeline dot */}
                  <div className={`absolute left-2.5 w-3 h-3 rounded-full ${
                    i === 0 ? 'bg-purple-500' : 'bg-gray-600'
                  }`} />
                  
                  <div className="bg-gray-900/50 border border-gray-800 rounded-lg p-4">
                    <div className="flex items-start justify-between">
                      <div>
                        <code className="text-sm font-mono text-purple-400">
                          {commit.hash.slice(0, 8)}
                        </code>
                        {commit.message && (
                          <p className="text-gray-300 mt-1">{commit.message}</p>
                        )}
                      </div>
                      <span className="text-xs text-gray-500">
                        {formatRelativeTime(commit.timestamp)}
                      </span>
                    </div>
                    {commit.author && (
                      <p className="text-xs text-gray-500 mt-2">by {commit.author}</p>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {activeTab === 'settings' && (
        <div className="space-y-6 max-w-2xl">
          {/* Metadata */}
          <div className="bg-gray-900/50 border border-gray-800 rounded-lg p-6">
            <h3 className="font-semibold mb-4">Database Settings</h3>
            
            {settingsMessage && (
              <div className={`mb-4 p-3 rounded-lg text-sm ${
                settingsMessage.type === 'success' 
                  ? 'bg-green-900/50 text-green-400 border border-green-800' 
                  : 'bg-red-900/50 text-red-400 border border-red-800'
              }`}>
                {settingsMessage.text}
              </div>
            )}
            
            <div className="space-y-4">
              <div>
                <label className="block text-sm text-gray-400 mb-1">Name</label>
                <input
                  type="text"
                  value={base.name}
                  className="w-full bg-gray-800 border border-gray-700 rounded-lg px-4 py-2 focus:outline-none focus:border-purple-500 text-gray-500"
                  disabled
                />
                <p className="text-xs text-gray-500 mt-1">Database names cannot be changed after creation.</p>
              </div>
              <div>
                <label className="block text-sm text-gray-400 mb-1">Description</label>
                <textarea
                  value={settingsDescription}
                  onChange={(e) => setSettingsDescription(e.target.value)}
                  className="w-full bg-gray-800 border border-gray-700 rounded-lg px-4 py-2 focus:outline-none focus:border-purple-500"
                  rows={3}
                  placeholder="Add a description for this database..."
                />
              </div>
              <div>
                <label className="block text-sm text-gray-400 mb-1">Visibility</label>
                <select
                  value={settingsVisibility}
                  onChange={(e) => setSettingsVisibility(e.target.value as 'public' | 'private')}
                  className="w-full bg-gray-800 border border-gray-700 rounded-lg px-4 py-2 focus:outline-none focus:border-purple-500"
                >
                  <option value="private">Private - Only you can view</option>
                  <option value="public">Public - Anyone can view</option>
                </select>
              </div>
              <button 
                onClick={handleSaveSettings}
                disabled={savingSettings}
                className="bg-purple-600 hover:bg-purple-500 disabled:opacity-50 disabled:cursor-not-allowed px-4 py-2 rounded-lg text-sm font-medium transition-colors"
              >
                {savingSettings ? 'Saving...' : 'Save Changes'}
              </button>
            </div>
          </div>

          {/* Danger Zone */}
          <div className="bg-red-950/30 border border-red-900/50 rounded-lg p-6">
            <h3 className="font-semibold text-red-400 mb-4">Danger Zone</h3>
            <p className="text-sm text-gray-400 mb-4">
              Once you delete a database, there is no going back. Please be certain.
            </p>
            <button
              onClick={handleDelete}
              className="bg-red-600 hover:bg-red-500 px-4 py-2 rounded-lg text-sm font-medium transition-colors"
            >
              Delete Database
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

function StatCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="bg-gray-900/50 border border-gray-800 rounded-lg p-4">
      <p className="text-gray-400 text-sm">{label}</p>
      <p className="text-xl font-semibold mt-1">{value}</p>
    </div>
  )
}

function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 B'
  const k = 1024
  const sizes = ['B', 'KB', 'MB', 'GB']
  const i = Math.floor(Math.log(bytes) / Math.log(k))
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(1))} ${sizes[i]}`
}

function formatDate(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  })
}

function formatRelativeTime(dateStr: string): string {
  const date = new Date(dateStr)
  const now = new Date()
  const diffMs = now.getTime() - date.getTime()
  const diffMins = Math.floor(diffMs / 60000)
  const diffHours = Math.floor(diffMs / 3600000)
  const diffDays = Math.floor(diffMs / 86400000)

  if (diffMins < 1) return 'just now'
  if (diffMins < 60) return `${diffMins}m ago`
  if (diffHours < 24) return `${diffHours}h ago`
  if (diffDays < 7) return `${diffDays}d ago`
  return date.toLocaleDateString()
}
