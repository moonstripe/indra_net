import { useState, useEffect, useRef, useCallback, useMemo } from 'react'
import { useParams, useSearchParams, Link } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'
import { VectorRenderer, type VectorRendererHandle } from 'react-vector-renderer'
import { apiFetch } from '../lib/api'
import { Frown, Orbit, Download, Copy, Check } from 'lucide-react'

interface VizThought {
  id: string
  content: string
  thought_type?: string
  position: [number, number, number]
  has_embedding: boolean
  created_at: number
  branches?: string[]
}

interface VizCommit {
  hash: string
  message: string
  author: string
  timestamp: number
  parents: string[]
}

interface VizEdge {
  source: string
  target: string
  edge_type: string
  weight: number
  directed: boolean
}

interface VizMeta {
  total_thoughts: number
  embedded_thoughts: number
  total_edges?: number
  reduction_method: string
  original_dim: number
  variance_explained?: [number, number, number]
  embedder_model?: string
}

interface VizBranch {
  name: string
  hash: string
  current: boolean
}

interface VizCluster {
  assignments: Record<string, number> // thought_id -> cluster_index
  centroids: number[][] // [x, y, z] for each cluster
  sizes: number[] // number of thoughts in each cluster
  labels: string[] // label for each cluster (from representative thought)
  k: number // number of clusters
}

interface VizExport {
  thoughts: VizThought[]
  edges?: VizEdge[]
  commits?: VizCommit[]
  branches?: VizBranch[]
  clusters?: VizCluster | null
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
  const [baseVisibility, setBaseVisibility] = useState<'public' | 'private'>('private')
  const [canEdit, setCanEdit] = useState(false)
  const [copyFeedback, setCopyFeedback] = useState(false)
  
  // Timeline state
  const [timelineIndex, setTimelineIndex] = useState<number | null>(null) // null = show all
  const [isPlaying, setIsPlaying] = useState(false)
  
  // Branch filter state
  const [selectedBranch, setSelectedBranch] = useState<string | null>(null) // null = show all branches
  
  // Cluster filter state
  const [selectedCluster, setSelectedCluster] = useState<number | null>(null) // null = show all clusters
  const [showClusterLabels, setShowClusterLabels] = useState(true)
  
  const rendererRef = useRef<VectorRendererHandle>(null)
  // Map from renderer embedding ID to thought
  const thoughtMapRef = useRef<Map<string, VizThought>>(new Map())
  // Track edge IDs for cleanup
  const edgeIdsRef = useRef<Set<string>>(new Set())
  
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
  
  // Get unique branches from the data
  const availableBranches = useMemo(() => {
    if (!vizData?.branches) return []
    return vizData.branches
  }, [vizData?.branches])
  
  // Initialize branch from URL params
  useEffect(() => {
    const branchParam = searchParams.get('branch')
    if (branchParam && availableBranches.some(b => b.name === branchParam)) {
      setSelectedBranch(branchParam)
    }
  }, [searchParams, availableBranches])
  
  // Initialize timeline from URL params
  useEffect(() => {
    const commitParam = searchParams.get('commit')
    if (commitParam && sortedCommits.length > 0) {
      const idx = parseInt(commitParam)
      if (!isNaN(idx) && idx >= 0 && idx < sortedCommits.length) {
        setTimelineIndex(idx)
      }
    }
  }, [searchParams, sortedCommits])
  
  // Branch color map - consistent colors for branches
  const branchColors = useMemo(() => {
    const colors: Record<string, string> = {}
    const palette = [
      '#8b5cf6', // purple (main)
      '#10b981', // emerald
      '#f59e0b', // amber
      '#ef4444', // red
      '#3b82f6', // blue
      '#ec4899', // pink
      '#14b8a6', // teal
      '#f97316', // orange
    ]
    availableBranches.forEach((branch, i) => {
      colors[branch.name] = palette[i % palette.length]
    })
    return colors
  }, [availableBranches])
  
