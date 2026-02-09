/**
 * Clustering algorithms for semantic grouping of thoughts
 * 
 * Provides k-means clustering on 3D positions (after PCA reduction).
 * Results include cluster assignments and centroids for visualization.
 */

export interface ClusterResult {
  /** Cluster index for each point (0 to k-1) */
  assignments: number[];
  /** Centroid positions for each cluster */
  centroids: number[][];
  /** Number of points in each cluster */
  sizes: number[];
  /** Inertia (sum of squared distances to centroids) */
  inertia: number;
}

/**
 * K-means clustering on 3D positions
 * 
 * @param positions Array of [x, y, z] positions (already normalized to [0,1])
 * @param k Number of clusters (if not provided, uses heuristic)
 * @param maxIter Maximum iterations
 * @param seed Random seed for reproducibility
 */
export function kmeans(
  positions: number[][],
  k?: number,
  maxIter: number = 50,
  seed: number = 42
): ClusterResult {
  const n = positions.length;
  
  if (n === 0) {
    return { assignments: [], centroids: [], sizes: [], inertia: 0 };
  }
  
  // Auto-determine k if not provided (rule of thumb: sqrt(n/2), capped)
  const numClusters = k ?? Math.min(Math.max(2, Math.floor(Math.sqrt(n / 2))), 10);
  
  if (n <= numClusters) {
    // Each point is its own cluster
    return {
      assignments: positions.map((_, i) => i),
      centroids: positions.map(p => [...p]),
      sizes: new Array(n).fill(1),
      inertia: 0,
    };
  }
  
  // Initialize centroids using k-means++ for better convergence
  let centroids = kmeansppInit(positions, numClusters, seed);
  let assignments = new Array(n).fill(0);
  let prevInertia = Infinity;
  
  for (let iter = 0; iter < maxIter; iter++) {
    // Assignment step: assign each point to nearest centroid
    assignments = positions.map(pos => {
      let minDist = Infinity;
      let minIdx = 0;
      for (let c = 0; c < numClusters; c++) {
        const dist = squaredDistance(pos, centroids[c]);
        if (dist < minDist) {
          minDist = dist;
          minIdx = c;
        }
      }
      return minIdx;
    });
    
    // Update step: recompute centroids
    const newCentroids = Array.from({ length: numClusters }, () => [0, 0, 0]);
    const counts = new Array(numClusters).fill(0);
    
    for (let i = 0; i < n; i++) {
      const cluster = assignments[i];
      counts[cluster]++;
      for (let d = 0; d < 3; d++) {
        newCentroids[cluster][d] += positions[i][d];
      }
    }
    
    // Normalize centroids
    for (let c = 0; c < numClusters; c++) {
      if (counts[c] > 0) {
        for (let d = 0; d < 3; d++) {
          newCentroids[c][d] /= counts[c];
        }
      } else {
        // Empty cluster: reinitialize randomly
        const randomIdx = Math.floor(seededRandom(seed + iter + c) * n);
        newCentroids[c] = [...positions[randomIdx]];
      }
    }
    
    // Compute inertia (sum of squared distances)
    let inertia = 0;
    for (let i = 0; i < n; i++) {
      inertia += squaredDistance(positions[i], newCentroids[assignments[i]]);
    }
    
    // Check convergence
    if (Math.abs(prevInertia - inertia) < 1e-6) {
      centroids = newCentroids;
      break;
    }
    
    prevInertia = inertia;
    centroids = newCentroids;
  }
  
  // Compute final sizes
  const sizes = new Array(numClusters).fill(0);
  for (const a of assignments) {
    sizes[a]++;
  }
  
  // Final inertia
  let inertia = 0;
  for (let i = 0; i < n; i++) {
    inertia += squaredDistance(positions[i], centroids[assignments[i]]);
  }
  
  return { assignments, centroids, sizes, inertia };
}

/**
 * K-means++ initialization for better starting centroids
 */
function kmeansppInit(positions: number[][], k: number, seed: number): number[][] {
  const n = positions.length;
  const centroids: number[][] = [];
  
  // Pick first centroid randomly
  const firstIdx = Math.floor(seededRandom(seed) * n);
  centroids.push([...positions[firstIdx]]);
  
  // Pick remaining centroids with probability proportional to squared distance
  for (let c = 1; c < k; c++) {
    const distances = positions.map(pos => {
      let minDist = Infinity;
      for (const centroid of centroids) {
        minDist = Math.min(minDist, squaredDistance(pos, centroid));
      }
      return minDist;
    });
    
    // Compute cumulative distribution
    const totalDist = distances.reduce((a, b) => a + b, 0);
    if (totalDist === 0) {
      // All points are at centroid positions, pick randomly
      const idx = Math.floor(seededRandom(seed + c) * n);
      centroids.push([...positions[idx]]);
      continue;
    }
    
    const cumulative = distances.map((d, i) => 
      distances.slice(0, i + 1).reduce((a, b) => a + b, 0) / totalDist
    );
    
    // Sample from distribution
    const r = seededRandom(seed + c);
    let idx = 0;
    for (let i = 0; i < n; i++) {
      if (r <= cumulative[i]) {
        idx = i;
        break;
      }
    }
    
    centroids.push([...positions[idx]]);
  }
  
  return centroids;
}

/**
 * Squared Euclidean distance between two 3D points
 */
function squaredDistance(a: number[], b: number[]): number {
  let sum = 0;
  for (let i = 0; i < 3; i++) {
    const diff = a[i] - b[i];
    sum += diff * diff;
  }
  return sum;
}

/**
 * Simple seeded random number generator (LCG)
 */
function seededRandom(seed: number): number {
  const x = Math.sin(seed) * 10000;
  return x - Math.floor(x);
}

/**
 * Find representative thought for each cluster (closest to centroid)
 */
export function findClusterRepresentatives(
  positions: number[][],
  assignments: number[],
  centroids: number[][]
): number[] {
  const k = centroids.length;
  const representatives = new Array(k).fill(-1);
  const minDistances = new Array(k).fill(Infinity);
  
  for (let i = 0; i < positions.length; i++) {
    const cluster = assignments[i];
    const dist = squaredDistance(positions[i], centroids[cluster]);
    if (dist < minDistances[cluster]) {
      minDistances[cluster] = dist;
      representatives[cluster] = i;
    }
  }
  
  return representatives;
}
