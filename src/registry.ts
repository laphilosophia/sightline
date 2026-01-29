/**
 * Node Registry - O(1) Map-based storage
 *
 * Single source of truth for all node metadata.
 * Worker-owned, UI read-only.
 */

import type { NodeID, NodeMetadata, NodeRegistry } from './types'

/**
 * Create a new node registry instance.
 */
export function createRegistry(): NodeRegistry {
  const nodes = new Map<NodeID, NodeMetadata>()
  let rootId: NodeID | null = null

  return {
    get(nodeId: NodeID): NodeMetadata | undefined {
      return nodes.get(nodeId)
    },

    set(nodeId: NodeID, node: NodeMetadata): void {
      nodes.set(nodeId, node)
    },

    has(nodeId: NodeID): boolean {
      return nodes.has(nodeId)
    },

    delete(nodeId: NodeID): boolean {
      return nodes.delete(nodeId)
    },

    size(): number {
      return nodes.size
    },

    getRootId(): NodeID | null {
      return rootId
    },

    setRootId(nodeId: NodeID): void {
      rootId = nodeId
    },

    values(): IterableIterator<NodeMetadata> {
      return nodes.values()
    },
  }
}

/**
 * Create a node with default values.
 * Utility for clean node construction.
 */
export function createNode(
  nodeId: NodeID,
  options: {
    parentNodeId?: NodeID | null
    label?: string
    depth?: number
    childCount?: number
    childNodeIds?: NodeID[]
    isExpanded?: boolean
  } = {}
): NodeMetadata {
  const hasResolvedChildren = options.childNodeIds !== undefined

  return {
    nodeId,
    parentNodeId: options.parentNodeId ?? null,
    childState: hasResolvedChildren
      ? options.childNodeIds!.length > 0
        ? 'RESOLVED'
        : 'EMPTY'
      : 'UNRESOLVED',
    childCount: options.childCount,
    childNodeIds: options.childNodeIds,
    isExpanded: options.isExpanded ?? false,
    visibleSubtreeSize: 1, // Always starts at 1, propagation handles expansion
    depth: options.depth ?? 0,
    label: options.label ?? `Node ${nodeId}`,
  }
}

/**
 * Populate registry with a node and set as root if no root exists.
 */
export function addNode(registry: NodeRegistry, node: NodeMetadata): void {
  registry.set(node.nodeId, node)

  if (registry.getRootId() === null && node.parentNodeId === null) {
    registry.setRootId(node.nodeId)
  }
}

/**
 * Get root node from registry.
 */
export function getRoot(registry: NodeRegistry): NodeMetadata | undefined {
  const rootId = registry.getRootId()
  return rootId !== null ? registry.get(rootId) : undefined
}
