/**
 * Mutation Utilities - Internal Functions
 *
 * Low-level utilities for registry mutations.
 * These are NOT public API - they're for worker/orchestration layer use.
 *
 * Usage pattern:
 *   Worker receives mutation intent
 *   → Worker calls these utilities
 *   → Worker increments epoch
 *   → UI re-queries
 */

import { recalculateAndPropagate } from './propagation'
import type { NodeID, NodeRegistry } from './types'

/**
 * Reorder children within the same parent.
 *
 * @param registry - Node registry
 * @param parentId - Parent node ID
 * @param newOrder - New child order (must contain same IDs)
 * @returns true if reorder succeeded
 *
 * @example
 * // Move third child to first position
 * const parent = registry.get(parentId)
 * const newOrder = [children[2], children[0], children[1], ...children.slice(3)]
 * reorderChildren(registry, parentId, newOrder)
 */
export function reorderChildren(
  registry: NodeRegistry,
  parentId: NodeID,
  newOrder: NodeID[]
): boolean {
  const parent = registry.get(parentId)
  if (!parent) return false

  const currentChildren = parent.childNodeIds ?? []

  // Validate: same IDs, just reordered
  if (newOrder.length !== currentChildren.length) return false
  const currentSet = new Set(currentChildren)
  const newSet = new Set(newOrder)

  if (currentSet.size !== newSet.size) return false
  for (const id of newOrder) {
    if (!currentSet.has(id)) return false
  }

  // Apply reorder
  parent.childNodeIds = newOrder

  // No size propagation needed - just order change
  return true
}

/**
 * Move a node to a different parent.
 *
 * @param registry - Node registry
 * @param nodeId - Node to move
 * @param newParentId - Target parent
 * @param insertIndex - Position in new parent's children (default: end)
 * @returns true if move succeeded
 *
 * @example
 * moveNode(registry, 'file-1', 'folder-2', 0)  // Move to start of folder-2
 */
export function moveNode(
  registry: NodeRegistry,
  nodeId: NodeID,
  newParentId: NodeID,
  insertIndex?: number
): boolean {
  const node = registry.get(nodeId)
  const newParent = registry.get(newParentId)

  if (!node || !newParent) return false
  if (node.parentNodeId === null) return false // Can't move root

  // Prevent cycle: newParent cannot be descendant of node
  if (isDescendant(registry, newParentId, nodeId)) return false

  const oldParentId = node.parentNodeId
  const oldParent = oldParentId !== null ? registry.get(oldParentId) : null

  // Remove from old parent
  if (oldParent && oldParent.childNodeIds) {
    oldParent.childNodeIds = oldParent.childNodeIds.filter((id) => id !== nodeId)
    if (oldParent.isExpanded) {
      recalculateAndPropagate(registry, oldParentId as NodeID)
    }
  }

  // Add to new parent
  if (!newParent.childNodeIds) {
    newParent.childNodeIds = []
  }

  const idx = insertIndex ?? newParent.childNodeIds.length
  newParent.childNodeIds.splice(idx, 0, nodeId)

  // Update node's parent reference
  node.parentNodeId = newParentId

  // Update depth for moved subtree
  const depthDelta = (newParent.depth ?? 0) + 1 - (node.depth ?? 0)
  if (depthDelta !== 0) {
    updateSubtreeDepth(registry, nodeId, depthDelta)
  }

  // Recalculate new parent's subtree size
  if (newParent.isExpanded) {
    recalculateAndPropagate(registry, newParentId)
  }

  return true
}

/**
 * Check if potentialDescendant is a descendant of ancestorId.
 */
function isDescendant(
  registry: NodeRegistry,
  potentialDescendant: NodeID,
  ancestorId: NodeID
): boolean {
  let current = registry.get(potentialDescendant)

  while (current && current.parentNodeId !== null) {
    if (current.parentNodeId === ancestorId) return true
    current = registry.get(current.parentNodeId)
  }

  return false
}

/**
 * Update depth for entire subtree.
 */
function updateSubtreeDepth(registry: NodeRegistry, nodeId: NodeID, delta: number): void {
  const node = registry.get(nodeId)
  if (!node) return

  node.depth = (node.depth ?? 0) + delta

  if (node.childNodeIds) {
    for (const childId of node.childNodeIds) {
      updateSubtreeDepth(registry, childId, delta)
    }
  }
}

/**
 * Remove a node and its entire subtree.
 *
 * @param registry - Node registry
 * @param nodeId - Node to remove
 * @returns Number of nodes removed
 */
export function removeNode(registry: NodeRegistry, nodeId: NodeID): number {
  const node = registry.get(nodeId)
  if (!node) return 0

  // Can't remove root
  if (node.parentNodeId === null) return 0

  // Remove from parent's children
  const parent = registry.get(node.parentNodeId)
  if (parent && parent.childNodeIds) {
    parent.childNodeIds = parent.childNodeIds.filter((id) => id !== nodeId)
  }

  // Remove subtree recursively
  const removed = removeSubtree(registry, nodeId)

  // Recalculate parent's subtree size
  if (parent && parent.isExpanded) {
    recalculateAndPropagate(registry, node.parentNodeId)
  }

  return removed
}

/**
 * Remove node and all descendants from registry.
 */
function removeSubtree(registry: NodeRegistry, nodeId: NodeID): number {
  const node = registry.get(nodeId)
  if (!node) return 0

  let count = 1

  if (node.childNodeIds) {
    for (const childId of node.childNodeIds) {
      count += removeSubtree(registry, childId)
    }
  }

  registry.delete(nodeId)
  return count
}

/**
 * Insert a new node as child of parent.
 *
 * @param registry - Node registry
 * @param parentId - Parent to insert under
 * @param newNode - Node to insert (must have correct parentNodeId set)
 * @param insertIndex - Position (default: end)
 * @returns true if insert succeeded
 */
export function insertNode(
  registry: NodeRegistry,
  parentId: NodeID,
  newNodeId: NodeID,
  insertIndex?: number
): boolean {
  const parent = registry.get(parentId)
  const newNode = registry.get(newNodeId)

  if (!parent || !newNode) return false
  if (newNode.parentNodeId !== parentId) return false

  if (!parent.childNodeIds) {
    parent.childNodeIds = []
  }

  const idx = insertIndex ?? parent.childNodeIds.length
  parent.childNodeIds.splice(idx, 0, newNodeId)

  // Update child state if this is first child
  if (parent.childNodeIds.length === 1 && parent.childState === 'EMPTY') {
    parent.childState = 'RESOLVED'
  }

  // Recalculate if parent is expanded
  if (parent.isExpanded) {
    recalculateAndPropagate(registry, parentId)
  }

  return true
}
