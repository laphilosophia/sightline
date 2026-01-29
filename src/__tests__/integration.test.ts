/**
 * Integration Tests - End-to-End Scenarios
 *
 * Tests complete workflows from tree construction through querying.
 */

import { beforeEach, describe, expect, it } from 'vitest'
import { addNode, createNode, createSightline, SightlineEngine } from '../index'

describe('integration', () => {
  let engine: SightlineEngine

  beforeEach(() => {
    engine = createSightline()
  })

  describe('basic tree operations', () => {
    it('should handle complete expand → collapse → query cycle', () => {
      const registry = engine.getRegistry()

      // Build tree: root -> a, b, c
      const root = createNode('root', {
        childNodeIds: ['a', 'b', 'c'],
        label: 'Root',
      })
      addNode(registry, root)

      addNode(registry, createNode('a', { parentNodeId: 'root', depth: 1, label: 'A' }))
      addNode(registry, createNode('b', { parentNodeId: 'root', depth: 1, label: 'B' }))
      addNode(registry, createNode('c', { parentNodeId: 'root', depth: 1, label: 'C' }))

      // Initial state: only root visible
      expect(engine.getTotalVisibleCount()).toBe(1)
      expect(engine.getRange(0, 10)).toHaveLength(1)

      // Expand
      engine.expand('root')
      expect(engine.getTotalVisibleCount()).toBe(4)
      expect(engine.getEpoch()).toBe(1)

      const expanded = engine.getRange(0, 10)
      expect(expanded.map((n) => n.label)).toEqual(['Root', 'A', 'B', 'C'])

      // Collapse
      engine.collapse('root')
      expect(engine.getTotalVisibleCount()).toBe(1)
      expect(engine.getEpoch()).toBe(2)
    })

    it('should handle nested expand operations', () => {
      const registry = engine.getRegistry()

      // Build nested tree
      addNode(registry, createNode('root', { childNodeIds: ['a', 'b'], label: 'Root' }))
      addNode(
        registry,
        createNode('a', {
          parentNodeId: 'root',
          depth: 1,
          childNodeIds: ['a1', 'a2'],
          label: 'A',
        })
      )
      addNode(registry, createNode('b', { parentNodeId: 'root', depth: 1, label: 'B' }))
      addNode(registry, createNode('a1', { parentNodeId: 'a', depth: 2, label: 'A1' }))
      addNode(registry, createNode('a2', { parentNodeId: 'a', depth: 2, label: 'A2' }))

      // Expand root
      engine.expand('root')
      expect(engine.getTotalVisibleCount()).toBe(3) // root + a + b

      // Expand a
      engine.expand('a')
      expect(engine.getTotalVisibleCount()).toBe(5) // root + a + a1 + a2 + b

      const range = engine.getRange(0, 10)
      expect(range.map((n) => n.label)).toEqual(['Root', 'A', 'A1', 'A2', 'B'])

      // Check depths
      expect(range[0].depth).toBe(0) // Root
      expect(range[1].depth).toBe(1) // A
      expect(range[2].depth).toBe(2) // A1
    })

    it('should handle range pagination', () => {
      const registry = engine.getRegistry()

      // Create flat list of 10 children
      const childIds = Array.from({ length: 10 }, (_, i) => `child-${i}`)
      addNode(
        registry,
        createNode('root', {
          childNodeIds: childIds,
          isExpanded: true,
          label: 'Root',
        })
      )
      // Set correct size
      registry.get('root')!.visibleSubtreeSize = 11

      childIds.forEach((id, i) => {
        addNode(
          registry,
          createNode(id, {
            parentNodeId: 'root',
            depth: 1,
            label: `Child ${i}`,
          })
        )
      })

      // Get first page
      const page1 = engine.getRange(0, 5)
      expect(page1).toHaveLength(5)
      expect(page1[0].label).toBe('Root')
      expect(page1[4].label).toBe('Child 3')

      // Get second page
      const page2 = engine.getRange(5, 5)
      expect(page2).toHaveLength(5)
      expect(page2[0].label).toBe('Child 4')
      expect(page2[4].label).toBe('Child 8')

      // Get last page
      const page3 = engine.getRange(10, 5)
      expect(page3).toHaveLength(1)
      expect(page3[0].label).toBe('Child 9')
    })
  })

  describe('state consistency', () => {
    it('should maintain consistent subtree sizes', () => {
      const registry = engine.getRegistry()

      addNode(registry, createNode('root', { childNodeIds: ['a', 'b'], label: 'Root' }))
      addNode(
        registry,
        createNode('a', {
          parentNodeId: 'root',
          depth: 1,
          childNodeIds: ['a1'],
          label: 'A',
        })
      )
      addNode(registry, createNode('b', { parentNodeId: 'root', depth: 1, label: 'B' }))
      addNode(registry, createNode('a1', { parentNodeId: 'a', depth: 2, label: 'A1' }))

      // Expand all
      engine.expand('root')
      engine.expand('a')

      expect(engine.getTotalVisibleCount()).toBe(4) // root + a + a1 + b

      // Collapse a
      engine.collapse('a')
      expect(engine.getTotalVisibleCount()).toBe(3) // root + a + b

      // Re-expand a
      engine.expand('a')
      expect(engine.getTotalVisibleCount()).toBe(4)
    })

    it('should handle numeric nodeIds', () => {
      const registry = engine.getRegistry()

      addNode(registry, createNode(1, { childNodeIds: [2, 3], label: 'Root' }))
      addNode(registry, createNode(2, { parentNodeId: 1, depth: 1, label: 'Two' }))
      addNode(registry, createNode(3, { parentNodeId: 1, depth: 1, label: 'Three' }))

      engine.expand(1)

      const range = engine.getRange(0, 10)
      expect(range).toHaveLength(3)
      expect(range.map((n) => n.nodeId)).toEqual([1, 2, 3])
    })
  })

  describe('edge cases', () => {
    it('should handle empty tree', () => {
      expect(engine.getTotalVisibleCount()).toBe(0)
      expect(engine.getRange(0, 10)).toEqual([])
      expect(engine.getEpoch()).toBe(0)
    })

    it('should handle single node tree', () => {
      addNode(engine.getRegistry(), createNode('root', { label: 'Root' }))

      expect(engine.getTotalVisibleCount()).toBe(1)

      const range = engine.getRange(0, 10)
      expect(range).toHaveLength(1)
      expect(range[0].hasChildren).toBe(true) // UNRESOLVED means might have children
    })

    it('should handle leaf nodes correctly', () => {
      const registry = engine.getRegistry()

      addNode(registry, createNode('root', { childNodeIds: ['leaf'], label: 'Root' }))
      addNode(
        registry,
        createNode('leaf', {
          parentNodeId: 'root',
          depth: 1,
          childNodeIds: [], // Explicitly empty
          label: 'Leaf',
        })
      )

      engine.expand('root')

      const range = engine.getRange(0, 10)
      expect(range[1].hasChildren).toBe(false) // EMPTY state
    })

    it('should handle expand on non-existent node', () => {
      engine.expand('nonexistent')
      expect(engine.getEpoch()).toBe(0) // No change
    })

    it('should handle collapse on already collapsed node', () => {
      addNode(engine.getRegistry(), createNode('root'))

      engine.collapse('root')
      expect(engine.getEpoch()).toBe(0) // No change
    })
  })
})
