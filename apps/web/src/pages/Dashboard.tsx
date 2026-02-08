import { useState, useEffect } from 'react'
import { Link, Navigate } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'
import { apiUrl } from '../lib/api'

interface IndraBase {
  id: string
  name: string
  description?: string
  visibility: 'public' | 'private'
  size_bytes: number
  thought_count: number
  updated_at: string
}

export default function Dashboard() {
  const { user, loading: authLoading } = useAuth()
  const [bases, setBases] = useState<IndraBase[]>([])
  const [loading, setLoading] = useState(true)
  const [showCreateModal, setShowCreateModal] = useState(false)

  useEffect(() => {
    if (user) {
      fetchBases()
    }
  }, [user])

  const fetchBases = async () => {
    try {
      const res = await fetch(apiUrl('/api/bases'), { credentials: 'include' })
      const data = await res.json()
      setBases(data.bases || [])
    } catch (error) {
      console.error('Failed to fetch bases:', error)
    } finally {
      setLoading(false)
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
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      {/* Header */}
      <div className="flex justify-between items-center mb-8">
        <div>
          <h1 className="text-3xl font-bold">Your Databases</h1>
          <p className="text-gray-400 mt-1">
            Manage your .indra knowledge bases
          </p>
        </div>
        <button
          onClick={() => setShowCreateModal(true)}
          className="bg-purple-600 hover:bg-purple-500 px-4 py-2 rounded-lg font-medium transition-colors flex items-center gap-2"
        >
          <span>+</span>
          New Database
        </button>
      </div>

      {/* Tier info */}
      <div className="bg-gray-900/50 border border-gray-800 rounded-lg p-4 mb-8 flex justify-between items-center">
        <div>
          <span className="text-gray-400">Current plan: </span>
          <span className="font-semibold capitalize">{user.tier}</span>
          {user.tier === 'hobby' && (
            <span className="text-gray-500 ml-2">
              ({bases.length}/1 databases used)
            </span>
          )}
        </div>
        {user.tier === 'hobby' && (
          <Link
            to="/settings"
            className="text-purple-400 hover:text-purple-300 text-sm"
          >
            Upgrade to Pro →
          </Link>
        )}
      </div>

      {/* Bases Grid */}
      {loading ? (
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
          {[1, 2, 3].map((i) => (
            <div key={i} className="bg-gray-900/50 border border-gray-800 rounded-lg p-6 animate-pulse">
              <div className="h-6 bg-gray-700 rounded w-3/4 mb-4" />
              <div className="h-4 bg-gray-700 rounded w-1/2" />
            </div>
          ))}
        </div>
      ) : bases.length === 0 ? (
        <div className="text-center py-16 bg-gray-900/30 border border-gray-800 rounded-lg">
          <div className="text-6xl mb-4">📚</div>
          <h3 className="text-xl font-semibold mb-2">No databases yet</h3>
          <p className="text-gray-400 mb-6">
            Create your first .indra database to start tracking AI reasoning
          </p>
          <button
            onClick={() => setShowCreateModal(true)}
            className="bg-purple-600 hover:bg-purple-500 px-6 py-2 rounded-lg font-medium transition-colors"
          >
            Create Database
          </button>
        </div>
      ) : (
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
          {bases.map((base) => (
            <Link
              key={base.id}
              to={`/bases/${base.id}`}
              className="bg-gray-900/50 border border-gray-800 rounded-lg p-6 hover:border-purple-500/50 transition-colors group"
            >
              <div className="flex items-start justify-between mb-2">
                <h3 className="font-semibold text-lg group-hover:text-purple-400 transition-colors">
                  {base.name}
                </h3>
                <span className={`text-xs px-2 py-1 rounded ${
                  base.visibility === 'public' 
                    ? 'bg-green-900/50 text-green-400' 
                    : 'bg-gray-800 text-gray-400'
                }`}>
                  {base.visibility}
                </span>
              </div>
              {base.description && (
                <p className="text-gray-400 text-sm mb-4 line-clamp-2">
                  {base.description}
                </p>
              )}
              <div className="flex gap-4 text-sm text-gray-500">
                <span>{base.thought_count} thoughts</span>
                <span>{formatBytes(base.size_bytes)}</span>
              </div>
              <div className="text-xs text-gray-600 mt-2">
                Updated {formatRelativeTime(base.updated_at)}
              </div>
            </Link>
          ))}
        </div>
      )}

      {/* Create Modal */}
      {showCreateModal && (
        <CreateBaseModal 
          onClose={() => setShowCreateModal(false)}
          onCreated={(base) => {
            setBases([base, ...bases])
            setShowCreateModal(false)
          }}
        />
      )}
    </div>
  )
}

function CreateBaseModal({ 
  onClose, 
  onCreated 
}: { 
  onClose: () => void
  onCreated: (base: IndraBase) => void 
}) {
  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [visibility, setVisibility] = useState<'public' | 'private'>('private')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError('')

    try {
      const res = await fetch(apiUrl('/api/bases'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ name, description, visibility }),
      })

      const data = await res.json()

      if (!res.ok) {
        throw new Error(data.error || 'Failed to create database')
      }

      onCreated(data.base)
    } catch (err: any) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-gray-900 border border-gray-800 rounded-xl p-6 max-w-md w-full mx-4">
        <h2 className="text-xl font-bold mb-4">Create New Database</h2>
        
        <form onSubmit={handleSubmit}>
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium mb-1">Name</label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="w-full bg-gray-800 border border-gray-700 rounded-lg px-4 py-2 focus:outline-none focus:border-purple-500"
                placeholder="my-agent-memory"
                required
              />
            </div>

            <div>
              <label className="block text-sm font-medium mb-1">Description (optional)</label>
              <textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                className="w-full bg-gray-800 border border-gray-700 rounded-lg px-4 py-2 focus:outline-none focus:border-purple-500"
                placeholder="Knowledge base for my personal assistant"
                rows={3}
              />
            </div>

            <div>
              <label className="block text-sm font-medium mb-1">Visibility</label>
              <select
                value={visibility}
                onChange={(e) => setVisibility(e.target.value as 'public' | 'private')}
                className="w-full bg-gray-800 border border-gray-700 rounded-lg px-4 py-2 focus:outline-none focus:border-purple-500"
              >
                <option value="private">Private</option>
                <option value="public">Public</option>
              </select>
            </div>
          </div>

          {error && (
            <p className="text-red-400 text-sm mt-4">{error}</p>
          )}

          <div className="flex justify-end gap-3 mt-6">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-gray-400 hover:text-white transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading || !name}
              className="bg-purple-600 hover:bg-purple-500 disabled:opacity-50 px-4 py-2 rounded-lg font-medium transition-colors"
            >
              {loading ? 'Creating...' : 'Create'}
            </button>
          </div>
        </form>
      </div>
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
