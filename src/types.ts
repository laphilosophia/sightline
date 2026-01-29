/**
 * Sightline Core Type Definitions
 *
 * Projection-based tree virtualization engine for GB-scale object trees.
 * These types define the contracts for the entire system.
 */

// =============================================================================
// PRIMITIVE TYPES
// =============================================================================

/**
 * Opaque node identifier. Must be globally stable and immutable.
 * Numeric preferred for performance, string allowed for compatibility.
 */
export type NodeID = number | string

/**
 * Mutation epoch counter for consistency checks.
 * Incremented on each transactional batch.
 */
export type MutationEpoch = number

// =============================================================================
// CHILD STATE MACHINE
// =============================================================================

/**
 * Child resolution state.
 *
 * State transitions:
 * - UNRESOLVED → LOADING (on expand)
 * - LOADING → RESOLVED | EMPTY | ERROR (on provider response)
 * - RESOLVED → UNRESOLVED (on LRU eviction, Phase 2)
 * - ERROR → LOADING (on retry)
 */
export type ChildState = 'UNRESOLVED' | 'LOADING' | 'RESOLVED' | 'EMPTY' | 'ERROR'

// =============================================================================
// NODE METADATA
// =============================================================================

/**
 * Core node structure with visibility semantics.
 *
 * Invariants:
 * - visibleSubtreeSize === 1 when collapsed
 * - visibleSubtreeSize === 1 + sum(children.visibleSubtreeSize) when expanded
 * - childNodeIds only present when childState === RESOLVED
 */
export interface NodeMetadata {
  /** Unique, stable identifier */
  readonly nodeId: NodeID

  /** Parent reference for delta propagation. null for root. */
  parentNodeId: NodeID | null

  /** Child resolution state */
  childState: ChildState

  /** Known child count from schema/metadata (optional) */
  childCount?: number

  /** Resolved children. Only present when childState === RESOLVED */
  childNodeIds?: NodeID[]

  /** Expand/collapse state */
  isExpanded: boolean

  /**
   * Visible subtree size including self.
   * - Collapsed: always 1
   * - Expanded: 1 + sum(children.visibleSubtreeSize)
   */
  visibleSubtreeSize: number

  /** Depth in tree (0 = root) */
  depth: number

  /** Display label for UI */
  label: string
}

// =============================================================================
// NODE VIEW (UI PAYLOAD)
// =============================================================================

/**
 * Minimal, immutable view payload for UI consumption.
 * Contains NO child lists, NO raw data, NO large object graphs.
 */
export interface NodeView {
  /** Node identifier for operations */
  readonly nodeId: NodeID

  /** Depth for indentation */
  readonly depth: number

  /** Current expand/collapse state */
  readonly isExpanded: boolean

  /** Whether node has or may have children */
  readonly hasChildren: boolean

  /** Display text */
  readonly label: string

  /** Error flag for child resolution failure */
  readonly errorFlag?: boolean

  /** Loading flag for pending child resolution */
  readonly loadingFlag?: boolean
}

// =============================================================================
// TELEMETRY HOOKS (v1: contracts only, no-op default)
// =============================================================================

/**
 * Telemetry hook contracts for observability.
 * Phase 2 provides concrete implementations.
 */
export interface TelemetryHooks {
  /** Called after index resolution */
  onResolveIndex?(latencyMs: number, depth: number): void

  /** Called after getRange completes */
  onGetRange?(hitSize: number, latencyMs: number): void

  /** Called after child resolution attempt */
  onChildLoad?(nodeId: NodeID, durationMs: number, success: boolean): void

  /** Called when visible count changes */
  onVisibleCountChange?(oldCount: number, newCount: number): void
}

// =============================================================================
// CONFIGURATION
// =============================================================================

/**
 * Sightline engine configuration.
 */
export interface SightlineOptions {
  /** Telemetry hooks (optional, no-op default) */
  telemetry?: TelemetryHooks
}

// =============================================================================
// PUBLIC API INTERFACE
// =============================================================================

/**
 * Main Sightline engine interface.
 * This is the ONLY contact point between consumer and projection layer.
 */
export interface Sightline {
  /**
   * Get visible nodes in range.
   * @param offset - Start index in visible space
   * @param limit - Maximum nodes to return
   */
  getRange(offset: number, limit: number): NodeView[]

  /**
   * Expand a node (make children visible).
   * Triggers provider if childState === UNRESOLVED.
   */
  expand(nodeId: NodeID): void

  /**
   * Collapse a node (hide children).
   */
  collapse(nodeId: NodeID): void

  /** Get total visible node count */
  getTotalVisibleCount(): number

  /** Get current mutation epoch for consistency checks */
  getEpoch(): MutationEpoch
}

// =============================================================================
// CHILDREN PROVIDER (LAZY LOADING)
// =============================================================================

/**
 * Async children provider for lazy materialization.
 */
export interface ChildrenProvider {
  /**
   * Resolve children for a node.
   * @param nodeId - Parent node to resolve children for
   * @returns Promise resolving to child NodeMetadata array
   */
  resolveChildren(nodeId: NodeID): Promise<NodeMetadata[]>
}

// =============================================================================
// MUTATION TYPES (Phase 8)
// =============================================================================

/**
 * Mutation operation types for transactional batches.
 */
export type MutationOperation =
  | { type: 'INSERT'; parentId: NodeID; node: NodeMetadata; position?: number }
  | { type: 'REMOVE'; nodeId: NodeID }
  | { type: 'MOVE'; nodeId: NodeID; newParentId: NodeID; position?: number }
  | { type: 'UPDATE'; nodeId: NodeID; patch: Partial<Omit<NodeMetadata, 'nodeId'>> }

// =============================================================================
// REGISTRY INTERFACE
// =============================================================================

/**
 * Node registry interface for O(1) lookup.
 */
export interface NodeRegistry {
  /** Get node by ID */
  get(nodeId: NodeID): NodeMetadata | undefined

  /** Set/update node */
  set(nodeId: NodeID, node: NodeMetadata): void

  /** Check if node exists */
  has(nodeId: NodeID): boolean

  /** Delete node */
  delete(nodeId: NodeID): boolean

  /** Get registry size */
  size(): number

  /** Get root node ID */
  getRootId(): NodeID | null

  /** Set root node ID */
  setRootId(nodeId: NodeID): void

  /** Iterate over all nodes */
  values(): IterableIterator<NodeMetadata>
}
