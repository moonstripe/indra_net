/**
 * PCA (Principal Component Analysis) for dimensionality reduction
 * 
 * This is a lightweight TypeScript implementation for reducing high-dimensional
 * embedding vectors to 3D coordinates for visualization.
 * 
 * Algorithm:
 * 1. Center the data (subtract mean)
 * 2. Compute covariance matrix
 * 3. Find eigenvectors using power iteration
 * 4. Project data onto top 3 eigenvectors
 */

export interface PCAResult {
  positions: number[][]; // Array of [x, y, z] for each input point
  varianceExplained: [number, number, number];
  mean: number[];
}

/**
 * Perform PCA to reduce N-dimensional embeddings to 3D positions
 */
export function pca3d(embeddings: number[][]): PCAResult {
  if (embeddings.length === 0) {
    return { positions: [], varianceExplained: [0, 0, 0], mean: [] };
  }
  
  const n = embeddings.length;
  const d = embeddings[0].length;
  
  // Handle edge cases
  if (n < 4) {
    // Too few samples - use simple circular layout
    return simpleLayout(embeddings);
  }
  
  // 1. Compute mean
  const mean = new Array(d).fill(0);
  for (const emb of embeddings) {
    for (let i = 0; i < d; i++) {
      mean[i] += emb[i];
    }
  }
  for (let i = 0; i < d; i++) {
    mean[i] /= n;
  }
  
  // 2. Center the data
  const centered = embeddings.map(emb => 
    emb.map((v, i) => v - mean[i])
  );
  
  // 3. Compute covariance matrix (d x d)
  // For efficiency, we compute X^T * X / (n-1) where X is the centered data matrix
  const cov = computeCovariance(centered, d);
  
  // 4. Find top 3 eigenvectors using power iteration
  const eigenvectors: number[][] = [];
  const eigenvalues: number[] = [];
  let covCopy = cov.map(row => [...row]);
  
  for (let k = 0; k < Math.min(3, d); k++) {
    const { vector, value } = powerIteration(covCopy, d);
    eigenvectors.push(vector);
    eigenvalues.push(value);
    
    // Deflate: remove this eigenvector's contribution
    covCopy = deflate(covCopy, vector, value);
  }
  
  // 5. Project data onto eigenvectors
  const positions = centered.map(point => {
    const projected = [0, 0, 0];
    for (let k = 0; k < eigenvectors.length; k++) {
      projected[k] = dot(point, eigenvectors[k]);
    }
    // Pad with zeros if we have fewer than 3 components
    while (projected.length < 3) {
      projected.push(0);
    }
    return projected;
  });
  
  // 6. Normalize to [0, 1] range
  const normalized = normalizePositions(positions);
  
  // 7. Compute variance explained
  const totalVariance = eigenvalues.reduce((a, b) => a + Math.abs(b), 0) || 1;
  const varianceExplained: [number, number, number] = [
    eigenvalues[0] ? Math.abs(eigenvalues[0]) / totalVariance : 0,
    eigenvalues[1] ? Math.abs(eigenvalues[1]) / totalVariance : 0,
    eigenvalues[2] ? Math.abs(eigenvalues[2]) / totalVariance : 0,
  ];
  
  return { positions: normalized, varianceExplained, mean };
}

/**
 * Compute covariance matrix
 */
function computeCovariance(centered: number[][], d: number): number[][] {
  const n = centered.length;
  const cov: number[][] = Array.from({ length: d }, () => new Array(d).fill(0));
  
  for (const point of centered) {
    for (let i = 0; i < d; i++) {
      for (let j = i; j < d; j++) {
        cov[i][j] += point[i] * point[j];
      }
    }
  }
  
  // Normalize and fill symmetric part
  for (let i = 0; i < d; i++) {
    for (let j = i; j < d; j++) {
      cov[i][j] /= n - 1;
      cov[j][i] = cov[i][j];
    }
  }
  
  return cov;
}

/**
 * Power iteration to find dominant eigenvector
 */
function powerIteration(matrix: number[][], d: number, maxIter = 100, tol = 1e-10): { vector: number[]; value: number } {
  // Initialize with random vector
  let v = new Array(d).fill(0).map(() => Math.random() - 0.5);
  v = normalize(v);
  
  let eigenvalue = 0;
  
  for (let iter = 0; iter < maxIter; iter++) {
    // Multiply by matrix
    const av = matVecMul(matrix, v);
    
    // Compute eigenvalue estimate (Rayleigh quotient)
    const newEigenvalue = dot(v, av);
    
    // Normalize
    const norm = Math.sqrt(dot(av, av));
    if (norm < tol) break;
    
    const vNew = av.map(x => x / norm);
    
    // Check convergence
    const diff = Math.abs(newEigenvalue - eigenvalue);
    eigenvalue = newEigenvalue;
    v = vNew;
    
    if (diff < tol) break;
  }
  
  return { vector: v, value: eigenvalue };
}

/**
 * Deflate matrix by removing eigenvector contribution
 */
function deflate(matrix: number[][], eigenvector: number[], eigenvalue: number): number[][] {
  const d = matrix.length;
  const result = matrix.map(row => [...row]);
  
  for (let i = 0; i < d; i++) {
    for (let j = 0; j < d; j++) {
      result[i][j] -= eigenvalue * eigenvector[i] * eigenvector[j];
    }
  }
  
  return result;
}

/**
 * Matrix-vector multiplication
 */
function matVecMul(matrix: number[][], vector: number[]): number[] {
  const d = matrix.length;
  const result = new Array(d).fill(0);
  
  for (let i = 0; i < d; i++) {
    for (let j = 0; j < d; j++) {
      result[i] += matrix[i][j] * vector[j];
    }
  }
  
  return result;
}

/**
 * Dot product
 */
function dot(a: number[], b: number[]): number {
  let sum = 0;
  for (let i = 0; i < a.length; i++) {
    sum += a[i] * b[i];
  }
  return sum;
}

/**
 * Normalize vector to unit length
 */
function normalize(v: number[]): number[] {
  const norm = Math.sqrt(dot(v, v));
  return norm > 0 ? v.map(x => x / norm) : v;
}

/**
 * Normalize positions to [0, 1] range
 */
function normalizePositions(positions: number[][]): number[][] {
  if (positions.length === 0) return [];
  
  const mins = [Infinity, Infinity, Infinity];
  const maxs = [-Infinity, -Infinity, -Infinity];
  
  for (const pos of positions) {
    for (let i = 0; i < 3; i++) {
      mins[i] = Math.min(mins[i], pos[i]);
      maxs[i] = Math.max(maxs[i], pos[i]);
    }
  }
  
  const ranges = [
    maxs[0] - mins[0] || 1,
    maxs[1] - mins[1] || 1,
    maxs[2] - mins[2] || 1,
  ];
  
  return positions.map(pos => [
    (pos[0] - mins[0]) / ranges[0],
    (pos[1] - mins[1]) / ranges[1],
    (pos[2] - mins[2]) / ranges[2],
  ]);
}

/**
 * Simple circular layout for small datasets
 */
function simpleLayout(embeddings: number[][]): PCAResult {
  const n = embeddings.length;
  const positions = embeddings.map((_, i) => {
    const angle = (i * 2 * Math.PI) / n;
    return [
      0.5 + Math.cos(angle) * 0.25,
      0.5 + Math.sin(angle) * 0.25,
      0.5,
    ];
  });
  
  return {
    positions,
    varianceExplained: [0, 0, 0],
    mean: embeddings[0] || [],
  };
}
