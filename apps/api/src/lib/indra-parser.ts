/**
 * .indra file parser
 * 
 * Parses the binary .indra file format to extract thoughts and their embeddings.
 * This is used server-side by IndraNet to compute visualization without requiring
 * the CLI to pre-compute positions.
 * 
 * File format:
 * [HEADER: 64 bytes]
 *   - magic: 8 bytes ("INDRA_DB")
 *   - version: 4 bytes (u32 LE)
 *   - flags: 4 bytes
 *   - object_count: 8 bytes (u64 LE)
 *   - index_offset: 8 bytes (u64 LE)
 *   - refs_offset: 8 bytes (u64 LE)
 *   - refs_count: 8 bytes (u64 LE)
 *   - head_len: 2 bytes (u16 LE)
 *   - head_name: up to 14 bytes
 *   - reserved
 * 
 * [OBJECTS: variable]
 *   - Each object is zstd compressed with a type byte prefix
 * 
 * [INDEX: variable]
 *   - Each entry: 32 (hash) + 8 (offset) + 4 (size) = 44 bytes
 * 
 * [REFS: variable]
 *   - Each ref: 2 (name_len) + name + 32 (hash)
 */

import * as fzstd from 'fzstd';

const MAGIC = new TextEncoder().encode('INDRA_DB');
const HEADER_SIZE = 64;
const INDEX_ENTRY_SIZE = 44;

// Blob types match Rust enum
enum BlobType {
  Thought = 0,
  Edge = 1,
  Commit = 2,
  Tree = 3,
}

export interface ParsedThought {
  id: string;
  content: string;
  thoughtType?: string;
  embedding?: number[];
  embedderModel?: string;
  createdAt: number;
  modifiedAt: number;
}

export interface ParsedEdge {
  source: string;
  target: string;
  edgeType: string;
  weight: number;
  directed: boolean;
  createdAt: number;
}

export interface ParsedCommit {
  hash: string;
  tree: string;
  parents: string[];
  message: string;
  author: string;
  timestamp: number;
}

export interface ParsedIndraFile {
  version: number;
  thoughts: ParsedThought[];
  edges: ParsedEdge[];
  commits: ParsedCommit[];
  headRef: string;
  branches: Map<string, string>;
}

/**
 * Parse an .indra file from an ArrayBuffer
 */
export async function parseIndraFile(buffer: ArrayBuffer): Promise<ParsedIndraFile> {
  const data = new Uint8Array(buffer);
  const view = new DataView(buffer);
  
  // Validate magic
  const magic = data.slice(0, 8);
  if (!arraysEqual(magic, MAGIC)) {
    throw new Error('Invalid .indra file: bad magic bytes');
  }
  
  // Read header
  const version = view.getUint32(8, true);
  if (version !== 1) {
    throw new Error(`Unsupported .indra version: ${version}`);
  }
  
  const objectCount = Number(view.getBigUint64(16, true));
  const indexOffset = Number(view.getBigUint64(24, true));
  const refsOffset = Number(view.getBigUint64(32, true));
  const refsCount = Number(view.getBigUint64(40, true));
  const headLen = view.getUint16(48, true);
  const headRef = headLen > 0 && headLen <= 14 
    ? new TextDecoder().decode(data.slice(50, 50 + headLen))
    : 'main';
  
  // Build index: hash -> (offset, size)
  const index = new Map<string, { offset: number; size: number }>();
  if (indexOffset > 0 && objectCount > 0) {
    for (let i = 0; i < objectCount; i++) {
      const entryOffset = indexOffset + i * INDEX_ENTRY_SIZE;
      const hash = bytesToHex(data.slice(entryOffset, entryOffset + 32));
      const offset = Number(view.getBigUint64(entryOffset + 32, true));
      const size = view.getUint32(entryOffset + 40, true);
      index.set(hash, { offset, size });
    }
  }
  
  // Read refs (branches)
  const branches = new Map<string, string>();
  if (refsOffset > 0 && refsCount > 0) {
    let pos = refsOffset;
    for (let i = 0; i < refsCount; i++) {
      const nameLen = view.getUint16(pos, true);
      pos += 2;
      const name = new TextDecoder().decode(data.slice(pos, pos + nameLen));
      pos += nameLen;
      const hash = bytesToHex(data.slice(pos, pos + 32));
      pos += 32;
      branches.set(name, hash);
    }
  }
  
  // Parse all objects
  const thoughts: ParsedThought[] = [];
  const edges: ParsedEdge[] = [];
  const commits: ParsedCommit[] = [];
  
  index.forEach(({ offset, size }, hash) => {
    try {
      const compressed = data.slice(offset, offset + size);
      const blob = decompressBlob(compressed);
      
      if (blob.type === BlobType.Thought) {
        const thought = parseThought(blob.data, hash);
        if (thought) thoughts.push(thought);
      } else if (blob.type === BlobType.Edge) {
        const edge = parseEdge(blob.data);
        if (edge) edges.push(edge);
      } else if (blob.type === BlobType.Commit) {
        const commit = parseCommit(blob.data, hash);
        if (commit) commits.push(commit);
      }
    } catch (e) {
      // Skip corrupted objects
      console.warn(`Failed to parse object ${hash}:`, e);
    }
  });
  
  // Sort commits by timestamp (newest first)
  commits.sort((a, b) => b.timestamp - a.timestamp);
  
  return {
    version,
    thoughts,
    edges,
    commits,
    headRef,
    branches,
  };
}