  // Cluster color map
  const clusterColors = useMemo(() => {
    if (!vizData?.clusters) return {}
    const colors: Record<number, string> = {}
    const palette = [
      '#06b6d4', // cyan
      '#84cc16', // lime
      '#f43f5e', // rose
      '#a855f7', // purple
      '#22c55e', // green
      '#eab308', // yellow
      '#6366f1', // indigo
      '#f97316', // orange
      '#14b8a6', // teal
      '#ec4899', // pink
    ]
    for (let i = 0; i < vizData.clusters.k; i++) {
      colors[i] = palette[i % palette.length]
    }
    return colors
  }, [vizData?.clusters])
  
  // Filter thoughts based on timeline position, branch filter, and cluster filter
  const filteredThoughts = useMemo(() => {
    if (!vizData?.thoughts) return []
    
    let thoughts = vizData.thoughts
    
    // If focused IDs are provided, only show those
    if (focusedIds) {
      thoughts = thoughts.filter(t => focusedIds.has(t.id))
    }
    
    // Filter by selected branch
    if (selectedBranch) {
      thoughts = thoughts.filter(t => t.branches?.includes(selectedBranch))
    }
    
    // Filter by selected cluster
    if (selectedCluster !== null && vizData.clusters) {
      thoughts = thoughts.filter(t => vizData.clusters?.assignments[t.id] === selectedCluster)
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
  }, [vizData?.thoughts, vizData?.clusters, focusedIds, selectedBranch, selectedCluster, timelineIndex, sortedCommits])

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
      
      // Delete existing edges
      for (const edgeId of edgeIdsRef.current) {
        try {
          rendererRef.current.deleteEdge(edgeId)
        } catch (e) {
          // Edge might not exist
        }
      }
      edgeIdsRef.current.clear()
      
      // Build a map from thought ID to position for edge rendering
      const thoughtPositions = new Map<string, [number, number, number]>()
      
      for (const thought of filteredThoughts) {
        if (thought.has_embedding) {
          try {
            const embId = rendererRef.current.addEmbedding(
              thought.position[0],
              thought.position[1],
              thought.position[2]
            )
            thoughtMapRef.current.set(embId, thought)
            thoughtPositions.set(thought.id, thought.position)
          } catch (e) {
            console.error('Failed to add embedding:', e)
          }
        }
      }
      
      // Add edges if we have edge data
      if (vizData?.edges && vizData.edges.length > 0) {
        for (const edge of vizData.edges) {
          const fromPos = thoughtPositions.get(edge.source)
          const toPos = thoughtPositions.get(edge.target)
          
          // Only render edge if both endpoints are visible
          if (fromPos && toPos) {
            try {
              const edgeId = rendererRef.current.addEdge(
                fromPos[0], fromPos[1], fromPos[2],
                toPos[0], toPos[1], toPos[2]
              )
              edgeIdsRef.current.add(edgeId)
            } catch (e) {
              console.error('Failed to add edge:', e)
            }
          }
        }
      }
    }
  }, [rendererReady, filteredThoughts, vizData?.edges])
  
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
      setBaseVisibility(baseData.base.visibility)
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

  // Screenshot function - captures the canvas by re-rendering to a temp canvas
  const handleScreenshot = useCallback(() => {
    // WebGL canvases lose their content after each frame unless preserveDrawingBuffer is enabled
    // Since we can't change that, we'll capture via html2canvas or use a workaround
    // For now, we'll try to get the canvas directly and warn if empty
    const canvas = document.querySelector('canvas') as HTMLCanvasElement
    if (!canvas) {
      console.error('Canvas not found')
      return
    }
    
    // Try to get the data URL
    try {
      const dataUrl = canvas.toDataURL('image/png')
      
      // Check if the canvas is blank (all transparent) - this happens with WebGL
      // If so, we need to use a different approach
      if (dataUrl === 'data:,' || dataUrl.length < 1000) {
        // Canvas might be blank due to WebGL context loss
        // For now, show an alert - in future could implement requestAnimationFrame capture
        alert('Screenshot capture failed. Try using your browser\'s built-in screenshot tool (Cmd+Shift+4 on Mac, Win+Shift+S on Windows).')
        return
      }
      
      // Create a link and trigger download
      const link = document.createElement('a')
      link.download = `${baseName || 'visualization'}-${Date.now()}.png`
      link.href = dataUrl
      link.click()
    } catch (e) {
      console.error('Failed to capture screenshot:', e)
      alert('Screenshot capture failed. Try using your browser\'s built-in screenshot tool.')
    }
  }, [baseName])

  // Copy shareable link to clipboard (only for public bases)
  const handleCopyLink = useCallback(() => {
    if (baseVisibility !== 'public') return
    
    // Build the full public URL
    const baseUrl = 'https://indradb.net'
    const path = `/bases/${id}/viz`
    const url = new URL(path, baseUrl)
    
    // Add current filters to URL
    if (selectedBranch) {
      url.searchParams.set('branch', selectedBranch)
    }
    if (timelineIndex !== null) {
      url.searchParams.set('commit', timelineIndex.toString())
    }
    
    navigator.clipboard.writeText(url.toString())
    setCopyFeedback(true)
    setTimeout(() => setCopyFeedback(false), 2000)
  }, [id, baseVisibility, selectedBranch, timelineIndex])

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
          <Frown className="w-16 h-16 mx-auto mb-4 text-gray-500" />
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
          
          <div className="flex items-center gap-4">
            <span className="text-sm text-gray-400">
              {filteredThoughts.filter(t => t.has_embedding).length} of {vizData?.meta.embedded_thoughts || 0} thoughts • {vizData?.meta.reduction_method || 'none'}
            </span>
            
            {/* Export buttons */}
            <div className="flex items-center gap-2">
              <button
                onClick={handleScreenshot}
                className="p-2 rounded-lg bg-gray-800 hover:bg-gray-700 transition-colors text-gray-400 hover:text-white"
                title="Download screenshot (use browser screenshot for best results)"
              >
                <Download className="w-4 h-4" />
              </button>
              {baseVisibility === 'public' && (
                <button
                  onClick={handleCopyLink}
                  className="p-2 rounded-lg bg-gray-800 hover:bg-gray-700 transition-colors text-gray-400 hover:text-white"
                  title="Copy shareable link"
                >
                  {copyFeedback ? <Check className="w-4 h-4 text-green-400" /> : <Copy className="w-4 h-4" />}
                </button>
              )}
            </div>
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
              <Orbit className="w-16 h-16 mx-auto mb-4 text-purple-400" />
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
          <div className="flex items-center flex-wrap gap-2 mt-3 pt-3 border-t border-gray-800">
            {selectedThought.thought_type && (
              <span className="text-xs bg-purple-900/50 text-purple-400 px-2 py-1 rounded">
                {selectedThought.thought_type}
              </span>
            )}
            {selectedThought.branches && selectedThought.branches.map(branch => (
              <span 
                key={branch}
                className="text-xs px-2 py-1 rounded"
                style={{ 
                  backgroundColor: `${branchColors[branch]}20`,
                  color: branchColors[branch],
                  border: `1px solid ${branchColors[branch]}40`
                }}
              >
                {branch}
              </span>
            ))}
            {vizData?.clusters && selectedThought && vizData.clusters.assignments[selectedThought.id] !== undefined && (
              <span 
                className="text-xs px-2 py-1 rounded"
                style={{ 
                  backgroundColor: `${clusterColors[vizData.clusters.assignments[selectedThought.id]]}20`,
                  color: clusterColors[vizData.clusters.assignments[selectedThought.id]],
                  border: `1px solid ${clusterColors[vizData.clusters.assignments[selectedThought.id]]}40`
                }}
              >
                Cluster {vizData.clusters.assignments[selectedThought.id] + 1}
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

      {/* Branch filter legend */}
      {availableBranches.length > 1 && vizData && vizData.thoughts.length > 0 && (
        <div className="absolute top-20 left-4 z-10 bg-gray-900/90 border border-gray-800 rounded-lg p-3 backdrop-blur">
          <div className="text-xs text-gray-400 mb-2 font-medium">Branches</div>
          <div className="flex flex-col gap-1">
            <button
              onClick={() => setSelectedBranch(null)}
              className={`flex items-center gap-2 px-2 py-1 rounded text-xs text-left transition-colors ${
                selectedBranch === null
                  ? 'bg-gray-700 text-white'
                  : 'text-gray-400 hover:text-white hover:bg-gray-800'
              }`}
            >
              <span className="w-3 h-3 rounded-full bg-gradient-to-r from-purple-500 via-emerald-500 to-amber-500" />
              All branches
            </button>
            {availableBranches.map(branch => {
              const count = vizData.thoughts.filter(t => t.branches?.includes(branch.name)).length
              return (
                <button
                  key={branch.name}
                  onClick={() => setSelectedBranch(selectedBranch === branch.name ? null : branch.name)}
                  className={`flex items-center gap-2 px-2 py-1 rounded text-xs text-left transition-colors ${
                    selectedBranch === branch.name
                      ? 'bg-gray-700 text-white'
                      : 'text-gray-400 hover:text-white hover:bg-gray-800'
                  }`}
                >
                  <span 
                    className="w-3 h-3 rounded-full" 
                    style={{ backgroundColor: branchColors[branch.name] }}
                  />
                  <span className="flex-1">{branch.name}</span>
                  <span className="text-gray-500">{count}</span>
                  {branch.current && (
                    <span className="text-[10px] text-purple-400">HEAD</span>
                  )}
                </button>
              )
            })}
          </div>
        </div>
      )}

      {/* Cluster filter panel */}
      {vizData?.clusters && vizData.clusters.k > 1 && vizData.thoughts.length > 0 && (
        <div className={`absolute z-10 bg-gray-900/90 border border-gray-800 rounded-lg p-3 backdrop-blur ${
          availableBranches.length > 1 ? 'top-20 left-48' : 'top-20 left-4'
        }`}>
          <div className="flex items-center justify-between mb-2">
            <div className="text-xs text-gray-400 font-medium">Clusters</div>
            <button
              onClick={() => setShowClusterLabels(!showClusterLabels)}
              className={`text-[10px] px-1.5 py-0.5 rounded ${
                showClusterLabels ? 'bg-purple-600 text-white' : 'bg-gray-700 text-gray-400'
              }`}
            >
              Labels
            </button>
          </div>
          <div className="flex flex-col gap-1 max-h-48 overflow-y-auto">
            <button
              onClick={() => setSelectedCluster(null)}
              className={`flex items-center gap-2 px-2 py-1 rounded text-xs text-left transition-colors ${
                selectedCluster === null
                  ? 'bg-gray-700 text-white'
                  : 'text-gray-400 hover:text-white hover:bg-gray-800'
              }`}
            >
              <span className="w-3 h-3 rounded-full bg-gradient-to-r from-cyan-500 via-lime-500 to-rose-500" />
              All clusters
            </button>
            {vizData.clusters && Array.from({ length: vizData.clusters.k }, (_, i) => {
              const clusters = vizData.clusters!
              return (
                <button
                  key={i}
                  onClick={() => setSelectedCluster(selectedCluster === i ? null : i)}
                  className={`flex items-center gap-2 px-2 py-1 rounded text-xs text-left transition-colors ${
                    selectedCluster === i
                      ? 'bg-gray-700 text-white'
                      : 'text-gray-400 hover:text-white hover:bg-gray-800'
                  }`}
                >
                  <span 
                    className="w-3 h-3 rounded-full flex-shrink-0" 
                    style={{ backgroundColor: clusterColors[i] }}
                  />
                  <span className="flex-1 truncate max-w-[120px]" title={clusters.labels[i]}>
                    {showClusterLabels ? clusters.labels[i] : `Cluster ${i + 1}`}
                  </span>
                  <span className="text-gray-500 flex-shrink-0">{clusters.sizes[i]}</span>
                </button>
              )
            })}
          </div>
        </div>
      )}

      {/* Instructions overlay - shown briefly */}
      {rendererReady && vizData && vizData.thoughts.length > 0 && !selectedThought && (
        <div className="absolute bottom-4 left-1/2 -translate-x-1/2 z-10 text-gray-500 text-sm pointer-events-none animate-pulse hidden md:block">
          Click a point to see its content • Drag to rotate • Scroll to zoom
        </div>
      )}
      {rendererReady && vizData && vizData.thoughts.length > 0 && !selectedThought && (
        <div className="absolute bottom-4 left-1/2 -translate-x-1/2 z-10 text-gray-500 text-sm pointer-events-none animate-pulse md:hidden">
          Tap a point to see its content • Drag to rotate • Pinch to zoom
        </div>
      )}
    </div>
  )
}
