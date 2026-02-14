/**
 * Analytics computation for IndraNet bases
 * 
 * Computes various insights from visualization data:
 * - Thought growth over time
 * - Cluster distribution
 * - Activity patterns
 * - Embedding quality metrics
 * - Semantic diversity
 * - Connection analysis
 */

interface VizThought {
  id: string
  content: string
  thought_type?: string
  position: [number, number, number]
  has_embedding: boolean
  created_at: number
  branches?: string[]
}

interface VizEdge {
  source: string
  target: string
  edge_type: string
  weight: number
  directed: boolean
}

interface VizCommit {
  hash: string
  message: string
  author: string
  timestamp: number
  parents: string[]
}

interface VizCluster {
  assignments: Record<string, number>
  centroids: number[][]
  sizes: number[]
  labels: string[]
  k: number
}

interface VizData {
  thoughts: VizThought[]
  edges?: VizEdge[]
  commits?: VizCommit[]
  branches?: Array<{ name: string; hash: string; current: boolean }>
  clusters?: VizCluster | null
  meta: {
    total_thoughts: number
    embedded_thoughts: number
    total_edges?: number
    reduction_method: string
    original_dim: number
    variance_explained?: [number, number, number]
    embedder_model?: string
  }
}

export interface Analytics {
  // Thought growth over time (daily counts)
  growth: {
    daily: Array<{ date: string; count: number; cumulative: number }>
    weekly: Array<{ week: string; count: number }>
    totalDays: number
    avgPerDay: number
  }
  
  // Cluster distribution
  clusters: {
    distribution: Array<{ 
      id: number
      label: string
      count: number
      percentage: number
    }>
    dominantCluster: { id: number; label: string; percentage: number } | null
  } | null
  
  // Activity heatmap data (hour of day x day of week)
  activity: {
    heatmap: number[][] // 7 rows (days) x 24 cols (hours)
    peakHour: number
    peakDay: number
    totalEvents: number
  }
  
  // Branch analysis
  branches: {
    count: number
    current: string
    comparison: Array<{
      name: string
      thoughtCount: number
      percentage: number
    }>
  } | null
  
  // Embedding quality metrics
  embeddings: {
    coverage: number // % of thoughts with embeddings
    model: string | null
    dimensions: number
    varianceExplained: number // sum of variance explained by PCA
  }
  
  // Connection/edge analysis
  connections: {
    totalEdges: number
    avgConnectionsPerThought: number
    mostConnected: Array<{
      id: string
      content: string
      connectionCount: number
    }>
    edgeTypeDistribution: Array<{
      type: string
      count: number
      percentage: number
    }>
  }
  
  // Semantic diversity (how spread out are thoughts in embedding space)
  diversity: {
    score: number // 0-1, higher = more diverse
    spreadX: number
    spreadY: number
    spreadZ: number
    centroid: [number, number, number]
  }
  
  // Summary stats
  summary: {
    totalThoughts: number
    embeddedThoughts: number
    totalCommits: number
    totalBranches: number
    ageInDays: number
    lastActivity: string
  }
}

/**
 * Compute analytics from visualization data
 * Returns null if fewer than 10 thoughts (threshold for meaningful analytics)
 */
