/**
 * Range Query API
 *
 * The ONLY contact point between UI and data layer.
 * Returns minimal, immutable NodeView[] for rendering.
 */

import type { NodeID, NodeMetadata, NodeRegistry, NodeView } from './types'

/**
 * Get visible nodes in a range.
 *
 * @param registry - Node registry
 * @param offset - Start index in visible space (0-based)
 * @param limit - Maximum number of nodes to return
 * @returns Array of NodeView for UI consumption
 */
export function getRange(registry: NodeRegistry, offset: number, limit: number): NodeView[] {
  const rootId = registry.getRootId()
  if (rootId === null) return []

  const root = registry.get(rootId)
  if (!root) return []

  const totalVisible = root.visibleSubtreeSize

  // Bounds validation
  if (offset < 0 || offset >= totalVisible || limit <= 0) {
    return []
  }

  const results: NodeView[] = []
  const endIndex = Math.min(offset + limit, totalVisible)

  // Collect nodes from offset to endIndex
  collectRange(registry, root, offset, endIndex, 0, results)

  return results
}

/**
 * Recursive collector that walks the tree and gathers nodes in range.
 *
 * @param registry - Node registry
 * @param node - Current node
 * @param rangeStart - Start of requested range
 * @param rangeEnd - End of requested range (exclusive)
 * @param currentIndex - Current global index
 * @param results - Output array
 * @returns Next index after this subtree
 */
function collectRange(
  registry: NodeRegistry,
  node: NodeMetadata,
  rangeStart: number,
  rangeEnd: number,
  currentIndex: number,
  results: NodeView[]
): number {
  // Skip if entire subtree is before range
  if (currentIndex + node.visibleSubtreeSize <= rangeStart) {
    return currentIndex + node.visibleSubtreeSize
  }

  // Stop if we're past the range
  if (currentIndex >= rangeEnd) {
    return currentIndex
  }

  // Add this node if within range
  if (currentIndex >= rangeStart && currentIndex < rangeEnd) {
    results.push(createNodeView(node))
  }

  let index = currentIndex + 1

  // Traverse children if expanded
  if (node.isExpanded && node.childState === 'RESOLVED' && node.childNodeIds) {
    for (const childId of node.childNodeIds) {
      const child = registry.get(childId)
      if (!child) continue

      // Early exit if past range
      if (index >= rangeEnd) break

      // Skip subtree if entirely before range
      if (index + child.visibleSubtreeSize <= rangeStart) {
        index += child.visibleSubtreeSize
        continue
      }

      index = collectRange(registry, child, rangeStart, rangeEnd, index, results)
    }
  }

  return index
}

/**
 * Create a NodeView from NodeMetadata.
 * This is the immutable, minimal payload for UI.
 */
function createNodeView(node: NodeMetadata): NodeView {
  const hasChildren =
    node.childState === 'UNRESOLVED' ||
    node.childState === 'LOADING' ||
    (node.childState === 'RESOLVED' && (node.childNodeIds?.length ?? 0) > 0)

  return {
    nodeId: node.nodeId,
    depth: node.depth,
    isExpanded: node.isExpanded,
    hasChildren,
    label: node.label,
    errorFlag: node.childState === 'ERROR' ? true : undefined,
    loadingFlag: node.childState === 'LOADING' ? true : undefined,
  }
}

/**
 * Get total visible node count.
 */
export function getTotalVisibleCount(registry: NodeRegistry): number {
  const rootId = registry.getRootId()
  if (rootId === null) return 0

  const root = registry.get(rootId)
  return root?.visibleSubtreeSize ?? 0
}

/**
 * Get a single node view by ID (if visible).
 */
export function getNodeView(registry: NodeRegistry, nodeId: NodeID): NodeView | null {
  const node = registry.get(nodeId)
  if (!node) return null

  return createNodeView(node)
}
