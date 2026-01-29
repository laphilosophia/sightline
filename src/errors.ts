/**
 * Sightline Error Types
 *
 * Structured error handling for projection layer.
 * Errors are localized - UI receives only "render failed" without reason.
 */

import type { MutationEpoch, NodeID } from './types'

/**
 * Base error class for Sightline.
 */
export class SightlineError extends Error {
  readonly code: string

  constructor(code: string, message: string) {
    super(message)
    this.code = code
    this.name = 'SightlineError'
  }
}

/**
 * Query with outdated epoch.
 * Recoverable - return empty result or trigger soft reset.
 */
export class StaleEpochError extends SightlineError {
  readonly expectedEpoch: MutationEpoch
  readonly actualEpoch: MutationEpoch

  constructor(expected: MutationEpoch, actual: MutationEpoch) {
    super('STALE_EPOCH', `Epoch mismatch: expected ${expected}, got ${actual}`)
    this.name = 'StaleEpochError'
    this.expectedEpoch = expected
    this.actualEpoch = actual
  }
}

/**
 * Child resolution failed.
 * Node-scoped - tree remains intact.
 */
export class ChildResolutionError extends SightlineError {
  readonly nodeId: NodeID
  readonly cause?: Error

  constructor(nodeId: NodeID, cause?: Error) {
    super('CHILD_RESOLUTION_FAILED', `Failed to resolve children for node: ${String(nodeId)}`)
    this.name = 'ChildResolutionError'
    this.nodeId = nodeId
    this.cause = cause
  }
}

/**
 * Registry invariant violated - FATAL.
 * Tree must be frozen, silent continuation forbidden.
 */
export class RegistryCorruptedError extends SightlineError {
  readonly details: string

  constructor(details: string) {
    super('REGISTRY_CORRUPTED', `Registry corrupted: ${details}`)
    this.name = 'RegistryCorruptedError'
    this.details = details
  }
}

/**
 * Node not found in registry.
 */
export class NodeNotFoundError extends SightlineError {
  readonly nodeId: NodeID

  constructor(nodeId: NodeID) {
    super('NODE_NOT_FOUND', `Node not found: ${String(nodeId)}`)
    this.name = 'NodeNotFoundError'
    this.nodeId = nodeId
  }
}

/**
 * Index out of visible range.
 */
export class IndexOutOfBoundsError extends SightlineError {
  readonly index: number
  readonly maxIndex: number

  constructor(index: number, maxIndex: number) {
    super('INDEX_OUT_OF_BOUNDS', `Index ${index} out of bounds (max: ${maxIndex})`)
    this.name = 'IndexOutOfBoundsError'
    this.index = index
    this.maxIndex = maxIndex
  }
}

// =============================================================================
// ERROR UTILITIES
// =============================================================================

/**
 * Check if error is a Sightline error.
 */
export function isSightlineError(error: unknown): error is SightlineError {
  return error instanceof SightlineError
}

/**
 * Check if error is recoverable (non-fatal).
 */
export function isRecoverableError(error: unknown): boolean {
  if (!isSightlineError(error)) return false

  return !(error instanceof RegistryCorruptedError)
}

/**
 * Check if error is fatal (tree must be frozen).
 */
export function isFatalError(error: unknown): boolean {
  return error instanceof RegistryCorruptedError
}

/**
 * Get error code for logging/telemetry.
 */
export function getErrorCode(error: unknown): string {
  if (isSightlineError(error)) {
    return error.code
  }
  return 'UNKNOWN'
}