/**
 * Decompress a blob (type byte + zstd compressed data)
 */
function decompressBlob(compressed: Uint8Array): { type: BlobType; data: Uint8Array } {
  if (compressed.length === 0) {
    throw new Error('Empty blob');
  }
  
  const type = compressed[0] as BlobType;
  const compressedData = compressed.slice(1);
  const data = fzstd.decompress(compressedData);
  
  return { type, data };
}

/**
 * Parse a thought from bincode-serialized data
 * 
 * Rust Thought struct (bincode serialized):
 * - id: String (len as u64, then bytes)
 * - content: String
 * - thought_type: Option<String>
 * - embedding: Option<Vec<f32>>
 * - attrs: HashMap<String, serde_json::Value>
 * - created_at: u64
 * - modified_at: u64
 */
function parseThought(data: Uint8Array, _hash: string): ParsedThought | null {
  try {
    const reader = new BincodeReader(data);
    
    const id = reader.readString();
    const content = reader.readString();
    const thoughtType = reader.readOptionString();
    const embedding = reader.readOptionF32Vec();
    
    // Read attrs HashMap to extract embedder_model
    const attrs = reader.readStringHashMap();
    const embedderModel = attrs.get('embedder_model') ?? undefined;
    
    const createdAt = reader.readU64();
    const modifiedAt = reader.readU64();
    
    return {
      id,
      content,
      thoughtType: thoughtType ?? undefined,
      embedding: embedding ?? undefined,
      embedderModel,
      createdAt: Number(createdAt),
      modifiedAt: Number(modifiedAt),
    };
  } catch (e) {
    console.warn('Failed to parse thought:', e);
    return null;
  }
}

/**
 * Parse a commit from bincode-serialized data
 * 
 * Rust Commit struct:
 * - tree: Hash (32 bytes)
 * - parents: Vec<Hash>
 * - message: String
 * - author: String
 * - timestamp: u64
 */
function parseCommit(data: Uint8Array, hash: string): ParsedCommit | null {
  try {
    const reader = new BincodeReader(data);
    
    const tree = bytesToHex(reader.readBytes(32));
    
    // Read parents Vec<Hash>
    const parentsLen = reader.readU64();
    const parents: string[] = [];
    for (let i = 0; i < Number(parentsLen); i++) {
      parents.push(bytesToHex(reader.readBytes(32)));
    }
    
    const message = reader.readString();
    const author = reader.readString();
    const timestamp = reader.readU64();
    
    return {
      hash,
      tree,
      parents,
      message,
      author,
      timestamp: Number(timestamp),
    };
  } catch (e) {
    console.warn('Failed to parse commit:', e);
    return null;
  }
}

/**
 * Parse an edge from bincode-serialized data
 * 
 * Rust Edge struct (bincode serialized):
 * - source: ThoughtId (String)
 * - target: ThoughtId (String)
 * - edge_type: EdgeType (String newtype)
 * - weight: f32
 * - directed: bool
 * - attrs: HashMap<String, serde_json::Value>
 * - created_at: u64
 */
function parseEdge(data: Uint8Array): ParsedEdge | null {
  try {
    const reader = new BincodeReader(data);
    
    const source = reader.readString();
    const target = reader.readString();
    const edgeType = reader.readString();
    const weight = reader.readF32();
    const directed = reader.readBool();
    
    // Skip attrs HashMap
    reader.skipHashMap();
    
    const createdAt = reader.readU64();
    
    return {
      source,
      target,
      edgeType,
      weight,
      directed,
      createdAt: Number(createdAt),
    };
  } catch (e) {
    console.warn('Failed to parse edge:', e);
    return null;
  }
}

/**
 * Helper class for reading bincode-serialized data
 */
class BincodeReader {
  private data: Uint8Array;
  private view: DataView;
  private pos: number = 0;
  
  constructor(data: Uint8Array) {
    this.data = data;
    this.view = new DataView(data.buffer, data.byteOffset, data.byteLength);
  }
  
  readU64(): bigint {
    const val = this.view.getBigUint64(this.pos, true);
    this.pos += 8;
    return val;
  }
  
