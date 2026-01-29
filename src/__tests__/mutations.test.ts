/**
 * Mutations Tests
 */

import { beforeEach, describe, expect, it } from 'vitest'
import { insertNode, moveNode, removeNode, reorderChildren } from '../mutations'
import { addNode, createNode, createRegistry } from '../registry'
import type { NodeRegistry } from '../types'

describe('mutations', () => {
  let registry: NodeRegistry

  beforeEach(() => {
    registry = createRegistry()
  })

  describe('reorderChildren', () => {
    it('should reorder children within parent', () => {
      addNode(registry, createNode('root', { childNodeIds: ['a', 'b', 'c'] }))
      addNode(registry, createNode('a', { parentNodeId: 'root', depth: 1 }))
      addNode(registry, createNode('b', { parentNodeId: 'root', depth: 1 }))
      addNode(registry, createNode('c', { parentNodeId: 'root', depth: 1 }))

      const result = reorderChildren(registry, 'root', ['c', 'a', 'b'])

      expect(result).toBe(true)
      expect(registry.get('root')?.childNodeIds).toEqual(['c', 'a', 'b'])
    })

    it('should reject if parent not found', () => {
      expect(reorderChildren(registry, 'missing', ['a', 'b'])).toBe(false)
    })

    it('should reject if new order has different IDs', () => {
      addNode(registry, createNode('root', { childNodeIds: ['a', 'b'] }))

      expect(reorderChildren(registry, 'root', ['a', 'c'])).toBe(false)
      expect(reorderChildren(registry, 'root', ['a'])).toBe(false)
      expect(reorderChildren(registry, 'root', ['a', 'b', 'c'])).toBe(false)
    })
  })

  describe('moveNode', () => {
    beforeEach(() => {
      // Tree: root -> folder1 -> file1, folder2
      addNode(
        registry,
        createNode('root', { childNodeIds: ['folder1', 'folder2'], isExpanded: true })
      )
      addNode(
        registry,
        createNode('folder1', {
          parentNodeId: 'root',
          depth: 1,
          childNodeIds: ['file1'],
          isExpanded: true,
        })
      )
      addNode(registry, createNode('folder2', { parentNodeId: 'root', depth: 1, childNodeIds: [] }))
      addNode(
        registry,
        createNode('file1', { parentNodeId: 'folder1', depth: 2, childNodeIds: [] })
      )

      // Set correct sizes
      const root = registry.get('root')
      const folder1 = registry.get('folder1')
      if (root) root.visibleSubtreeSize = 4
      if (folder1) folder1.visibleSubtreeSize = 2
    })

    it('should move node to different parent', () => {
      const result = moveNode(registry, 'file1', 'folder2')

      expect(result).toBe(true)
      expect(registry.get('file1')?.parentNodeId).toBe('folder2')
      expect(registry.get('folder1')?.childNodeIds).toEqual([])
      expect(registry.get('folder2')?.childNodeIds).toEqual(['file1'])
    })

    it('should update depth when moving', () => {
      // Add nested structure
      addNode(registry, createNode('deep', { parentNodeId: 'folder2', depth: 2, childNodeIds: [] }))
      const folder2 = registry.get('folder2')
      if (folder2) folder2.childNodeIds = ['deep']

      moveNode(registry, 'file1', 'deep')

      expect(registry.get('file1')?.depth).toBe(3)
    })

    it('should reject moving to descendant (cycle prevention)', () => {
      const result = moveNode(registry, 'folder1', 'file1')

      expect(result).toBe(false)
    })

    it('should reject moving root', () => {
      const result = moveNode(registry, 'root', 'folder1')

      expect(result).toBe(false)
    })

    it('should insert at specific index', () => {
      addNode(
        registry,
        createNode('file2', { parentNodeId: 'folder2', depth: 2, childNodeIds: [] })
      )
      const folder2 = registry.get('folder2')
      if (folder2) folder2.childNodeIds = ['file2']

      moveNode(registry, 'file1', 'folder2', 0)

      expect(registry.get('folder2')?.childNodeIds).toEqual(['file1', 'file2'])
    })
  })

  describe('removeNode', () => {
    beforeEach(() => {
      addNode(registry, createNode('root', { childNodeIds: ['a'], isExpanded: true }))
      addNode(
        registry,
        createNode('a', { parentNodeId: 'root', depth: 1, childNodeIds: ['a1', 'a2'] })
      )
      addNode(registry, createNode('a1', { parentNodeId: 'a', depth: 2, childNodeIds: [] }))
      addNode(registry, createNode('a2', { parentNodeId: 'a', depth: 2, childNodeIds: [] }))
    })

    it('should remove node and subtree', () => {
      const removed = removeNode(registry, 'a')

      expect(removed).toBe(3) // a, a1, a2
      expect(registry.has('a')).toBe(false)
      expect(registry.has('a1')).toBe(false)
      expect(registry.has('a2')).toBe(false)
      expect(registry.get('root')?.childNodeIds).toEqual([])
    })

    it('should not remove root', () => {
      const removed = removeNode(registry, 'root')

      expect(removed).toBe(0)
      expect(registry.has('root')).toBe(true)
    })

    it('should return 0 for non-existent node', () => {
      expect(removeNode(registry, 'missing')).toBe(0)
    })
  })

  describe('insertNode', () => {
    beforeEach(() => {
      addNode(registry, createNode('root', { childNodeIds: ['a'], isExpanded: true }))
      addNode(registry, createNode('a', { parentNodeId: 'root', depth: 1 }))
    })

    it('should insert node at end', () => {
      addNode(registry, createNode('b', { parentNodeId: 'root', depth: 1 }))

      const result = insertNode(registry, 'root', 'b')

      expect(result).toBe(true)
      expect(registry.get('root')?.childNodeIds).toEqual(['a', 'b'])
    })

    it('should insert node at specific index', () => {
      addNode(registry, createNode('b', { parentNodeId: 'root', depth: 1 }))

      insertNode(registry, 'root', 'b', 0)

      expect(registry.get('root')?.childNodeIds).toEqual(['b', 'a'])
    })

    it('should reject if parent mismatch', () => {
      addNode(registry, createNode('b', { parentNodeId: 'a', depth: 2 }))

      const result = insertNode(registry, 'root', 'b')

      expect(result).toBe(false)
    })
  })
})
