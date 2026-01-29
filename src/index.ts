/**
 * Sightline Public API
 *
 * Projection-based tree virtualization engine for GB-scale object trees.
 */

// Core types
export type {
  ChildrenProvider,
  ChildState,
  MutationEpoch,
  MutationOperation,
  NodeID,
  NodeMetadata,
  NodeRegistry,
  NodeView,
  Sightline,
  SightlineOptions,
  TelemetryHooks,
} from './types'

// Registry utilities
export { addNode, createNode, createRegistry, getRoot } from './registry'

// Resolution
export { getIndexOfNode, resolveIndex } from './resolver'
export type { ResolveResult } from './resolver'

// Propagation (internal-ish, but useful for advanced usage)
export { propagateSizeChange, recalculateAndPropagate, recalculateSubtreeSize } from './propagation'

// Controller
export { canCollapse, canExpand, collapse, completeExpand, expand, toggle } from './controller'
export type { ExpandResult } from './controller'

// Query
export { getNodeView, getRange, getTotalVisibleCount } from './query'

// =============================================================================
// SIGHTLINE FACTORY
// =============================================================================

import { completeExpand, collapse as doCollapse, expand as doExpand } from './controller'
import { getRange as doGetRange, getTotalVisibleCount as doGetTotalVisibleCount } from './query'
import { createRegistry } from './registry'
import type {
  MutationEpoch,
  NodeID,
  NodeRegistry,
  NodeView,
  Sightline,
  SightlineOptions,
} from './types'

/**
 * Create a Sightline engine instance.
 *
 * @param options - Configuration options
 * @returns Sightline engine instance
 */
export function createSightline(options: SightlineOptions = {}): SightlineEngine {
  return new SightlineEngine(options)
}

/**
 * Sightline Engine implementation.
 *
 * Provides the full Sightline interface plus additional management methods.
 */
export class SightlineEngine implements Sightline {
  private readonly registry: NodeRegistry
  private readonly telemetry: SightlineOptions['telemetry']
  private epoch: MutationEpoch = 0

  constructor(options: SightlineOptions = {}) {
    this.registry = createRegistry()
    this.telemetry = options.telemetry
  }

  /**
   * Get the underlying registry for direct manipulation.
   * Use with caution - prefer the high-level API.
   */
  getRegistry(): NodeRegistry {
    return this.registry
  }

  /**
   * Increment epoch (called after mutations).
   */
  incrementEpoch(): void {
    const oldCount = doGetTotalVisibleCount(this.registry)
    this.epoch++
    const newCount = doGetTotalVisibleCount(this.registry)

    if (oldCount !== newCount) {
      this.telemetry?.onVisibleCountChange?.(oldCount, newCount)
    }
  }

  // Sightline interface implementation

  getRange(offset: number, limit: number): NodeView[] {
    const start = performance.now()
    const result = doGetRange(this.registry, offset, limit)
    const latency = performance.now() - start

    this.telemetry?.onGetRange?.(result.length, latency)

    return result
  }

  expand(nodeId: NodeID): void {
    const oldCount = doGetTotalVisibleCount(this.registry)
    const result = doExpand(this.registry, nodeId)

    if (result.success && !result.needsProvider) {
      this.notifyCountChange(oldCount)
      this.epoch++
    }

    // If needsProvider is true, caller should handle async loading
    // and call completeExpand + incrementEpoch when done
  }

  collapse(nodeId: NodeID): void {
    const oldCount = doGetTotalVisibleCount(this.registry)
    const success = doCollapse(this.registry, nodeId)

    if (success) {
      this.notifyCountChange(oldCount)
      this.epoch++
    }
  }

  private notifyCountChange(oldCount: number): void {
    const newCount = doGetTotalVisibleCount(this.registry)
    if (oldCount !== newCount) {
      this.telemetry?.onVisibleCountChange?.(oldCount, newCount)
    }
  }

  getTotalVisibleCount(): number {
    return doGetTotalVisibleCount(this.registry)
  }

  getEpoch(): MutationEpoch {
    return this.epoch
  }

  // Extended API

  /**
   * Complete an expand operation after async child loading.
   *
   * @param nodeId - Node that was being expanded
   * @param childNodeIds - Resolved child IDs (children must already be in registry)
   * @param error - Optional error if loading failed
   */
  completeExpand(nodeId: NodeID, childNodeIds: NodeID[], error?: Error): void {
    completeExpand(this.registry, nodeId, childNodeIds, error)
    this.incrementEpoch()
  }

  /**
   * Check if expansion requires async child loading.
   */
  needsChildLoading(nodeId: NodeID): boolean {
    const node = this.registry.get(nodeId)
    return node?.childState === 'UNRESOLVED' || node?.childState === 'LOADING'
  }
}
