/**
 * Controller Tests
 */

import { beforeEach, describe, expect, it } from 'vitest'
import { canCollapse, canExpand, collapse, completeExpand, expand, toggle } from '../controller'
import { addNode, createNode, createRegistry } from '../registry'
import type { NodeRegistry } from '../types'

describe('controller', () => {
  let registry: NodeRegistry

  beforeEach(() => {
    registry = createRegistry()
  })

  describe('expand', () => {
    it('should return failure for non-existent node', () => {
      const result = expand(registry, 'nonexistent')
      expect(result.success).toBe(false)
    })

    it('should return success if already expanded', () => {
      const node = createNode('root', { isExpanded: true })
      addNode(registry, node)

      const result = expand(registry, 'root')
      expect(result.success).toBe(true)
      expect(result.needsProvider).toBe(false)
    })

    it('should request provider for UNRESOLVED children', () => {
      const node = createNode('root') // childState = UNRESOLVED
      addNode(registry, node)

      const result = expand(registry, 'root')

      expect(result.success).toBe(true)
      expect(result.needsProvider).toBe(true)
      expect(registry.get('root')?.childState).toBe('LOADING')
    })

    it('should expand EMPTY node without provider', () => {
      const node = createNode('root', { childNodeIds: [] }) // childState = EMPTY
      addNode(registry, node)

      const result = expand(registry, 'root')

      expect(result.success).toBe(true)
      expect(result.needsProvider).toBe(false)
      expect(registry.get('root')?.isExpanded).toBe(true)
    })

    it('should expand RESOLVED node and recalculate', () => {
      const root = createNode('root', { childNodeIds: ['a', 'b'] })
      addNode(registry, root)

      const childA = createNode('a', { parentNodeId: 'root', depth: 1 })
      const childB = createNode('b', { parentNodeId: 'root', depth: 1 })
      addNode(registry, childA)
      addNode(registry, childB)

      const result = expand(registry, 'root')

      expect(result.success).toBe(true)
      expect(registry.get('root')?.isExpanded).toBe(true)
      expect(registry.get('root')?.visibleSubtreeSize).toBe(3)
    })
  })

  describe('completeExpand', () => {
    it('should handle provider error', () => {
      const node = createNode('root')
      node.childState = 'LOADING'
      addNode(registry, node)

      completeExpand(registry, 'root', [], new Error('Provider failed'))

      expect(registry.get('root')?.childState).toBe('ERROR')
      expect(registry.get('root')?.isExpanded).toBe(true)
    })

    it('should handle empty children', () => {
      const node = createNode('root')
      node.childState = 'LOADING'
      addNode(registry, node)

      completeExpand(registry, 'root', [])

      expect(registry.get('root')?.childState).toBe('EMPTY')
      expect(registry.get('root')?.isExpanded).toBe(true)
    })

    it('should resolve children and expand', () => {
      const root = createNode('root')
      root.childState = 'LOADING'
      addNode(registry, root)

      const childA = createNode('a', { parentNodeId: 'root', depth: 1 })
      const childB = createNode('b', { parentNodeId: 'root', depth: 1 })
      addNode(registry, childA)
      addNode(registry, childB)

      completeExpand(registry, 'root', ['a', 'b'])

      expect(registry.get('root')?.childState).toBe('RESOLVED')
      expect(registry.get('root')?.childNodeIds).toEqual(['a', 'b'])
      expect(registry.get('root')?.isExpanded).toBe(true)
      expect(registry.get('root')?.visibleSubtreeSize).toBe(3)
    })
  })

  describe('collapse', () => {
    it('should return false for non-existent node', () => {
      expect(collapse(registry, 'nonexistent')).toBe(false)
    })

    it('should return false if already collapsed', () => {
      const node = createNode('root')
      addNode(registry, node)

      expect(collapse(registry, 'root')).toBe(false)
    })

    it('should collapse and recalculate', () => {
      const root = createNode('root', { childNodeIds: ['a', 'b'], isExpanded: true })
      root.visibleSubtreeSize = 3
      addNode(registry, root)

      const childA = createNode('a', { parentNodeId: 'root', depth: 1 })
      const childB = createNode('b', { parentNodeId: 'root', depth: 1 })
      addNode(registry, childA)
      addNode(registry, childB)

      const result = collapse(registry, 'root')

      expect(result).toBe(true)
      expect(registry.get('root')?.isExpanded).toBe(false)
      expect(registry.get('root')?.visibleSubtreeSize).toBe(1)
    })
  })

  describe('toggle', () => {
    it('should expand collapsed node', () => {
      const node = createNode('root', { childNodeIds: ['a'] })
      addNode(registry, node)

      const childA = createNode('a', { parentNodeId: 'root', depth: 1 })
      addNode(registry, childA)

      const result = toggle(registry, 'root')

      expect(typeof result).toBe('object') // ExpandResult
      expect(registry.get('root')?.isExpanded).toBe(true)
    })

    it('should collapse expanded node', () => {
      const node = createNode('root', { childNodeIds: ['a'], isExpanded: true })
      node.visibleSubtreeSize = 2
      addNode(registry, node)

      const childA = createNode('a', { parentNodeId: 'root', depth: 1 })
      addNode(registry, childA)

      const result = toggle(registry, 'root')

      expect(result).toBe(true) // boolean from collapse
      expect(registry.get('root')?.isExpanded).toBe(false)
    })
  })

  describe('canExpand', () => {
    it('should return false for non-existent node', () => {
      expect(canExpand(registry, 'nonexistent')).toBe(false)
    })

    it('should return false if already expanded', () => {
      const node = createNode('root', { childNodeIds: ['a'], isExpanded: true })
      addNode(registry, node)

      expect(canExpand(registry, 'root')).toBe(false)
    })

    it('should return true for UNRESOLVED', () => {
      const node = createNode('root')
      addNode(registry, node)

      expect(canExpand(registry, 'root')).toBe(true)
    })

    it('should return true for RESOLVED with children', () => {
      const node = createNode('root', { childNodeIds: ['a'] })
      addNode(registry, node)

      expect(canExpand(registry, 'root')).toBe(true)
    })

    it('should return false for EMPTY', () => {
      const node = createNode('root', { childNodeIds: [] })
      addNode(registry, node)

      expect(canExpand(registry, 'root')).toBe(false)
    })
  })

  describe('canCollapse', () => {
    it('should return false for non-existent node', () => {
      expect(canCollapse(registry, 'nonexistent')).toBe(false)
    })

    it('should return false if collapsed', () => {
      const node = createNode('root')
      addNode(registry, node)

      expect(canCollapse(registry, 'root')).toBe(false)
    })

    it('should return true if expanded', () => {
      const node = createNode('root', { isExpanded: true })
      addNode(registry, node)

      expect(canCollapse(registry, 'root')).toBe(true)
    })
  })
})
