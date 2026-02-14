import { useState, useEffect } from 'react'
import { useParams, useNavigate, Link } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'
import { apiFetch } from '../lib/api'
import ActivityHeatmap from '../components/ActivityHeatmap'
import { Check, BarChart3, Rocket, Lightbulb, TrendingUp, Target, Link2, Brain, Frown, Sparkles, Calendar, Copy } from 'lucide-react'

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

interface Branch {
  name: string
  hash: string
  current: boolean
}

type Tab = 'overview' | 'thoughts' | 'history' | 'branches' | 'analytics' | 'settings'

interface Analytics {
  growth: {
    daily: Array<{ date: string; count: number; cumulative: number }>
    weekly: Array<{ week: string; count: number }>
    totalDays: number
    avgPerDay: number
  }
  clusters: {
    distribution: Array<{ id: number; label: string; count: number; percentage: number }>
    dominantCluster: { id: number; label: string; percentage: number } | null
  } | null
  activity: {
    heatmap: number[][]
    peakHour: number
    peakDay: number
    totalEvents: number
  }
  branches: {
    count: number
    current: string
    comparison: Array<{ name: string; thoughtCount: number; percentage: number }>
  } | null
  embeddings: {
    coverage: number
    model: string | null
    dimensions: number
    varianceExplained: number
  }
  connections: {
    totalEdges: number
    avgConnectionsPerThought: number
    mostConnected: Array<{ id: string; content: string; connectionCount: number }>
    edgeTypeDistribution: Array<{ type: string; count: number; percentage: number }>
  }
  diversity: {
    score: number
    spreadX: number
    spreadY: number
    spreadZ: number
    centroid: [number, number, number]
  }
  summary: {
    totalThoughts: number
    embeddedThoughts: number
    totalCommits: number
    totalBranches: number
    ageInDays: number
    lastActivity: string
  }
}

