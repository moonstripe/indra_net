import { useState, useEffect, useRef, useCallback } from 'react'
import { useParams, Link } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'
import { VectorRenderer, type VectorRendererHandle } from 'react-vector-renderer'

interface VizThought {
  id: string
  content: string
  thought_type?: string
  position: [number, number, number]
  has_embedding: boolean
  created_at: number
}

interface VizMeta {
  total_thoughts: number
  embedded_thoughts: number
  reduction_method: string
  original_dim: number
  variance_explained?: [number, number, number]
}

interface VizExport {
  thoughts: VizThought[]
  meta: VizMeta
  cached?: boolean
  message?: string
}

export default function BaseVisualization() {
  const { id } = useParams<{ id: string }>()
  const { user, loading: authLoading } = useAuth()
  
  const [vizData, setVizData] = useState<VizExport | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [selectedThought, setSelectedThought] = useState<VizThought | null>(null)
  const [rendererReady, setRendererReady] = useState(false)
  const [baseName, setBaseName] = useState('')
  const [canEdit, setCanEdit] = useState(false)
  
  const rendererRef = useRef<VectorRendererHandle>(null)
  // Map from renderer embedding ID to thought
  const thoughtMapRef = useRef<Map<string, VizThought>>(new Map())

  useEffect(() => {
    if (id) {
      fetchBaseAndViz()
    }
  }, [id])

  useEffect(() => {
    // When renderer is ready and we have data, add all embeddings
    if (rendererReady && vizData && rendererRef.current) {
      thoughtMapRef.current.clear()
      
      for (const thought of vizData.thoughts) {
        if (thought.has_embedding) {
          try {
            const embId = rendererRef.current.addEmbedding(
              thought.position[0],
              thought.position[1],
              thought.position[2]
            )
            thoughtMapRef.current.set(embId, thought)
          } catch (e) {
            console.error('Failed to add embedding:', e)
          }
        }
      }
    }
  }, [rendererReady, vizData])

  const fetchBaseAndViz = async () => {
    try {
      // Fetch base info first
      const baseRes = await fetch(`/api/bases/${id}`, { credentials: 'include' })
      if (!baseRes.ok) {
        if (baseRes.status === 404) {
          setError('Database not found')
        } else {
          throw new Error('Failed to fetch database')
        }
        return
      }
      const baseData = await baseRes.json()
      setBaseName(baseData.base.name)
      setCanEdit(baseData.base.owner_id === user?.id)

      // Fetch visualization data
      const vizRes = await fetch(`/api/bases/${id}/viz`, { credentials: 'include' })
      if (!vizRes.ok) {
        throw new Error('Failed to fetch visualization data')
      }
      const vizJson: VizExport = await vizRes.json()
      setVizData(vizJson)
      
    } catch (err: any) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  const handleRendererReady = () => {
    setRendererReady(true)
  }

  // Handle selection changes from the renderer
  const handleSelect = useCallback((selectedEmbId: string | null) => {
    if (selectedEmbId === null) {
      setSelectedThought(null)
    } else {
      const thought = thoughtMapRef.current.get(selectedEmbId)
      if (thought) {
        setSelectedThought(thought)
      }
    }
  }, [])

  const handleClosePanel = () => {
    setSelectedThought(null)
    rendererRef.current?.clearSelection()
  }

  if (authLoading || loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-black">
        <div className="animate-spin h-8 w-8 border-2 border-purple-500 border-t-transparent rounded-full" />
      </div>
    )
  }

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-black">
        <div className="text-center">
          <div className="text-6xl mb-4">😕</div>
          <h1 className="text-2xl font-bold mb-2 text-white">{error}</h1>
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
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-black text-white relative">
      {/* Header overlay */}
      <div className="absolute top-0 left-0 right-0 z-10 bg-gradient-to-b from-black/80 to-transparent p-4">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Link to={`/bases/${id}`} className="text-gray-400 hover:text-white">
              ← Back
            </Link>
            <h1 className="text-xl font-bold">{baseName}</h1>
            <span className={`text-xs px-2 py-1 rounded ${
              canEdit 
                ? 'bg-green-900/50 text-green-400' 
                : 'bg-gray-800 text-gray-400'
            }`}>
              {canEdit ? 'Can edit' : 'Read only'}
            </span>
          </div>
          
          <div className="text-sm text-gray-400">
            {vizData?.meta.embedded_thoughts || 0} thoughts • {vizData?.meta.reduction_method || 'none'}
          </div>
        </div>
      </div>

      {/* Main visualization */}
      <div className="w-full h-screen">
        {vizData && vizData.thoughts.length > 0 ? (
          <VectorRenderer
            ref={rendererRef}
            width={window.innerWidth}
            height={window.innerHeight}
            showUI={false}
            onReady={handleRendererReady}
            onSelect={handleSelect}
            style={{ width: '100%', height: '100%' }}
          />
        ) : (
          <div className="flex items-center justify-center h-full">
            <div className="text-center max-w-md">
              <div className="text-6xl mb-4">🌌</div>
              <h2 className="text-xl font-semibold mb-2">No visualization data yet</h2>
              <p className="text-gray-400 mb-4">
                {vizData?.message || 'Push your database with visualization data to see your thought cloud.'}
              </p>
              <code className="block bg-gray-900 p-3 rounded text-sm font-mono text-green-400">
                indra push origin --viz
              </code>
            </div>
          </div>
        )}
      </div>

      {/* Selected thought panel */}
      {selectedThought && (
        <div className="absolute bottom-4 left-4 right-4 md:left-auto md:right-4 md:w-96 z-10 bg-gray-900/95 border border-gray-800 rounded-lg p-4 backdrop-blur shadow-xl">
          <div className="flex justify-between items-start mb-2">
            <span className="text-xs text-purple-400 font-mono">{selectedThought.id}</span>
            <button 
              onClick={handleClosePanel}
              className="text-gray-500 hover:text-white transition-colors"
            >
              ✕
            </button>
          </div>
          <p className="text-gray-200 whitespace-pre-wrap text-sm leading-relaxed max-h-64 overflow-y-auto">
            {selectedThought.content}
          </p>
          <div className="flex items-center gap-2 mt-3 pt-3 border-t border-gray-800">
            {selectedThought.thought_type && (
              <span className="text-xs bg-purple-900/50 text-purple-400 px-2 py-1 rounded">
                {selectedThought.thought_type}
              </span>
            )}
            <span className="text-xs text-gray-500">
              {new Date(selectedThought.created_at).toLocaleDateString()}
            </span>
          </div>
        </div>
      )}

      {/* Stats panel - hide when thought is selected on mobile */}
      {vizData && !selectedThought && (
        <div className="absolute bottom-4 left-4 z-10 bg-gray-900/80 border border-gray-800 rounded-lg p-3 text-xs hidden md:block">
          <div className="grid grid-cols-2 gap-x-4 gap-y-1">
            <span className="text-gray-500">Total:</span>
            <span>{vizData.meta.total_thoughts}</span>
            <span className="text-gray-500">Embedded:</span>
            <span>{vizData.meta.embedded_thoughts}</span>
            <span className="text-gray-500">Method:</span>
            <span>{vizData.meta.reduction_method}</span>
            {vizData.meta.variance_explained && (
              <>
                <span className="text-gray-500">Variance:</span>
                <span>
                  {(vizData.meta.variance_explained.reduce((a, b) => a + b, 0) * 100).toFixed(1)}%
                </span>
              </>
            )}
          </div>
        </div>
      )}

      {/* Instructions overlay - shown briefly */}
      {rendererReady && vizData && vizData.thoughts.length > 0 && !selectedThought && (
        <div className="absolute bottom-4 left-1/2 -translate-x-1/2 z-10 text-gray-500 text-sm pointer-events-none animate-pulse">
          Click a point to see its content • Drag to rotate • Scroll to zoom
        </div>
      )}
    </div>
  )
}
