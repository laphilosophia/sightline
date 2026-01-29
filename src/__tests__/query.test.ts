/**
 * Query Tests
 */

import { beforeEach, describe, expect, it } from 'vitest'
import { getNodeView, getRange, getTotalVisibleCount } from '../query'
import { addNode, createNode, createRegistry } from '../registry'
import type { NodeRegistry } from '../types'

describe('query', () => {
  let registry: NodeRegistry

  beforeEach(() => {
    registry = createRegistry()
  })

  describe('getRange', () => {
    it('should return empty array for empty registry', () => {
      expect(getRange(registry, 0, 10)).toEqual([])
    })

    it('should return empty array for negative offset', () => {
      const root = createNode('root')
      addNode(registry, root)

      expect(getRange(registry, -1, 10)).toEqual([])
    })

    it('should return empty array for offset beyond visible count', () => {
      const root = createNode('root')
      addNode(registry, root)

      expect(getRange(registry, 1, 10)).toEqual([])
    })

    it('should return empty array for zero limit', () => {
      const root = createNode('root')
      addNode(registry, root)

      expect(getRange(registry, 0, 0)).toEqual([])
    })

    it('should return single node for collapsed tree', () => {
      const root = createNode('root', { label: 'Root' })
      addNode(registry, root)

      const result = getRange(registry, 0, 10)

      expect(result).toHaveLength(1)
      expect(result[0].nodeId).toBe('root')
      expect(result[0].label).toBe('Root')
      expect(result[0].depth).toBe(0)
      expect(result[0].isExpanded).toBe(false)
    })

    it('should return expanded children', () => {
      const root = createNode('root', { childNodeIds: ['a', 'b'], isExpanded: true, label: 'Root' })
      root.visibleSubtreeSize = 3
      addNode(registry, root)

      const childA = createNode('a', { parentNodeId: 'root', depth: 1, label: 'A' })
      const childB = createNode('b', { parentNodeId: 'root', depth: 1, label: 'B' })
      addNode(registry, childA)
      addNode(registry, childB)

      const result = getRange(registry, 0, 10)

      expect(result).toHaveLength(3)
      expect(result[0].label).toBe('Root')
      expect(result[1].label).toBe('A')
      expect(result[2].label).toBe('B')
    })

    it('should respect limit', () => {
      const root = createNode('root', { childNodeIds: ['a', 'b', 'c'], isExpanded: true })
      root.visibleSubtreeSize = 4
      addNode(registry, root)

      addNode(registry, createNode('a', { parentNodeId: 'root', depth: 1 }))
      addNode(registry, createNode('b', { parentNodeId: 'root', depth: 1 }))
      addNode(registry, createNode('c', { parentNodeId: 'root', depth: 1 }))

      const result = getRange(registry, 0, 2)

      expect(result).toHaveLength(2)
    })

    it('should respect offset', () => {
      const root = createNode('root', { childNodeIds: ['a', 'b'], isExpanded: true })
      root.visibleSubtreeSize = 3
      addNode(registry, root)

      addNode(registry, createNode('a', { parentNodeId: 'root', depth: 1, label: 'A' }))
      addNode(registry, createNode('b', { parentNodeId: 'root', depth: 1, label: 'B' }))

      const result = getRange(registry, 1, 10)

      expect(result).toHaveLength(2)
      expect(result[0].label).toBe('A')
      expect(result[1].label).toBe('B')
    })

    it('should work with nested expanded trees', () => {
      // root -> a -> a1, a2
      //      -> b
      const root = createNode('root', { childNodeIds: ['a', 'b'], isExpanded: true, label: 'Root' })
      root.visibleSubtreeSize = 5
      addNode(registry, root)

      const childA = createNode('a', {
        parentNodeId: 'root',
        depth: 1,
        childNodeIds: ['a1', 'a2'],
        isExpanded: true,
        label: 'A',
      })
      childA.visibleSubtreeSize = 3
      addNode(registry, childA)

      addNode(registry, createNode('a1', { parentNodeId: 'a', depth: 2, label: 'A1' }))
      addNode(registry, createNode('a2', { parentNodeId: 'a', depth: 2, label: 'A2' }))
      addNode(registry, createNode('b', { parentNodeId: 'root', depth: 1, label: 'B' }))

      const result = getRange(registry, 0, 10)

      expect(result).toHaveLength(5)
      expect(result.map((n) => n.label)).toEqual(['Root', 'A', 'A1', 'A2', 'B'])
    })

    it('should skip collapsed subtrees', () => {
      const root = createNode('root', { childNodeIds: ['a', 'b'], isExpanded: true, label: 'Root' })
      root.visibleSubtreeSize = 3
      addNode(registry, root)

      // 'a' has children but is collapsed
      const childA = createNode('a', {
        parentNodeId: 'root',
        depth: 1,
        childNodeIds: ['a1', 'a2'],
        isExpanded: false, // collapsed
        label: 'A',
      })
      childA.visibleSubtreeSize = 1
      addNode(registry, childA)

      addNode(registry, createNode('a1', { parentNodeId: 'a', depth: 2, label: 'A1' }))
      addNode(registry, createNode('a2', { parentNodeId: 'a', depth: 2, label: 'A2' }))
      addNode(registry, createNode('b', { parentNodeId: 'root', depth: 1, label: 'B' }))

      const result = getRange(registry, 0, 10)

      expect(result).toHaveLength(3)
      expect(result.map((n) => n.label)).toEqual(['Root', 'A', 'B'])
    })

    it('should set hasChildren correctly', () => {
      const root = createNode('root', { childNodeIds: ['a'] })
      addNode(registry, root)

      const child = createNode('a', { parentNodeId: 'root', depth: 1, childNodeIds: [] })
      addNode(registry, child)

      const result = getRange(registry, 0, 1)

      expect(result[0].hasChildren).toBe(true) // root has children
    })

    it('should set errorFlag for ERROR state', () => {
      const root = createNode('root')
      root.childState = 'ERROR'
      addNode(registry, root)

      const result = getRange(registry, 0, 1)

      expect(result[0].errorFlag).toBe(true)
    })

    it('should set loadingFlag for LOADING state', () => {
      const root = createNode('root')
      root.childState = 'LOADING'
      addNode(registry, root)

      const result = getRange(registry, 0, 1)

      expect(result[0].loadingFlag).toBe(true)
    })
  })

  describe('getTotalVisibleCount', () => {
    it('should return 0 for empty registry', () => {
      expect(getTotalVisibleCount(registry)).toBe(0)
    })

    it('should return root visibleSubtreeSize', () => {
      const root = createNode('root', { childNodeIds: ['a', 'b'], isExpanded: true })
      root.visibleSubtreeSize = 5
      addNode(registry, root)

      expect(getTotalVisibleCount(registry)).toBe(5)
    })
  })

  describe('getNodeView', () => {
    it('should return null for non-existent node', () => {
      expect(getNodeView(registry, 'nonexistent')).toBeNull()
    })

    it('should return NodeView for existing node', () => {
      const node = createNode('root', { label: 'Test', isExpanded: true })
      addNode(registry, node)

      const view = getNodeView(registry, 'root')

      expect(view).not.toBeNull()
      expect(view?.label).toBe('Test')
      expect(view?.isExpanded).toBe(true)
    })
  })
})