export default function BaseDetail() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const { user, loading: authLoading } = useAuth()
  
  const [base, setBase] = useState<IndraBase | null>(null)
  const [thoughts, setThoughts] = useState<Thought[]>([])
  const [commits, setCommits] = useState<Commit[]>([])
  const [branches, setBranches] = useState<Branch[]>([])
  const [analytics, setAnalytics] = useState<Analytics | null>(null)
  const [analyticsLoading, setAnalyticsLoading] = useState(false)
  const [analyticsError, setAnalyticsError] = useState<string | null>(null)
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
    if (base && (activeTab === 'history' || activeTab === 'overview')) {
      fetchCommits()
    }
    if (base && activeTab === 'branches') {
      fetchBranches()
    }
    if (base && activeTab === 'analytics') {
      fetchAnalytics()
    }
  }, [base, activeTab])

  const fetchAnalytics = async () => {
    if (analyticsLoading) return
    setAnalyticsLoading(true)
    setAnalyticsError(null)
    
    try {
      const res = await apiFetch(`/api/bases/${id}/analytics`)
      const data = await res.json()
      
      if (data.analytics) {
        setAnalytics(data.analytics)
      } else {
        setAnalyticsError(data.reason || 'Analytics not available')
      }
    } catch (err: any) {
      console.error('Failed to fetch analytics:', err)
      setAnalyticsError(err.message || 'Failed to fetch analytics')
    } finally {
      setAnalyticsLoading(false)
    }
  }

  const fetchBase = async () => {
    try {
      const res = await apiFetch(`/api/bases/${id}`)
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
      const res = await apiFetch(`/api/bases/${id}/thoughts?limit=50`)
      const data = await res.json()
      setThoughts(data.thoughts || [])
    } catch (err) {
      console.error('Failed to fetch thoughts:', err)
    }
  }

  const fetchCommits = async () => {
    try {
      const res = await apiFetch(`/api/bases/${id}/commits?limit=50`)
      const data = await res.json()
      setCommits(data.commits || [])
    } catch (err) {
      console.error('Failed to fetch commits:', err)
    }
  }

  const fetchBranches = async () => {
    try {
      const res = await apiFetch(`/api/bases/${id}/branches`)
      const data = await res.json()
      setBranches(data.branches || [])
    } catch (err) {
      console.error('Failed to fetch branches:', err)
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
      const res = await apiFetch(
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
      const res = await apiFetch(`/api/bases/${id}`, {
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
      const res = await apiFetch(`/api/bases/${id}`, {
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

  const copyCloneCommand = () => {
    const cmd = `indra clone ${user?.name || 'username'}/${base?.name}`
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
        <Frown className="w-16 h-16 mx-auto mb-4 text-gray-500" />
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
            className="bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-500 hover:to-pink-500 px-4 py-2 rounded-lg text-sm transition-all flex items-center gap-2"
            title="Open 3D visualization"
          >
            <Sparkles className="w-4 h-4" />
            Visualize
          </Link>
          <button
            onClick={copyCloneCommand}
            className="bg-purple-600 hover:bg-purple-500 px-4 py-2 rounded-lg text-sm transition-colors flex items-center gap-2"
            title="Copy clone command to clipboard"
          >
            {copyFeedback ? (
              <>
                <Check className="w-4 h-4" />
                Copied!
              </>
            ) : (
              <>
                <Copy className="w-4 h-4" />
                Clone
              </>
            )}
          </button>
        </div>
      </div>

      {/* Stats + Activity Card */}
      <div className="bg-gray-900/50 border border-gray-800 rounded-lg p-4 mb-8">
        <div className="flex flex-col lg:flex-row lg:items-start gap-6">
          {/* Stats grid */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 flex-1">
            <StatCard label="Thoughts" value={base.thought_count.toLocaleString()} />
            <StatCard label="Size" value={formatBytes(base.size_bytes)} />
            <StatCard label="Created" value={formatDate(base.created_at)} />
            <StatCard label="Updated" value={formatRelativeTime(base.updated_at)} />
          </div>
          
          {/* Activity Heatmap - max 1/4 width */}
          {(thoughts.length > 0 || commits.length > 0) && (
            <div className="lg:w-1/4 flex-shrink-0">
              <div className="flex items-center justify-between mb-2">
                <h4 className="text-sm font-medium text-gray-400">Activity</h4>
                <span className="text-xs text-gray-500">
                  {thoughts.length + commits.length} events
                </span>
              </div>
              <ActivityHeatmap
                dates={[
                  ...thoughts.map(t => t.committed_at || t.created_at),
                  ...commits.map(c => c.timestamp),
                ]}
                compact
                showLegend={false}
                showDayLabels={false}
              />
            </div>
          )}
        </div>
      </div>

      {/* Tabs */}
      <div className="border-b border-gray-800 mb-6">
        <nav className="flex gap-6 overflow-x-auto">
          {(['overview', 'thoughts', 'history', 'branches', 'analytics', 'settings'] as Tab[]).map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`pb-3 px-1 text-sm font-medium transition-colors relative whitespace-nowrap ${
                activeTab === tab
                  ? 'text-purple-400'
                  : 'text-gray-400 hover:text-white'
              }`}
            >
              {tab === 'analytics' ? (
                <>
                  <BarChart3 className="w-4 h-4 inline mr-1" />
                  Analytics
                </>
              ) : tab.charAt(0).toUpperCase() + tab.slice(1)}
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
              <h3 className="font-semibold mb-4 flex items-center gap-2">
                <Rocket className="w-5 h-5 text-purple-400" />
                Get Started
              </h3>
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
                    Login to connect your CLI to IndraDB:
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
                  <h4 className="font-medium text-purple-400 mb-2">5. Push to IndraDB</h4>
                  <p className="text-sm text-gray-400 mb-2">
                    Sync your database with visualization:
                  </p>
                  <code className="block bg-black/50 p-3 rounded text-sm font-mono text-green-400">
                    indra push origin --viz
                  </code>
                </div>
              </div>

              <div className="mt-6 p-4 bg-purple-900/20 border border-purple-800/50 rounded-lg">
                <p className="text-sm text-purple-300 flex items-start gap-2">
                  <Lightbulb className="w-4 h-4 mt-0.5 flex-shrink-0" />
                  <span><strong>Tip:</strong> Use the MCP server (<code className="text-purple-400">indra_db_mcp</code>) to let AI agents interact with your knowledge base directly.</span>
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
                  <Sparkles className="w-4 h-4" />
                  Visualize Selected
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

      {activeTab === 'branches' && (
        <div className="bg-gray-900/50 border border-gray-800 rounded-lg p-6">
          <h3 className="font-semibold mb-4">Branches</h3>
          
          {branches.length === 0 ? (
            <p className="text-center text-gray-500 py-8">
              No branches found. Push your database to see branches.
            </p>
          ) : (
            <div className="space-y-3">
              {branches.map((branch) => (
                <div 
                  key={branch.name}
                  className={`flex items-center justify-between p-4 rounded-lg border ${
                    branch.current 
                      ? 'bg-purple-900/20 border-purple-800/50' 
                      : 'bg-gray-900/30 border-gray-800'
                  }`}
                >
                  <div className="flex items-center gap-3">
                    {branch.current && (
                      <span className="text-xs bg-purple-600 px-2 py-0.5 rounded">HEAD</span>
                    )}
                    <span className={`font-medium ${branch.current ? 'text-purple-400' : 'text-gray-300'}`}>
                      {branch.name}
                    </span>
                  </div>
                  <code className="text-sm font-mono text-gray-500">
                    {branch.hash.slice(0, 8)}
                  </code>
                </div>
              ))}
            </div>
          )}
          
          {branches.length >= 2 && (
            <div className="mt-6 pt-6 border-t border-gray-800">
              <h4 className="font-medium mb-3 text-gray-400">Compare Branches</h4>
              <p className="text-sm text-gray-500 mb-4">
                Compare two branches to see how thoughts have diverged - useful for tracking "changed minds".
              </p>
              <BranchCompare baseId={id!} branches={branches} />
            </div>
          )}
        </div>
      )}

      {activeTab === 'analytics' && (
        <div className="space-y-6">
          {analyticsLoading ? (
            <div className="flex items-center justify-center py-12">
              <div className="animate-spin h-8 w-8 border-2 border-purple-500 border-t-transparent rounded-full" />
            </div>
          ) : analyticsError ? (
            <div className="bg-gray-900/50 border border-gray-800 rounded-lg p-6 text-center">
              <BarChart3 className="w-12 h-12 mx-auto mb-4 text-gray-400" />
              <h3 className="font-semibold mb-2">Analytics Not Available</h3>
              <p className="text-gray-400 mb-4">{analyticsError}</p>
              {base.thought_count < 10 && (
                <div className="inline-block bg-purple-900/30 border border-purple-800/50 rounded-lg px-4 py-2 text-sm">
                  <span className="text-purple-400 font-medium">{10 - base.thought_count}</span>
                  <span className="text-gray-400"> more thoughts needed to unlock analytics</span>
                </div>
              )}
            </div>
          ) : analytics ? (
            <>
              {/* Summary Cards */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                <div className="bg-gray-900/50 border border-gray-800 rounded-lg p-4">
                  <p className="text-gray-400 text-sm">Total Thoughts</p>
                  <p className="text-2xl font-bold text-purple-400">{analytics.summary.totalThoughts}</p>
                </div>
                <div className="bg-gray-900/50 border border-gray-800 rounded-lg p-4">
                  <p className="text-gray-400 text-sm">Diversity Score</p>
                  <p className="text-2xl font-bold text-green-400">{(analytics.diversity.score * 100).toFixed(0)}%</p>
                </div>
                <div className="bg-gray-900/50 border border-gray-800 rounded-lg p-4">
                  <p className="text-gray-400 text-sm">Embedding Coverage</p>
                  <p className="text-2xl font-bold text-blue-400">{analytics.embeddings.coverage.toFixed(0)}%</p>
                </div>
                <div className="bg-gray-900/50 border border-gray-800 rounded-lg p-4">
                  <p className="text-gray-400 text-sm">Avg/Day</p>
                  <p className="text-2xl font-bold text-yellow-400">{analytics.growth.avgPerDay.toFixed(1)}</p>
                </div>
              </div>

              {/* Growth Chart */}
              <div className="bg-gray-900/50 border border-gray-800 rounded-lg p-6">
                <h3 className="font-semibold mb-4 flex items-center gap-2">
                  <TrendingUp className="w-5 h-5 text-purple-400" />
                  Thought Growth
                </h3>
                <div className="h-48">
                  <GrowthChart data={analytics.growth.daily} />
                </div>
                <div className="mt-4 flex gap-6 text-sm text-gray-400">
                  <span>Total Days: <span className="text-white">{analytics.growth.totalDays}</span></span>
                  <span>Avg/Day: <span className="text-white">{analytics.growth.avgPerDay.toFixed(2)}</span></span>
                </div>
              </div>

              {/* Cluster Distribution */}
              {analytics.clusters && (
                <div className="bg-gray-900/50 border border-gray-800 rounded-lg p-6">
                  <h3 className="font-semibold mb-4 flex items-center gap-2">
                    <Target className="w-5 h-5 text-purple-400" />
                    Cluster Distribution
                  </h3>
                  <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                    <div>
                      <ClusterChart clusters={analytics.clusters.distribution} />
                    </div>
                    <div className="space-y-2">
                      {analytics.clusters.distribution.slice(0, 5).map((cluster, i) => (
                        <div key={cluster.id} className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <div 
                              className="w-3 h-3 rounded-full" 
                              style={{ backgroundColor: CLUSTER_COLORS[i % CLUSTER_COLORS.length] }}
                            />
                            <span className="text-sm text-gray-300 truncate max-w-[200px]" title={cluster.label}>
                              {cluster.label}
                            </span>
                          </div>
                          <span className="text-sm text-gray-500">{cluster.percentage.toFixed(1)}%</span>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              )}

              {/* Activity Heatmap */}
              <div className="bg-gray-900/50 border border-gray-800 rounded-lg p-6">
                <h3 className="font-semibold mb-4 flex items-center gap-2">
                  <Calendar className="w-5 h-5 text-purple-400" />
                  Activity Patterns
                </h3>
                <ActivityHeatmapDetailed heatmap={analytics.activity.heatmap} />
                <div className="mt-4 flex gap-6 text-sm text-gray-400">
                  <span>Peak Hour: <span className="text-white">{formatHour(analytics.activity.peakHour)}</span></span>
                  <span>Peak Day: <span className="text-white">{DAYS[analytics.activity.peakDay]}</span></span>
                  <span>Total Events: <span className="text-white">{analytics.activity.totalEvents}</span></span>
                </div>
              </div>

              {/* Connections */}
              {analytics.connections.mostConnected.length > 0 && (
                <div className="bg-gray-900/50 border border-gray-800 rounded-lg p-6">
                  <h3 className="font-semibold mb-4 flex items-center gap-2">
                    <Link2 className="w-5 h-5 text-purple-400" />
                    Top Connected Thoughts
                  </h3>
                  <div className="space-y-3">
                    {analytics.connections.mostConnected.map((thought, i) => (
                      <div key={thought.id} className="flex items-start gap-3 p-3 bg-gray-800/50 rounded-lg">
                        <span className="text-lg font-bold text-purple-400">#{i + 1}</span>
                        <div className="flex-1">
                          <p className="text-gray-200 line-clamp-2">{thought.content}</p>
                          <p className="text-sm text-gray-500 mt-1">{thought.connectionCount} connections</p>
                        </div>
                      </div>
                    ))}
                  </div>
                  <div className="mt-4 pt-4 border-t border-gray-700 flex gap-6 text-sm text-gray-400">
                    <span>Total Edges: <span className="text-white">{analytics.connections.totalEdges}</span></span>
                    <span>Avg Connections: <span className="text-white">{analytics.connections.avgConnectionsPerThought.toFixed(1)}</span></span>
                  </div>
                </div>
              )}

              {/* Embedding Quality */}
              <div className="bg-gray-900/50 border border-gray-800 rounded-lg p-6">
                <h3 className="font-semibold mb-4 flex items-center gap-2">
                  <Brain className="w-5 h-5 text-purple-400" />
                  Embedding Quality
                </h3>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                  <div>
                    <p className="text-gray-400 text-sm">Coverage</p>
                    <p className="text-xl font-semibold">{analytics.embeddings.coverage.toFixed(1)}%</p>
                  </div>
                  <div>
                    <p className="text-gray-400 text-sm">Dimensions</p>
                    <p className="text-xl font-semibold">{analytics.embeddings.dimensions}</p>
                  </div>
                  <div>
                    <p className="text-gray-400 text-sm">Variance Explained</p>
                    <p className="text-xl font-semibold">{analytics.embeddings.varianceExplained.toFixed(1)}%</p>
                  </div>
                  <div>
                    <p className="text-gray-400 text-sm">Model</p>
                    <p className="text-xl font-semibold truncate" title={analytics.embeddings.model || 'Unknown'}>
                      {analytics.embeddings.model?.split('/').pop() || 'Unknown'}
                    </p>
                  </div>
                </div>
                
                {/* Diversity Visualization */}
                <div className="mt-6 pt-6 border-t border-gray-700">
                  <h4 className="font-medium mb-3 text-gray-400">Semantic Diversity</h4>
                  <div className="flex items-center gap-4">
                    <div className="flex-1">
                      <div className="h-4 bg-gray-800 rounded-full overflow-hidden">
                        <div 
                          className="h-full bg-gradient-to-r from-purple-600 to-pink-600 rounded-full transition-all"
                          style={{ width: `${analytics.diversity.score * 100}%` }}
                        />
                      </div>
                    </div>
                    <span className="text-lg font-bold text-purple-400">
                      {(analytics.diversity.score * 100).toFixed(0)}%
                    </span>
                  </div>
                  <p className="text-xs text-gray-500 mt-2">
                    {analytics.diversity.score < 0.3 ? 'Thoughts are tightly clustered - consider exploring new topics' :
                     analytics.diversity.score < 0.6 ? 'Good balance of focused and diverse thinking' :
                     'Highly diverse thought patterns across the embedding space'}
                  </p>
                </div>
              </div>
            </>
          ) : null}
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
    <div>
      <p className="text-gray-400 text-sm mb-4">{label}</p>
      <p className="text-xl font-semibold">{value}</p>
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

interface BranchCompareProps {
  baseId: string
  branches: Branch[]
}

interface ComparisonResult {
  branch1: {
    name: string
    hash: string
    uniqueCommits: Array<{ hash: string; message: string; timestamp: number }>
    totalCommits: number
  }
  branch2: {
    name: string
    hash: string
    uniqueCommits: Array<{ hash: string; message: string; timestamp: number }>
    totalCommits: number
  }
  commonAncestor: {
    count: number
    latestCommon: { hash: string; message: string; timestamp: number } | null
  } | null
  divergence: {
    branch1UniqueCount: number
    branch2UniqueCount: number
    commonCount: number
  }
}

function BranchCompare({ baseId, branches }: BranchCompareProps) {
  const [branch1, setBranch1] = useState(branches[0]?.name || '')
  const [branch2, setBranch2] = useState(branches[1]?.name || '')
  const [comparison, setComparison] = useState<ComparisonResult | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const handleCompare = async () => {
    if (!branch1 || !branch2 || branch1 === branch2) return
    
    setLoading(true)
    setError('')
    
    try {
      const res = await apiFetch(
        `/api/bases/${baseId}/branches/compare?branch1=${encodeURIComponent(branch1)}&branch2=${encodeURIComponent(branch2)}`
      )
      const data = await res.json()
      
      if (!res.ok) {
        throw new Error(data.error || 'Failed to compare branches')
      }
      
      setComparison(data)
    } catch (err: any) {
      setError(err.message)
      setComparison(null)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex gap-4 items-end">
        <div className="flex-1">
          <label className="block text-xs text-gray-500 mb-1">Base Branch</label>
          <select
            value={branch1}
            onChange={(e) => setBranch1(e.target.value)}
            className="w-full bg-gray-800 border border-gray-700 rounded px-3 py-2 text-sm"
          >
            {branches.map(b => (
              <option key={b.name} value={b.name}>{b.name}</option>
            ))}
          </select>
        </div>
        <span className="text-gray-500 pb-2">vs</span>
        <div className="flex-1">
          <label className="block text-xs text-gray-500 mb-1">Compare Branch</label>
          <select
            value={branch2}
            onChange={(e) => setBranch2(e.target.value)}
            className="w-full bg-gray-800 border border-gray-700 rounded px-3 py-2 text-sm"
          >
            {branches.map(b => (
              <option key={b.name} value={b.name}>{b.name}</option>
            ))}
          </select>
        </div>
        <button
          onClick={handleCompare}
          disabled={loading || branch1 === branch2}
          className="bg-purple-600 hover:bg-purple-500 disabled:opacity-50 px-4 py-2 rounded text-sm font-medium"
        >
          {loading ? 'Comparing...' : 'Compare'}
        </button>
      </div>

      {error && (
        <p className="text-red-400 text-sm">{error}</p>
      )}

      {comparison && (
        <div className="mt-4 p-4 bg-gray-800/50 rounded-lg space-y-4">
          <div className="grid grid-cols-3 gap-4 text-center">
            <div>
              <p className="text-2xl font-bold text-purple-400">{comparison.divergence.branch1UniqueCount}</p>
              <p className="text-xs text-gray-500">Unique to {comparison.branch1.name}</p>
            </div>
            <div>
              <p className="text-2xl font-bold text-gray-400">{comparison.divergence.commonCount}</p>
              <p className="text-xs text-gray-500">Common commits</p>
            </div>
            <div>
              <p className="text-2xl font-bold text-blue-400">{comparison.divergence.branch2UniqueCount}</p>
              <p className="text-xs text-gray-500">Unique to {comparison.branch2.name}</p>
            </div>
          </div>

          {comparison.commonAncestor?.latestCommon && (
            <div className="pt-4 border-t border-gray-700">
              <p className="text-xs text-gray-500 mb-2">Fork Point</p>
              <div className="flex items-center gap-2">
                <code className="text-xs font-mono text-gray-400">
                  {comparison.commonAncestor.latestCommon.hash.slice(0, 8)}
                </code>
                <span className="text-sm text-gray-300">
                  {comparison.commonAncestor.latestCommon.message}
                </span>
              </div>
            </div>
          )}

          {(comparison.branch1.uniqueCommits.length > 0 || comparison.branch2.uniqueCommits.length > 0) && (
            <div className="pt-4 border-t border-gray-700 grid grid-cols-2 gap-4">
              <div>
                <p className="text-xs text-gray-500 mb-2">Commits only in {comparison.branch1.name}</p>
                <div className="space-y-1 max-h-40 overflow-y-auto">
                  {comparison.branch1.uniqueCommits.slice(0, 5).map(c => (
                    <div key={c.hash} className="text-xs">
                      <code className="text-purple-400">{c.hash.slice(0, 8)}</code>
                      <span className="text-gray-400 ml-2">{c.message.slice(0, 30)}</span>
                    </div>
                  ))}
                  {comparison.branch1.uniqueCommits.length > 5 && (
                    <p className="text-xs text-gray-500">+{comparison.branch1.uniqueCommits.length - 5} more</p>
                  )}
                </div>
              </div>
              <div>
                <p className="text-xs text-gray-500 mb-2">Commits only in {comparison.branch2.name}</p>
                <div className="space-y-1 max-h-40 overflow-y-auto">
                  {comparison.branch2.uniqueCommits.slice(0, 5).map(c => (
                    <div key={c.hash} className="text-xs">
                      <code className="text-blue-400">{c.hash.slice(0, 8)}</code>
                      <span className="text-gray-400 ml-2">{c.message.slice(0, 30)}</span>
                    </div>
                  ))}
                  {comparison.branch2.uniqueCommits.length > 5 && (
                    <p className="text-xs text-gray-500">+{comparison.branch2.uniqueCommits.length - 5} more</p>
                  )}
                </div>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

// Constants for analytics
const CLUSTER_COLORS = [
  '#8B5CF6', // purple
  '#EC4899', // pink
  '#3B82F6', // blue
  '#10B981', // green
  '#F59E0B', // amber
  '#EF4444', // red
  '#6366F1', // indigo
  '#14B8A6', // teal
]

const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']

function formatHour(hour: number): string {
  if (hour === 0) return '12am'
  if (hour === 12) return '12pm'
  return hour < 12 ? `${hour}am` : `${hour - 12}pm`
}

// Simple Growth Chart (SVG-based)
function GrowthChart({ data }: { data: Array<{ date: string; count: number; cumulative: number }> }) {
  if (data.length === 0) return <p className="text-gray-500">No data</p>
  
  const maxCumulative = Math.max(...data.map(d => d.cumulative))
  const width = 100
  const height = 100
  const padding = 5
  
  const points = data.map((d, i) => {
    const x = padding + (i / (data.length - 1)) * (width - padding * 2)
    const y = height - padding - (d.cumulative / maxCumulative) * (height - padding * 2)
    return `${x},${y}`
  }).join(' ')
  
  // Create area fill path
  const areaPath = `M ${padding},${height - padding} L ${points} L ${width - padding},${height - padding} Z`
  
  return (
    <svg viewBox={`0 0 ${width} ${height}`} className="w-full h-full" preserveAspectRatio="none">
      <defs>
        <linearGradient id="growthGradient" x1="0%" y1="0%" x2="0%" y2="100%">
          <stop offset="0%" stopColor="#8B5CF6" stopOpacity="0.3" />
          <stop offset="100%" stopColor="#8B5CF6" stopOpacity="0" />
        </linearGradient>
      </defs>
      <path d={areaPath} fill="url(#growthGradient)" />
      <polyline
        points={points}
        fill="none"
        stroke="#8B5CF6"
        strokeWidth="2"
        vectorEffect="non-scaling-stroke"
      />
    </svg>
  )
}

// Simple Cluster Chart (horizontal bars)
function ClusterChart({ clusters }: { clusters: Array<{ id: number; label: string; count: number; percentage: number }> }) {
  const maxCount = Math.max(...clusters.map(c => c.count))
  
  return (
    <div className="space-y-2">
      {clusters.slice(0, 6).map((cluster, i) => (
        <div key={cluster.id} className="flex items-center gap-2">
          <div className="w-16 text-xs text-gray-500 truncate" title={cluster.label}>
            {cluster.label.slice(0, 15)}...
          </div>
          <div className="flex-1 h-6 bg-gray-800 rounded overflow-hidden">
            <div 
              className="h-full rounded transition-all"
              style={{ 
                width: `${(cluster.count / maxCount) * 100}%`,
                backgroundColor: CLUSTER_COLORS[i % CLUSTER_COLORS.length]
              }}
            />
          </div>
          <div className="w-12 text-xs text-gray-400 text-right">{cluster.count}</div>
        </div>
      ))}
    </div>
  )
}

// Detailed Activity Heatmap (7 days x 24 hours)
function ActivityHeatmapDetailed({ heatmap }: { heatmap: number[][] }) {
  const maxValue = Math.max(...heatmap.flat())
  
  return (
    <div className="overflow-x-auto">
      <div className="min-w-[600px]">
        {/* Hour labels */}
        <div className="flex mb-1 pl-12">
          {[0, 6, 12, 18].map(hour => (
            <div key={hour} className="flex-1 text-xs text-gray-500">
              {formatHour(hour)}
            </div>
          ))}
        </div>
        
        {/* Heatmap grid */}
        <div className="space-y-1">
          {DAYS.map((day, dayIdx) => (
            <div key={day} className="flex items-center gap-1">
              <div className="w-10 text-xs text-gray-500 text-right pr-2">{day}</div>
              <div className="flex gap-0.5 flex-1">
                {heatmap[dayIdx].map((value, hourIdx) => {
                  const intensity = maxValue > 0 ? value / maxValue : 0
                  return (
                    <div
                      key={hourIdx}
                      className="flex-1 h-4 rounded-sm transition-colors"
                      style={{
                        backgroundColor: intensity > 0 
                          ? `rgba(139, 92, 246, ${0.1 + intensity * 0.9})` 
                          : 'rgba(75, 85, 99, 0.3)',
                      }}
                      title={`${day} ${formatHour(hourIdx)}: ${value} events`}
                    />
                  )
                })}
              </div>
            </div>
          ))}
        </div>
        
        {/* Legend */}
        <div className="flex items-center justify-end gap-2 mt-2 text-xs text-gray-500">
          <span>Less</span>
          <div className="flex gap-0.5">
            {[0.1, 0.3, 0.5, 0.7, 0.9].map(intensity => (
              <div 
                key={intensity}
                className="w-3 h-3 rounded-sm"
                style={{ backgroundColor: `rgba(139, 92, 246, ${intensity})` }}
              />
            ))}
          </div>
          <span>More</span>
        </div>
      </div>
    </div>
  )
}
