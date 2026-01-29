/**
 * Errors Tests
 */

import { describe, expect, it } from 'vitest'
import {
  ChildResolutionError,
  getErrorCode,
  IndexOutOfBoundsError,
  isFatalError,
  isRecoverableError,
  isSightlineError,
  NodeNotFoundError,
  RegistryCorruptedError,
  SightlineError,
  StaleEpochError,
} from '../errors'

describe('errors', () => {
  describe('SightlineError', () => {
    it('should create error with code', () => {
      const error = new SightlineError('TEST_CODE', 'Test message')

      expect(error.code).toBe('TEST_CODE')
      expect(error.message).toBe('Test message')
      expect(error.name).toBe('SightlineError')
    })
  })

  describe('StaleEpochError', () => {
    it('should create with epoch info', () => {
      const error = new StaleEpochError(5, 3)

      expect(error.code).toBe('STALE_EPOCH')
      expect(error.expectedEpoch).toBe(5)
      expect(error.actualEpoch).toBe(3)
    })
  })

  describe('ChildResolutionError', () => {
    it('should create with nodeId', () => {
      const error = new ChildResolutionError('node123')

      expect(error.code).toBe('CHILD_RESOLUTION_FAILED')
      expect(error.nodeId).toBe('node123')
    })

    it('should include cause', () => {
      const cause = new Error('Network error')
      const error = new ChildResolutionError('node123', cause)

      expect(error.cause).toBe(cause)
    })
  })

  describe('RegistryCorruptedError', () => {
    it('should create with details', () => {
      const error = new RegistryCorruptedError('Cycle detected')

      expect(error.code).toBe('REGISTRY_CORRUPTED')
      expect(error.details).toBe('Cycle detected')
    })
  })

  describe('NodeNotFoundError', () => {
    it('should create with nodeId', () => {
      const error = new NodeNotFoundError('missing')

      expect(error.code).toBe('NODE_NOT_FOUND')
      expect(error.nodeId).toBe('missing')
    })
  })

  describe('IndexOutOfBoundsError', () => {
    it('should create with index info', () => {
      const error = new IndexOutOfBoundsError(100, 50)

      expect(error.code).toBe('INDEX_OUT_OF_BOUNDS')
      expect(error.index).toBe(100)
      expect(error.maxIndex).toBe(50)
    })
  })

  describe('isSightlineError', () => {
    it('should return true for SightlineError', () => {
      expect(isSightlineError(new SightlineError('CODE', 'msg'))).toBe(true)
    })

    it('should return false for regular Error', () => {
      expect(isSightlineError(new Error('msg'))).toBe(false)
    })

    it('should return false for non-error', () => {
      expect(isSightlineError('string')).toBe(false)
    })
  })

  describe('isRecoverableError', () => {
    it('should return true for StaleEpochError', () => {
      expect(isRecoverableError(new StaleEpochError(1, 2))).toBe(true)
    })

    it('should return true for ChildResolutionError', () => {
      expect(isRecoverableError(new ChildResolutionError('node'))).toBe(true)
    })

    it('should return false for RegistryCorruptedError', () => {
      expect(isRecoverableError(new RegistryCorruptedError('cycle'))).toBe(false)
    })
  })

  describe('isFatalError', () => {
    it('should return true for RegistryCorruptedError', () => {
      expect(isFatalError(new RegistryCorruptedError('cycle'))).toBe(true)
    })

    it('should return false for other errors', () => {
      expect(isFatalError(new StaleEpochError(1, 2))).toBe(false)
    })
  })

  describe('getErrorCode', () => {
    it('should return code for SightlineError', () => {
      expect(getErrorCode(new StaleEpochError(1, 2))).toBe('STALE_EPOCH')
    })

    it('should return UNKNOWN for regular Error', () => {
      expect(getErrorCode(new Error('msg'))).toBe('UNKNOWN')
    })
  })
})
