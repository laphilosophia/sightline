/**
 * Children Provider - Lazy Loading Support
 *
 * Handles async child resolution with epoch validation.
 */

import { completeExpand } from './controller'
import { addNode } from './registry'
import type { ChildrenProvider, MutationEpoch, NodeID, NodeMetadata, NodeRegistry } from './types'

/**
 * Provider registration for lazy loading.
 */
export interface ProviderRegistry {
  /** Register a provider for a specific node */
  register(nodeId: NodeID, provider: ChildrenProvider): void

  /** Get provider for a node */
  get(nodeId: NodeID): ChildrenProvider | undefined

  /** Unregister provider */
  unregister(nodeId: NodeID): void
}

/**
 * Create a provider registry.
 */
export function createProviderRegistry(): ProviderRegistry {
  const providers = new Map<NodeID, ChildrenProvider>()

  return {
    register(nodeId: NodeID, provider: ChildrenProvider): void {
      providers.set(nodeId, provider)
    },

    get(nodeId: NodeID): ChildrenProvider | undefined {
      return providers.get(nodeId)
    },

    unregister(nodeId: NodeID): void {
      providers.delete(nodeId)
    },
  }
}

/**
 * Result of a child resolution operation.
 */
export interface ResolutionResult {
  success: boolean
  nodeId: NodeID
  childCount: number
  error?: Error
}

/**
 * Trigger child resolution for a node.
 *
 * @param registry - Node registry
 * @param providerRegistry - Provider registry
 * @param nodeId - Node to resolve children for
 * @param capturedEpoch - Epoch at time of trigger (for stale detection)
 * @param getCurrentEpoch - Function to get current epoch
 * @returns Promise with resolution result
 */
export async function triggerChildResolution(
  registry: NodeRegistry,
  providerRegistry: ProviderRegistry,
  nodeId: NodeID,
  capturedEpoch: MutationEpoch,
  getCurrentEpoch: () => MutationEpoch
): Promise<ResolutionResult> {
  const provider = providerRegistry.get(nodeId)

  if (!provider) {
    // No provider - check if node might have children from metadata
    completeExpand(registry, nodeId, [])
    return { success: true, nodeId, childCount: 0 }
  }

  try {
    const children = await provider.resolveChildren(nodeId)

    // Epoch check - discard if stale
    if (getCurrentEpoch() !== capturedEpoch) {
      return {
        success: false,
        nodeId,
        childCount: 0,
        error: new Error('Resolution discarded: epoch mismatch'),
      }
    }

    // Add children to registry
    const childIds = children.map((child) => {
      addNode(registry, child)
      return child.nodeId
    })

    // Complete expansion
    completeExpand(registry, nodeId, childIds)

    return { success: true, nodeId, childCount: childIds.length }
  } catch (error) {
    // Complete with error
    completeExpand(registry, nodeId, [], error as Error)
    return {
      success: false,
      nodeId,
      childCount: 0,
      error: error as Error,
    }
  }
}

/**
 * Set a global provider that will be used for all UNRESOLVED nodes.
 */
export function createGlobalProvider(
  resolveFn: (nodeId: NodeID) => Promise<NodeMetadata[]>
): ChildrenProvider {
  return {
    resolveChildren: resolveFn,
  }
}
