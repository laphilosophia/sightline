/**
 * Provider Tests
 */

import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createGlobalProvider, createProviderRegistry, triggerChildResolution } from '../provider'
import { addNode, createNode, createRegistry } from '../registry'
import type { NodeMetadata, NodeRegistry } from '../types'

describe('provider', () => {
  let registry: NodeRegistry

  beforeEach(() => {
    registry = createRegistry()
  })

  describe('createProviderRegistry', () => {
    it('should create empty registry', () => {
      const providers = createProviderRegistry()
      expect(providers.get('any')).toBeUndefined()
    })

    it('should register and retrieve provider', () => {
      const providers = createProviderRegistry()
      const mockProvider = { resolveChildren: vi.fn() }

      providers.register('node1', mockProvider)

      expect(providers.get('node1')).toBe(mockProvider)
    })

    it('should unregister provider', () => {
      const providers = createProviderRegistry()
      const mockProvider = { resolveChildren: vi.fn() }

      providers.register('node1', mockProvider)
      providers.unregister('node1')

      expect(providers.get('node1')).toBeUndefined()
    })
  })

  describe('triggerChildResolution', () => {
    it('should complete with empty children when no provider', async () => {
      const root = createNode('root')
      root.childState = 'LOADING'
      addNode(registry, root)

      const providers = createProviderRegistry()
      let epoch = 1

      const result = await triggerChildResolution(registry, providers, 'root', epoch, () => epoch)

      expect(result.success).toBe(true)
      expect(result.childCount).toBe(0)
      expect(registry.get('root')?.childState).toBe('EMPTY')
    })

    it('should resolve children from provider', async () => {
      const root = createNode('root')
      root.childState = 'LOADING'
      addNode(registry, root)

      const providers = createProviderRegistry()
      const mockChildren: NodeMetadata[] = [
        createNode('a', { parentNodeId: 'root', depth: 1, label: 'A' }),
        createNode('b', { parentNodeId: 'root', depth: 1, label: 'B' }),
      ]

      providers.register('root', {
        resolveChildren: vi.fn().mockResolvedValue(mockChildren),
      })

      let epoch = 1

      const result = await triggerChildResolution(registry, providers, 'root', epoch, () => epoch)

      expect(result.success).toBe(true)
      expect(result.childCount).toBe(2)
      expect(registry.has('a')).toBe(true)
      expect(registry.has('b')).toBe(true)
      expect(registry.get('root')?.childNodeIds).toEqual(['a', 'b'])
    })

    it('should discard on epoch mismatch', async () => {
      const root = createNode('root')
      root.childState = 'LOADING'
      addNode(registry, root)

      const providers = createProviderRegistry()
      const mockChildren: NodeMetadata[] = [createNode('a', { parentNodeId: 'root', depth: 1 })]

      providers.register('root', {
        resolveChildren: vi.fn().mockResolvedValue(mockChildren),
      })

      const capturedEpoch = 1
      let currentEpoch = 2 // Changed during resolution

      const result = await triggerChildResolution(
        registry,
        providers,
        'root',
        capturedEpoch,
        () => currentEpoch
      )

      expect(result.success).toBe(false)
      expect(result.error?.message).toContain('epoch mismatch')
    })

    it('should handle provider error', async () => {
      const root = createNode('root')
      root.childState = 'LOADING'
      addNode(registry, root)

      const providers = createProviderRegistry()
      providers.register('root', {
        resolveChildren: vi.fn().mockRejectedValue(new Error('Network error')),
      })

      let epoch = 1

      const result = await triggerChildResolution(registry, providers, 'root', epoch, () => epoch)

      expect(result.success).toBe(false)
      expect(result.error?.message).toBe('Network error')
      expect(registry.get('root')?.childState).toBe('ERROR')
    })
  })

  describe('createGlobalProvider', () => {
    it('should create provider from function', () => {
      const resolveFn = vi.fn().mockResolvedValue([])
      const provider = createGlobalProvider(resolveFn)

      expect(provider.resolveChildren).toBe(resolveFn)
    })
  })
})
