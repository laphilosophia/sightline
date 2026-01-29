/**
 * Resolver Tests
 */

import { beforeEach, describe, expect, it } from 'vitest'
import { addNode, createNode, createRegistry } from '../registry'
import { getIndexOfNode, resolveIndex } from '../resolver'
import type { NodeRegistry } from '../types'

describe('resolver', () => {
  let registry: NodeRegistry

  beforeEach(() => {
    registry = createRegistry()
  })

  describe('resolveIndex', () => {
    it('should return null for empty registry', () => {
      expect(resolveIndex(registry, 0)).toBeNull()
    })

    it('should return null for negative index', () => {
      const root = createNode('root')
      addNode(registry, root)

      expect(resolveIndex(registry, -1)).toBeNull()
    })

    it('should return null for out of bounds index', () => {
      const root = createNode('root')
      addNode(registry, root)

      expect(resolveIndex(registry, 1)).toBeNull()
    })

    it('should resolve index 0 to root', () => {
      const root = createNode('root')
      addNode(registry, root)

      const result = resolveIndex(registry, 0)
      expect(result?.nodeId).toBe('root')
      expect(result?.depth).toBe(0)
    })

    it('should resolve in collapsed tree (only root visible)', () => {
      const root = createNode('root', { childNodeIds: ['a', 'b'] })
      addNode(registry, root)

      const childA = createNode('a', { parentNodeId: 'root', depth: 1 })
      const childB = createNode('b', { parentNodeId: 'root', depth: 1 })
      addNode(registry, childA)
      addNode(registry, childB)

      // Root is collapsed, only index 0 valid
      expect(resolveIndex(registry, 0)?.nodeId).toBe('root')
      expect(resolveIndex(registry, 1)).toBeNull()
    })

    it('should resolve children when expanded', () => {
      const root = createNode('root', { childNodeIds: ['a', 'b'], isExpanded: true })
      root.visibleSubtreeSize = 3 // self + 2 children
      addNode(registry, root)

      const childA = createNode('a', { parentNodeId: 'root', depth: 1 })
      const childB = createNode('b', { parentNodeId: 'root', depth: 1 })
      addNode(registry, childA)
      addNode(registry, childB)

      expect(resolveIndex(registry, 0)?.nodeId).toBe('root')
      expect(resolveIndex(registry, 1)?.nodeId).toBe('a')
      expect(resolveIndex(registry, 2)?.nodeId).toBe('b')
      expect(resolveIndex(registry, 3)).toBeNull()
    })

    it('should resolve in nested expanded tree', () => {
      // Structure:
      // root (0)
      //   a (1)
      //     a1 (2)
      //   b (3)

      const root = createNode('root', { childNodeIds: ['a', 'b'], isExpanded: true })
      root.visibleSubtreeSize = 4
      addNode(registry, root)

      const childA = createNode('a', {
        parentNodeId: 'root',
        depth: 1,
        childNodeIds: ['a1'],
        isExpanded: true,
      })
      childA.visibleSubtreeSize = 2
      addNode(registry, childA)

      const childA1 = createNode('a1', { parentNodeId: 'a', depth: 2 })
      addNode(registry, childA1)

      const childB = createNode('b', { parentNodeId: 'root', depth: 1 })
      addNode(registry, childB)

      expect(resolveIndex(registry, 0)?.nodeId).toBe('root')
      expect(resolveIndex(registry, 1)?.nodeId).toBe('a')
      expect(resolveIndex(registry, 2)?.nodeId).toBe('a1')
      expect(resolveIndex(registry, 3)?.nodeId).toBe('b')
    })

    it('should return correct depth', () => {
      const root = createNode('root', { childNodeIds: ['a'], isExpanded: true })
      root.visibleSubtreeSize = 3
      addNode(registry, root)

      const childA = createNode('a', {
        parentNodeId: 'root',
        depth: 1,
        childNodeIds: ['a1'],
        isExpanded: true,
      })
      childA.visibleSubtreeSize = 2
      addNode(registry, childA)

      const childA1 = createNode('a1', { parentNodeId: 'a', depth: 2 })
      addNode(registry, childA1)

      expect(resolveIndex(registry, 0)?.depth).toBe(0)
      expect(resolveIndex(registry, 1)?.depth).toBe(1)
      expect(resolveIndex(registry, 2)?.depth).toBe(2)
    })
  })

  describe('getIndexOfNode', () => {
    it('should return -1 for non-existent node', () => {
      expect(getIndexOfNode(registry, 'nonexistent')).toBe(-1)
    })

    it('should return 0 for root', () => {
      const root = createNode('root')
      addNode(registry, root)

      expect(getIndexOfNode(registry, 'root')).toBe(0)
    })

    it('should return -1 for hidden node (collapsed ancestor)', () => {
      const root = createNode('root', { childNodeIds: ['a'] })
      // root.isExpanded = false (default)
      addNode(registry, root)

      const childA = createNode('a', { parentNodeId: 'root', depth: 1 })
      addNode(registry, childA)

      expect(getIndexOfNode(registry, 'a')).toBe(-1)
    })

    it('should return correct index for visible children', () => {
      const root = createNode('root', { childNodeIds: ['a', 'b'], isExpanded: true })
      root.visibleSubtreeSize = 3
      addNode(registry, root)

      const childA = createNode('a', { parentNodeId: 'root', depth: 1 })
      const childB = createNode('b', { parentNodeId: 'root', depth: 1 })
      addNode(registry, childA)
      addNode(registry, childB)

      expect(getIndexOfNode(registry, 'a')).toBe(1)
      expect(getIndexOfNode(registry, 'b')).toBe(2)
    })

    it('should account for sibling subtree sizes', () => {
      // Structure:
      // root (0)
      //   a (1)
      //     a1 (2)
      //   b (3)

      const root = createNode('root', { childNodeIds: ['a', 'b'], isExpanded: true })
      root.visibleSubtreeSize = 4
      addNode(registry, root)

      const childA = createNode('a', {
        parentNodeId: 'root',
        depth: 1,
        childNodeIds: ['a1'],
        isExpanded: true,
      })
      childA.visibleSubtreeSize = 2
      addNode(registry, childA)

      const childA1 = createNode('a1', { parentNodeId: 'a', depth: 2 })
      addNode(registry, childA1)

      const childB = createNode('b', { parentNodeId: 'root', depth: 1 })
      addNode(registry, childB)

      expect(getIndexOfNode(registry, 'b')).toBe(3)
    })
  })
})
