/**
 * Index Resolver - O(log n) Index → NodeID Resolution
 *
 * Prefix-sum implicit traversal for efficient index lookup.
 * Complexity: O(depth × log(branching)) ≈ O(log n)
 */

import type { NodeID, NodeMetadata, NodeRegistry } from './types'

/**
 * Result of index resolution.
 */
export interface ResolveResult {
  nodeId: NodeID
  depth: number
}

/**
 * Resolve a global index to a NodeID.
 *
 * Uses prefix-sum traversal: walks tree using visibleSubtreeSize
 * to skip subtrees without visiting them.
 *
 * @param registry - Node registry
 * @param targetIndex - Global index in visible space (0-based)
 * @returns Resolved node or null if out of bounds
 */
export function resolveIndex(registry: NodeRegistry, targetIndex: number): ResolveResult | null {
  const rootId = registry.getRootId()
  if (rootId === null) return null

  const root = registry.get(rootId)
  if (!root) return null

  // Bounds check
  if (targetIndex < 0 || targetIndex >= root.visibleSubtreeSize) {
    return null
  }

  return resolveIndexRecursive(registry, root, targetIndex)
}

/**
 * Recursive prefix-sum traversal.
 */
function resolveIndexRecursive(
  registry: NodeRegistry,
  node: NodeMetadata,
  targetIndex: number
): ResolveResult {
  // Index 0 = this node
  if (targetIndex === 0) {
    return { nodeId: node.nodeId, depth: node.depth }
  }

  // Subtract self, look into children
  let remaining = targetIndex - 1

  // Only traverse if expanded and has resolved children
  if (node.isExpanded && node.childState === 'RESOLVED' && node.childNodeIds) {
    for (const childId of node.childNodeIds) {
      const child = registry.get(childId)
      if (!child) continue

      if (remaining < child.visibleSubtreeSize) {
        // Target is within this child's subtree
        return resolveIndexRecursive(registry, child, remaining)
      }

      remaining -= child.visibleSubtreeSize
    }
  }

  // Should not reach here if visibleSubtreeSize is correct
  throw new Error(
    `Index resolution invariant violation: remaining=${remaining} at node=${String(node.nodeId)}`
  )
}

/**
 * Get the global index of a node in visible space.
 * Returns -1 if node is not visible (ancestor collapsed).
 *
 * @param registry - Node registry
 * @param nodeId - Target node ID
 * @returns Global index or -1 if not visible
 */
export function getIndexOfNode(registry: NodeRegistry, nodeId: NodeID): number {
  const node = registry.get(nodeId)
  if (!node) return -1

  // Build path from node to root
  const path: NodeMetadata[] = []
  let current: NodeMetadata | undefined = node

  while (current) {
    path.unshift(current)
    if (current.parentNodeId === null) break
    current = registry.get(current.parentNodeId)
  }

  // Check visibility: all ancestors must be expanded
  for (let i = 0; i < path.length - 1; i++) {
    if (!path[i].isExpanded) {
      return -1 // Hidden by collapsed ancestor
    }
  }

  // Calculate index by summing preceding siblings' subtree sizes
  let index = 0

  for (let i = 0; i < path.length; i++) {
    const currentNode = path[i]

    if (i === 0) {
      // Root contributes nothing to index (it IS index 0)
      continue
    }

    const parent = path[i - 1]

    // Add 1 for parent itself
    index += 1

    // Add all preceding siblings' subtree sizes
    if (parent.childState === 'RESOLVED' && parent.childNodeIds) {
      for (const siblingId of parent.childNodeIds) {
        if (siblingId === currentNode.nodeId) break
        const sibling = registry.get(siblingId)
        if (sibling) {
          index += sibling.visibleSubtreeSize
        }
      }
    }
  }

  return index
}