  readF32(): number {
    const val = this.view.getFloat32(this.pos, true);
    this.pos += 4;
    return val;
  }
  
  readBool(): boolean {
    const val = this.data[this.pos];
    this.pos += 1;
    return val !== 0;
  }
  
  readBytes(len: number): Uint8Array {
    const bytes = this.data.slice(this.pos, this.pos + len);
    this.pos += len;
    return bytes;
  }
  
  readString(): string {
    const len = Number(this.readU64());
    const bytes = this.readBytes(len);
    return new TextDecoder().decode(bytes);
  }
  
  readOptionString(): string | null {
    const hasValue = this.data[this.pos];
    this.pos += 1;
    if (hasValue === 0) return null;
    return this.readString();
  }
  
  readOptionF32Vec(): number[] | null {
    const hasValue = this.data[this.pos];
    this.pos += 1;
    if (hasValue === 0) return null;
    
    const len = Number(this.readU64());
    const vec: number[] = [];
    for (let i = 0; i < len; i++) {
      vec.push(this.readF32());
    }
    return vec;
  }
  
  skipHashMap(): void {
    // HashMap is serialized as: len (u64), then key-value pairs
    const len = Number(this.readU64());
    for (let i = 0; i < len; i++) {
      // Skip key (String)
      const keyLen = Number(this.readU64());
      this.pos += keyLen;
      // Skip value (serde_json::Value) - this is complex, assume it's a small JSON
      // For simplicity, we read until we find the next valid structure
      // This is a hack - proper solution would be to fully parse JSON values
      this.skipJsonValue();
    }
  }
  
  /**
   * Read a HashMap<String, serde_json::Value> and extract string values.
   * Returns a Map of key -> string value (non-string values are skipped).
   */
  readStringHashMap(): Map<string, string> {
    const result = new Map<string, string>();
    const len = Number(this.readU64());
    for (let i = 0; i < len; i++) {
      const key = this.readString();
      const value = this.readJsonValue();
      if (typeof value === 'string') {
        result.set(key, value);
      }
    }
    return result;
  }
  
  /**
   * Read a serde_json::Value and return it as a JS value (string, number, bool, null).
   * Complex values (arrays, objects) are skipped and return undefined.
   */
  readJsonValue(): string | number | boolean | null | undefined {
    const tag = this.view.getUint32(this.pos, true);
    this.pos += 4;
    
    switch (tag) {
      case 0: // Null
        return null;
      case 1: // Bool
        const b = this.data[this.pos];
        this.pos += 1;
        return b !== 0;
      case 2: // Number
        this.pos += 8;
        return undefined; // complex json_number, skip
      case 3: { // String
        const len = Number(this.readU64());
        const bytes = this.readBytes(len);
        return new TextDecoder().decode(bytes);
      }
      case 4: { // Array - skip
        const arrLen = Number(this.readU64());
        for (let i = 0; i < arrLen; i++) {
          this.readJsonValue();
        }
        return undefined;
      }
      case 5: { // Object - skip
        const objLen = Number(this.readU64());
        for (let i = 0; i < objLen; i++) {
          const keyLen = Number(this.readU64());
          this.pos += keyLen;
          this.readJsonValue();
        }
        return undefined;
      }
      default:
        return undefined;
    }
  }
  
  skipJsonValue(): void {
    // serde_json::Value is enum-tagged in bincode
    const tag = this.view.getUint32(this.pos, true);
    this.pos += 4;
    
    switch (tag) {
      case 0: // Null
        break;
      case 1: // Bool
        this.pos += 1;
        break;
      case 2: // Number (i64 or f64, represented as json_number)
        // json_number is complex, skip 8 bytes as approximation
        this.pos += 8;
        break;
      case 3: // String
        const len = Number(this.readU64());
        this.pos += len;
        break;
      case 4: // Array
        const arrLen = Number(this.readU64());
        for (let i = 0; i < arrLen; i++) {
          this.skipJsonValue();
        }
        break;
      case 5: // Object
        const objLen = Number(this.readU64());
        for (let i = 0; i < objLen; i++) {
          // Skip key
          const keyLen = Number(this.readU64());
          this.pos += keyLen;
          // Skip value
          this.skipJsonValue();
        }
        break;
      default:
        // Unknown, skip nothing and hope for the best
        break;
    }
  }
}

function arraysEqual(a: Uint8Array, b: Uint8Array): boolean {
  if (a.length !== b.length) return false;
  for (let i = 0; i < a.length; i++) {
    if (a[i] !== b[i]) return false;
  }
  return true;
}

function bytesToHex(bytes: Uint8Array): string {
  return Array.from(bytes)
    .map(b => b.toString(16).padStart(2, '0'))
    .join('');
}