export function computeAnalytics(vizData: VizData): Analytics | null {
  const MIN_THOUGHTS = 10
  
  if (vizData.thoughts.length < MIN_THOUGHTS) {
    return null
  }
  
  const thoughts = vizData.thoughts
  const edges = vizData.edges || []
  const commits = vizData.commits || []
  const clusters = vizData.clusters
  const branches = vizData.branches || []
  
  // --- Thought Growth ---
  const timestamps = thoughts.map(t => t.created_at).sort((a, b) => a - b)
  const dailyCounts = new Map<string, number>()
  
  for (const ts of timestamps) {
    const date = new Date(ts).toISOString().split('T')[0]
    dailyCounts.set(date, (dailyCounts.get(date) || 0) + 1)
  }
  
  // Fill in missing days
  const firstDate = new Date(timestamps[0])
  const lastDate = new Date(timestamps[timestamps.length - 1])
  const totalDays = Math.max(1, Math.ceil((lastDate.getTime() - firstDate.getTime()) / 86400000) + 1)
  
  let cumulative = 0
  const daily: Analytics['growth']['daily'] = []
  const weeklyMap = new Map<string, number>()
  
  for (let d = new Date(firstDate); d <= lastDate; d.setDate(d.getDate() + 1)) {
    const dateStr = d.toISOString().split('T')[0]
    const count = dailyCounts.get(dateStr) || 0
    cumulative += count
    daily.push({ date: dateStr, count, cumulative })
    
    // Week aggregation (ISO week)
    const week = getISOWeek(d)
    weeklyMap.set(week, (weeklyMap.get(week) || 0) + count)
  }
  
  const weekly = Array.from(weeklyMap.entries())
    .map(([week, count]) => ({ week, count }))
    .sort((a, b) => a.week.localeCompare(b.week))
  
  const growth: Analytics['growth'] = {
    daily,
    weekly,
    totalDays,
    avgPerDay: thoughts.length / totalDays,
  }
  
  // --- Cluster Distribution ---
  let clusterAnalytics: Analytics['clusters'] = null
  if (clusters && clusters.k > 1) {
    const distribution = clusters.sizes.map((size, i) => ({
      id: i,
      label: clusters.labels[i] || `Cluster ${i + 1}`,
      count: size,
      percentage: (size / thoughts.length) * 100,
    })).sort((a, b) => b.count - a.count)
    
    const dominant = distribution[0]
    clusterAnalytics = {
      distribution,
      dominantCluster: dominant ? {
        id: dominant.id,
        label: dominant.label,
        percentage: dominant.percentage,
      } : null,
    }
  }
  
  // --- Activity Heatmap ---
  const heatmap: number[][] = Array(7).fill(0).map(() => Array(24).fill(0))
  const allTimestamps = [
    ...thoughts.map(t => t.created_at),
    ...commits.map(c => c.timestamp),
  ]
  
  for (const ts of allTimestamps) {
    const d = new Date(ts)
    const day = d.getDay() // 0-6
    const hour = d.getHours() // 0-23
    heatmap[day][hour]++
  }
  
  // Find peak
  let peakHour = 0, peakDay = 0, peakCount = 0
  for (let day = 0; day < 7; day++) {
    for (let hour = 0; hour < 24; hour++) {
      if (heatmap[day][hour] > peakCount) {
        peakCount = heatmap[day][hour]
        peakHour = hour
        peakDay = day
      }
    }
  }
  
  const activity: Analytics['activity'] = {
    heatmap,
    peakHour,
    peakDay,
    totalEvents: allTimestamps.length,
  }
  
  // --- Branch Analysis ---
  let branchAnalytics: Analytics['branches'] = null
  if (branches.length > 0) {
    const branchThoughtCounts = new Map<string, number>()
    
    for (const thought of thoughts) {
      const thoughtBranches = thought.branches || ['main']
      for (const branch of thoughtBranches) {
        branchThoughtCounts.set(branch, (branchThoughtCounts.get(branch) || 0) + 1)
      }
    }
    
    const comparison = branches.map(b => ({
      name: b.name,
      thoughtCount: branchThoughtCounts.get(b.name) || 0,
      percentage: ((branchThoughtCounts.get(b.name) || 0) / thoughts.length) * 100,
    })).sort((a, b) => b.thoughtCount - a.thoughtCount)
    
    branchAnalytics = {
      count: branches.length,
      current: branches.find(b => b.current)?.name || 'main',
      comparison,
    }
  }
  
  // --- Embedding Quality ---
  const embeddedCount = thoughts.filter(t => t.has_embedding).length
  const varianceSum = vizData.meta.variance_explained 
    ? vizData.meta.variance_explained.reduce((a, b) => a + b, 0)
    : 0
  
  const embeddingMetrics: Analytics['embeddings'] = {
    coverage: (embeddedCount / thoughts.length) * 100,
    model: vizData.meta.embedder_model || null,
    dimensions: vizData.meta.original_dim,
    varianceExplained: varianceSum * 100, // Convert to percentage
  }
  
  // --- Connection Analysis ---
  const connectionCounts = new Map<string, number>()
  const edgeTypeCounts = new Map<string, number>()
  
  for (const edge of edges) {
    connectionCounts.set(edge.source, (connectionCounts.get(edge.source) || 0) + 1)
    connectionCounts.set(edge.target, (connectionCounts.get(edge.target) || 0) + 1)
    edgeTypeCounts.set(edge.edge_type, (edgeTypeCounts.get(edge.edge_type) || 0) + 1)
  }
  
  const mostConnected = Array.from(connectionCounts.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .map(([id, count]) => {
      const thought = thoughts.find(t => t.id === id)
      return {
        id,
        content: thought?.content.slice(0, 100) || 'Unknown',
        connectionCount: count,
      }
    })
  
  const edgeTypeDistribution = Array.from(edgeTypeCounts.entries())
    .map(([type, count]) => ({
      type,
      count,
      percentage: (count / edges.length) * 100,
    }))
    .sort((a, b) => b.count - a.count)
  
  const connectionAnalytics: Analytics['connections'] = {
    totalEdges: edges.length,
    avgConnectionsPerThought: thoughts.length > 0 ? (edges.length * 2) / thoughts.length : 0,
    mostConnected,
    edgeTypeDistribution,
  }
  
  // --- Semantic Diversity ---
  const embeddedThoughts = thoughts.filter(t => t.has_embedding)
  let diversity: Analytics['diversity']
  
  if (embeddedThoughts.length > 0) {
    const positions = embeddedThoughts.map(t => t.position)
    
    // Compute centroid
    const centroid: [number, number, number] = [
      positions.reduce((sum, p) => sum + p[0], 0) / positions.length,
      positions.reduce((sum, p) => sum + p[1], 0) / positions.length,
      positions.reduce((sum, p) => sum + p[2], 0) / positions.length,
    ]
    
    // Compute spread (standard deviation) in each dimension
    const spreadX = Math.sqrt(positions.reduce((sum, p) => sum + Math.pow(p[0] - centroid[0], 2), 0) / positions.length)
    const spreadY = Math.sqrt(positions.reduce((sum, p) => sum + Math.pow(p[1] - centroid[1], 2), 0) / positions.length)
    const spreadZ = Math.sqrt(positions.reduce((sum, p) => sum + Math.pow(p[2] - centroid[2], 2), 0) / positions.length)
    
    // Overall diversity score: normalized average spread
    // Higher spread = more diverse thoughts
    const avgSpread = (spreadX + spreadY + spreadZ) / 3
    // Normalize to 0-1 range (assuming PCA normalizes to roughly 0-1)
    const score = Math.min(1, avgSpread * 2)
    
    diversity = {
      score,
      spreadX,
      spreadY,
      spreadZ,
      centroid,
    }
  } else {
    diversity = {
      score: 0,
      spreadX: 0,
      spreadY: 0,
      spreadZ: 0,
      centroid: [0.5, 0.5, 0.5],
    }
  }
  
  // --- Summary ---
  const sortedTimestamps = allTimestamps.sort((a, b) => b - a)
  const lastActivity = sortedTimestamps[0] ? new Date(sortedTimestamps[0]).toISOString() : new Date().toISOString()
  
  const summary: Analytics['summary'] = {
    totalThoughts: thoughts.length,
    embeddedThoughts: embeddedCount,
    totalCommits: commits.length,
    totalBranches: branches.length,
    ageInDays: totalDays,
    lastActivity,
  }
  
  return {
    growth,
    clusters: clusterAnalytics,
    activity,
    branches: branchAnalytics,
    embeddings: embeddingMetrics,
    connections: connectionAnalytics,
    diversity,
    summary,
  }
}

/**
 * Get ISO week string (YYYY-Www)
 */
function getISOWeek(date: Date): string {
  const d = new Date(date)
  d.setHours(0, 0, 0, 0)
  d.setDate(d.getDate() + 4 - (d.getDay() || 7))
  const yearStart = new Date(d.getFullYear(), 0, 1)
  const weekNum = Math.ceil((((d.getTime() - yearStart.getTime()) / 86400000) + 1) / 7)
  return `${d.getFullYear()}-W${weekNum.toString().padStart(2, '0')}`
}
