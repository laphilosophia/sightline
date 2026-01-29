/**
 * Subtree Size Propagation
 *
 * Handles visibleSubtreeSize updates when expand/collapse occurs.
 * Locality: Only affected ancestors are updated.
 */

import type { NodeID, NodeMetadata, NodeRegistry } from './types'

/**
 * Recalculate visibleSubtreeSize for a single node based on its children.
 *
 * @param registry - Node registry
 * @param nodeId - Node to recalculate
 * @returns The new visibleSubtreeSize
 */
export function recalculateSubtreeSize(registry: NodeRegistry, nodeId: NodeID): number {
  const node = registry.get(nodeId)
  if (!node) return 0

  // Collapsed or no children → always 1
  if (!node.isExpanded || node.childState !== 'RESOLVED' || !node.childNodeIds) {
    node.visibleSubtreeSize = 1
    return 1
  }

  // Expanded with children: 1 + sum of children's sizes
  let size = 1
  for (const childId of node.childNodeIds) {
    const child = registry.get(childId)
    if (child) {
      size += child.visibleSubtreeSize
    }
  }

  node.visibleSubtreeSize = size
  return size
}

/**
 * Propagate a size delta up to all ancestors.
 *
 * Called after expand/collapse to update the entire ancestor chain.
 * Iterative to avoid stack overflow on deep trees.
 *
 * @param registry - Node registry
 * @param nodeId - Node where change originated
 * @param delta - Change in visibleSubtreeSize (positive = expansion, negative = collapse)
 */
export function propagateSizeChange(registry: NodeRegistry, nodeId: NodeID, delta: number): void {
  if (delta === 0) return

  const node = registry.get(nodeId)
  if (!node) return

  // Start from parent (node itself was already updated)
  let current: NodeMetadata | undefined = node.parentNodeId
    ? registry.get(node.parentNodeId)
    : undefined

  while (current) {
    current.visibleSubtreeSize += delta
    current = current.parentNodeId ? registry.get(current.parentNodeId) : undefined
  }
}

/**
 * Recalculate and propagate after an expand/collapse operation.
 *
 * 1. Recalculates the node's visibleSubtreeSize
 * 2. Propagates delta to all ancestors
 *
 * @param registry - Node registry
 * @param nodeId - Node that was expanded/collapsed
 * @returns The new visibleSubtreeSize
 */
export function recalculateAndPropagate(registry: NodeRegistry, nodeId: NodeID): number {
  const node = registry.get(nodeId)
  if (!node) return 0

  const oldSize = node.visibleSubtreeSize
  const newSize = recalculateSubtreeSize(registry, nodeId)
  const delta = newSize - oldSize

  propagateSizeChange(registry, nodeId, delta)

  return newSize
}

/**
 * Batch recalculation for multiple nodes (bottom-up order).
 *
 * Use when multiple children are added/removed at once.
 * Nodes should be ordered from deepest to shallowest.
 *
 * @param registry - Node registry
 * @param nodeIds - Nodes to recalculate (deepest first)
 */
export function batchRecalculate(registry: NodeRegistry, nodeIds: NodeID[]): void {
  for (const nodeId of nodeIds) {
    recalculateSubtreeSize(registry, nodeId)
  }

  // Propagate from the shallowest (last) node if needed
  // Typically called on parent after children are added
}
