import { useState, useEffect, useRef, useCallback, useMemo } from 'react'
import { useParams, useSearchParams, Link } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'
import { VectorRenderer, type VectorRendererHandle } from 'react-vector-renderer'
import { apiFetch } from '../lib/api'

interface VizThought {
  id: string
  content: string
  thought_type?: string
  position: [number, number, number]
  has_embedding: boolean
  created_at: number
}

interface VizCommit {
  hash: string
  message: string
  author: string
  timestamp: number
  parents: string[]
}

interface VizMeta {
  total_thoughts: number
  embedded_thoughts: number
  reduction_method: string
  original_dim: number
  variance_explained?: [number, number, number]
  embedder_model?: string
}

interface VizExport {
  thoughts: VizThought[]
  commits?: VizCommit[]
  meta: VizMeta
  cached?: boolean
  message?: string
}

export default function BaseVisualization() {
  const { id } = useParams<{ id: string }>()
  const [searchParams] = useSearchParams()
  const { user, loading: authLoading } = useAuth()
  
  const [vizData, setVizData] = useState<VizExport | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [selectedThought, setSelectedThought] = useState<VizThought | null>(null)
  const [rendererReady, setRendererReady] = useState(false)
  const [baseName, setBaseName] = useState('')
  const [canEdit, setCanEdit] = useState(false)
  
  // Timeline state
  const [timelineIndex, setTimelineIndex] = useState<number | null>(null) // null = show all
  const [isPlaying, setIsPlaying] = useState(false)
  
  const rendererRef = useRef<VectorRendererHandle>(null)
  // Map from renderer embedding ID to thought
  const thoughtMapRef = useRef<Map<string, VizThought>>(new Map())
  
  // Get focused thought IDs from URL params (e.g., ?focus=id1,id2,id3)
  const focusedIds = useMemo(() => {
    const focus = searchParams.get('focus')
    return focus ? new Set(focus.split(',')) : null
  }, [searchParams])
  
  // Sort commits by timestamp (oldest first for timeline)
  const sortedCommits = useMemo(() => {
    if (!vizData?.commits) return []
    return [...vizData.commits].sort((a, b) => a.timestamp - b.timestamp)
  }, [vizData?.commits])
  
  // Filter thoughts based on timeline position
  const filteredThoughts = useMemo(() => {
    if (!vizData?.thoughts) return []
    
    let thoughts = vizData.thoughts
    
    // If focused IDs are provided, only show those
    if (focusedIds) {
      thoughts = thoughts.filter(t => focusedIds.has(t.id))
    }
    
    // If timeline is active, filter by commit timestamp
    if (timelineIndex !== null && sortedCommits.length > 0) {
      const selectedCommit = sortedCommits[timelineIndex]
      if (selectedCommit) {
        // Show thoughts created before or at the selected commit's timestamp
        thoughts = thoughts.filter(t => t.created_at <= selectedCommit.timestamp)
      }
    }
    
    return thoughts
  }, [vizData?.thoughts, focusedIds, timelineIndex, sortedCommits])

  useEffect(() => {
    // Wait for auth to finish before fetching - user may be null (logged out) but authLoading must be false
    if (id && !authLoading) {
      fetchBaseAndViz()
    }
  }, [id, authLoading])

  useEffect(() => {
    // When renderer is ready and we have filtered data, update embeddings
    if (rendererReady && rendererRef.current) {
      // Get current embeddings and delete them
      const currentEmbeddings = rendererRef.current.getEmbeddings()
      for (const emb of currentEmbeddings) {
        rendererRef.current.deleteEmbedding(emb.id)
      }
      thoughtMapRef.current.clear()
      
      for (const thought of filteredThoughts) {
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
  }, [rendererReady, filteredThoughts])
  
  // Timeline playback
  useEffect(() => {
    if (!isPlaying || sortedCommits.length === 0) return
    
    const interval = setInterval(() => {
      setTimelineIndex(prev => {
        if (prev === null) return 0
        if (prev >= sortedCommits.length - 1) {
          setIsPlaying(false)
          return prev
        }
        return prev + 1
      })
    }, 1000) // 1 second per commit
    
    return () => clearInterval(interval)
  }, [isPlaying, sortedCommits.length])

  const fetchBaseAndViz = async () => {
    try {
      // Fetch base info first
      const baseRes = await apiFetch(`/api/bases/${id}`)
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
      const vizRes = await apiFetch(`/api/bases/${id}/viz`)
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
            {filteredThoughts.filter(t => t.has_embedding).length} of {vizData?.meta.embedded_thoughts || 0} thoughts • {vizData?.meta.reduction_method || 'none'}
          </div>
        </div>
      </div>

      {/* Main visualization */}
      <div className="absolute inset-0">
        {vizData && vizData.thoughts.length > 0 ? (
          <VectorRenderer
            ref={rendererRef}
            width={window.innerWidth}
            height={window.innerHeight}
            showUI={false}
            onReady={handleRendererReady}
            onSelect={handleSelect}
            style={{ width: '100vw', height: '100vh', display: 'block' }}
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
            {vizData.meta.embedder_model && (
              <>
                <span className="text-gray-500">Model:</span>
                <span className="text-purple-400 font-medium" title={vizData.meta.embedder_model}>
                  {vizData.meta.embedder_model.includes('/') 
                    ? vizData.meta.embedder_model.split('/').pop() 
                    : vizData.meta.embedder_model}
                </span>
              </>
            )}
            {vizData.meta.original_dim > 0 && (
              <>
                <span className="text-gray-500">Dimensions:</span>
                <span>{vizData.meta.original_dim}</span>
              </>
            )}
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
            {timelineIndex !== null && (
              <>
                <span className="text-gray-500">Showing:</span>
                <span>{filteredThoughts.length} thoughts</span>
              </>
            )}
          </div>
        </div>
      )}

      {/* Timeline bar - shown when commits exist */}
      {sortedCommits.length > 0 && vizData && vizData.thoughts.length > 0 && (
        <div className="absolute top-20 left-4 right-4 z-10">
          <div className="max-w-4xl mx-auto bg-gray-900/90 border border-gray-800 rounded-lg p-4 backdrop-blur">
            <div className="flex items-center gap-4">
              {/* Play/Pause button */}
              <button
                onClick={() => {
                  if (timelineIndex === null) setTimelineIndex(0)
                  setIsPlaying(!isPlaying)
                }}
                className="p-2 rounded-lg bg-purple-600 hover:bg-purple-500 transition-colors"
                title={isPlaying ? 'Pause' : 'Play timeline'}
              >
                {isPlaying ? (
                  <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
                    <path d="M6 4h4v16H6V4zm8 0h4v16h-4V4z" />
                  </svg>
                ) : (
                  <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
                    <path d="M8 5v14l11-7z" />
                  </svg>
                )}
              </button>
              
              {/* Reset button */}
              <button
                onClick={() => {
                  setTimelineIndex(null)
                  setIsPlaying(false)
                }}
                className={`p-2 rounded-lg transition-colors ${
                  timelineIndex === null
                    ? 'bg-gray-700 text-gray-500 cursor-not-allowed'
                    : 'bg-gray-800 hover:bg-gray-700 text-white'
                }`}
                disabled={timelineIndex === null}
                title="Show all thoughts"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                </svg>
              </button>
              
              {/* Timeline slider */}
              <div className="flex-1 relative">
                <input
                  type="range"
                  min={0}
                  max={sortedCommits.length - 1}
                  value={timelineIndex ?? sortedCommits.length - 1}
                  onChange={(e) => {
                    setTimelineIndex(parseInt(e.target.value))
                    setIsPlaying(false)
                  }}
                  className="w-full h-2 bg-gray-700 rounded-lg appearance-none cursor-pointer accent-purple-500"
                />
                
                {/* Commit markers */}
                <div className="absolute top-4 left-0 right-0 flex justify-between pointer-events-none">
                  {sortedCommits.length <= 10 && sortedCommits.map((commit, i) => (
                    <div
                      key={commit.hash}
                      className={`w-2 h-2 rounded-full ${
                        timelineIndex !== null && i <= timelineIndex
                          ? 'bg-purple-500'
                          : 'bg-gray-600'
                      }`}
                      style={{ marginLeft: i === 0 ? '0' : 'auto', marginRight: i === sortedCommits.length - 1 ? '0' : 'auto' }}
                    />
                  ))}
                </div>
              </div>
              
              {/* Current commit info */}
              <div className="text-right min-w-[200px]">
                {timelineIndex !== null && sortedCommits[timelineIndex] ? (
                  <>
                    <div className="text-xs font-mono text-purple-400">
                      {sortedCommits[timelineIndex].hash.slice(0, 8)}
                    </div>
                    <div className="text-xs text-gray-400 truncate max-w-[200px]">
                      {sortedCommits[timelineIndex].message || 'No message'}
                    </div>
                    <div className="text-xs text-gray-500">
                      {new Date(sortedCommits[timelineIndex].timestamp).toLocaleDateString()}
                    </div>
                  </>
                ) : (
                  <div className="text-xs text-gray-400">
                    All {sortedCommits.length} commits
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Focus mode indicator */}
      {focusedIds && (
        <div className="absolute top-20 right-4 z-10 bg-purple-900/80 border border-purple-700 rounded-lg px-3 py-2 text-sm">
          <span className="text-purple-300">Focused view: </span>
          <span className="text-white">{focusedIds.size} thoughts</span>
          <Link
            to={`/bases/${id}/viz`}
            className="ml-2 text-purple-400 hover:text-purple-300"
          >
            Clear
          </Link>
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
