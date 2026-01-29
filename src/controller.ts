/**
 * Expand/Collapse Controller
 *
 * Manages visibility state transitions.
 * Triggers provider when expanding UNRESOLVED nodes.
 */

import { recalculateAndPropagate } from './propagation'
import type { NodeID, NodeRegistry } from './types'

/**
 * Expand result for async provider handling.
 */
export interface ExpandResult {
  success: boolean
  needsProvider: boolean
  newVisibleCount?: number
}

/**
 * Expand a node (make children visible).
 *
 * If childState is UNRESOLVED, marks as LOADING and returns needsProvider=true.
 * Caller should then trigger the provider and call completeExpand.
 *
 * @param registry - Node registry
 * @param nodeId - Node to expand
 * @returns Expand result indicating if provider is needed
 */
export function expand(registry: NodeRegistry, nodeId: NodeID): ExpandResult {
  const node = registry.get(nodeId)
  if (!node) {
    return { success: false, needsProvider: false }
  }

  // Already expanded
  if (node.isExpanded) {
    return { success: true, needsProvider: false }
  }

  // Check if we need to load children first
  if (node.childState === 'UNRESOLVED') {
    node.childState = 'LOADING'
    return { success: true, needsProvider: true }
  }

  // EMPTY or ERROR - can expand but won't show anything
  if (node.childState === 'EMPTY' || node.childState === 'ERROR') {
    node.isExpanded = true
    return { success: true, needsProvider: false, newVisibleCount: 1 }
  }

  // RESOLVED - expand and recalculate
  node.isExpanded = true
  recalculateAndPropagate(registry, nodeId)

  return {
    success: true,
    needsProvider: false,
    newVisibleCount: registry.get(registry.getRootId()!)?.visibleSubtreeSize,
  }
}

/**
 * Complete an expand operation after provider resolves.
 *
 * @param registry - Node registry
 * @param nodeId - Node that was being expanded
 * @param childNodes - Resolved child nodes from provider (already added to registry)
 * @param error - Optional error if provider failed
 */
export function completeExpand(
  registry: NodeRegistry,
  nodeId: NodeID,
  childNodeIds: NodeID[],
  error?: Error
): void {
  const node = registry.get(nodeId)
  if (!node) return

  if (error) {
    node.childState = 'ERROR'
    node.isExpanded = true // Show error state
    return
  }

  if (childNodeIds.length === 0) {
    node.childState = 'EMPTY'
    node.isExpanded = true
    return
  }

  node.childState = 'RESOLVED'
  node.childNodeIds = childNodeIds
  node.isExpanded = true

  recalculateAndPropagate(registry, nodeId)
}

/**
 * Collapse a node (hide children).
 *
 * @param registry - Node registry
 * @param nodeId - Node to collapse
 * @returns true if node was collapsed, false if not found or already collapsed
 */
export function collapse(registry: NodeRegistry, nodeId: NodeID): boolean {
  const node = registry.get(nodeId)
  if (!node) return false

  // Already collapsed
  if (!node.isExpanded) return false

  node.isExpanded = false
  recalculateAndPropagate(registry, nodeId)

  return true
}

/**
 * Toggle expand/collapse state.
 *
 * @param registry - Node registry
 * @param nodeId - Node to toggle
 * @returns Expand result if expanding, boolean if collapsing
 */
export function toggle(registry: NodeRegistry, nodeId: NodeID): ExpandResult | boolean {
  const node = registry.get(nodeId)
  if (!node) return false

  if (node.isExpanded) {
    return collapse(registry, nodeId)
  } else {
    return expand(registry, nodeId)
  }
}

/**
 * Check if a node can be expanded (has potential children).
 */
export function canExpand(registry: NodeRegistry, nodeId: NodeID): boolean {
  const node = registry.get(nodeId)
  if (!node) return false

  // Already expanded
  if (node.isExpanded) return false

  // Has known children or might have children
  if (node.childState === 'RESOLVED') {
    return (node.childNodeIds?.length ?? 0) > 0
  }

  // UNRESOLVED - might have children
  if (node.childState === 'UNRESOLVED') {
    return true
  }

  // EMPTY or ERROR - nothing to expand
  return false
}

/**
 * Check if a node can be collapsed (is currently expanded).
 */
export function canCollapse(registry: NodeRegistry, nodeId: NodeID): boolean {
  const node = registry.get(nodeId)
  return node?.isExpanded ?? false
}
