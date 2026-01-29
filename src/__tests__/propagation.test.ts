/**
 * Propagation Tests
 */

import { beforeEach, describe, expect, it } from 'vitest'
import {
  propagateSizeChange,
  recalculateAndPropagate,
  recalculateSubtreeSize,
} from '../propagation'
import { addNode, createNode, createRegistry } from '../registry'
import type { NodeRegistry } from '../types'

describe('propagation', () => {
  let registry: NodeRegistry

  beforeEach(() => {
    registry = createRegistry()
  })

  describe('recalculateSubtreeSize', () => {
    it('should return 1 for collapsed node', () => {
      const node = createNode('root', { childNodeIds: ['a', 'b'] })
      // isExpanded = false by default
      addNode(registry, node)

      expect(recalculateSubtreeSize(registry, 'root')).toBe(1)
      expect(registry.get('root')?.visibleSubtreeSize).toBe(1)
    })

    it('should return 1 for leaf node', () => {
      const node = createNode('leaf', { childNodeIds: [] })
      addNode(registry, node)

      expect(recalculateSubtreeSize(registry, 'leaf')).toBe(1)
    })

    it('should sum children when expanded', () => {
      const root = createNode('root', { childNodeIds: ['a', 'b'], isExpanded: true })
      addNode(registry, root)

      const childA = createNode('a', { parentNodeId: 'root', depth: 1 })
      const childB = createNode('b', { parentNodeId: 'root', depth: 1 })
      addNode(registry, childA)
      addNode(registry, childB)

      expect(recalculateSubtreeSize(registry, 'root')).toBe(3) // 1 + 1 + 1
    })

    it('should respect nested expanded children', () => {
      const root = createNode('root', { childNodeIds: ['a'], isExpanded: true })
      addNode(registry, root)

      const childA = createNode('a', {
        parentNodeId: 'root',
        depth: 1,
        childNodeIds: ['a1'],
        isExpanded: true,
      })
      childA.visibleSubtreeSize = 2 // Pre-calculated
      addNode(registry, childA)

      const childA1 = createNode('a1', { parentNodeId: 'a', depth: 2 })
      addNode(registry, childA1)

      expect(recalculateSubtreeSize(registry, 'root')).toBe(3) // 1 + 2
    })

    it('should return 0 for non-existent node', () => {
      expect(recalculateSubtreeSize(registry, 'nonexistent')).toBe(0)
    })
  })

  describe('propagateSizeChange', () => {
    it('should do nothing for delta 0', () => {
      const root = createNode('root')
      root.visibleSubtreeSize = 5
      addNode(registry, root)

      propagateSizeChange(registry, 'root', 0)
      expect(registry.get('root')?.visibleSubtreeSize).toBe(5)
    })

    it('should update all ancestors', () => {
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

      // Simulate expanding a1's children (delta +2)
      propagateSizeChange(registry, 'a1', 2)

      expect(registry.get('a')?.visibleSubtreeSize).toBe(4) // 2 + 2
      expect(registry.get('root')?.visibleSubtreeSize).toBe(5) // 3 + 2
    })

    it('should handle negative delta (collapse)', () => {
      const root = createNode('root', { childNodeIds: ['a'], isExpanded: true })
      root.visibleSubtreeSize = 5
      addNode(registry, root)

      const childA = createNode('a', { parentNodeId: 'root', depth: 1 })
      childA.visibleSubtreeSize = 4
      addNode(registry, childA)

      // Simulate collapsing a (loses 3 visible children)
      propagateSizeChange(registry, 'a', -3)

      expect(registry.get('root')?.visibleSubtreeSize).toBe(2) // 5 - 3
    })
  })

  describe('recalculateAndPropagate', () => {
    it('should recalculate and propagate in one call', () => {
      const root = createNode('root', { childNodeIds: ['a'], isExpanded: true })
      root.visibleSubtreeSize = 2
      addNode(registry, root)

      const childA = createNode('a', {
        parentNodeId: 'root',
        depth: 1,
        childNodeIds: ['a1', 'a2'],
        isExpanded: false,
      })
      childA.visibleSubtreeSize = 1
      addNode(registry, childA)

      const childA1 = createNode('a1', { parentNodeId: 'a', depth: 2 })
      const childA2 = createNode('a2', { parentNodeId: 'a', depth: 2 })
      addNode(registry, childA1)
      addNode(registry, childA2)

      // Expand childA
      const nodeA = registry.get('a')
      if (nodeA) nodeA.isExpanded = true

      const newSize = recalculateAndPropagate(registry, 'a')

      expect(newSize).toBe(3) // 1 + 1 + 1
      expect(registry.get('a')?.visibleSubtreeSize).toBe(3)
      expect(registry.get('root')?.visibleSubtreeSize).toBe(4) // was 2, delta +2
    })

    it('should handle collapse correctly', () => {
      const root = createNode('root', { childNodeIds: ['a'], isExpanded: true })
      root.visibleSubtreeSize = 4
      addNode(registry, root)

      const childA = createNode('a', {
        parentNodeId: 'root',
        depth: 1,
        childNodeIds: ['a1', 'a2'],
        isExpanded: true,
      })
      childA.visibleSubtreeSize = 3
      addNode(registry, childA)

      const childA1 = createNode('a1', { parentNodeId: 'a', depth: 2 })
      const childA2 = createNode('a2', { parentNodeId: 'a', depth: 2 })
      addNode(registry, childA1)
      addNode(registry, childA2)

      // Collapse childA
      const nodeA = registry.get('a')
      if (nodeA) nodeA.isExpanded = false

      const newSize = recalculateAndPropagate(registry, 'a')

      expect(newSize).toBe(1)
      expect(registry.get('a')?.visibleSubtreeSize).toBe(1)
      expect(registry.get('root')?.visibleSubtreeSize).toBe(2) // 4 - 2
    })
  })
})
