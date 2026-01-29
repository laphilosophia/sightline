/**
 * Registry Tests
 */

import { beforeEach, describe, expect, it } from 'vitest'
import { addNode, createNode, createRegistry, getRoot } from '../registry'
import type { NodeRegistry } from '../types'

describe('registry', () => {
  let registry: NodeRegistry

  beforeEach(() => {
    registry = createRegistry()
  })

  describe('createRegistry', () => {
    it('should create empty registry', () => {
      expect(registry.size()).toBe(0)
      expect(registry.getRootId()).toBeNull()
    })

    it('should support get/set/has/delete operations', () => {
      const node = createNode('a')

      registry.set('a', node)
      expect(registry.has('a')).toBe(true)
      expect(registry.get('a')).toBe(node)
      expect(registry.size()).toBe(1)

      registry.delete('a')
      expect(registry.has('a')).toBe(false)
      expect(registry.size()).toBe(0)
    })

    it('should support numeric NodeIDs', () => {
      const node = createNode(123)

      registry.set(123, node)
      expect(registry.has(123)).toBe(true)
      expect(registry.get(123)?.nodeId).toBe(123)
    })

    it('should iterate over values', () => {
      registry.set('a', createNode('a'))
      registry.set('b', createNode('b'))

      const ids = [...registry.values()].map((n) => n.nodeId)
      expect(ids).toContain('a')
      expect(ids).toContain('b')
    })
  })

  describe('createNode', () => {
    it('should create node with defaults', () => {
      const node = createNode('test')

      expect(node.nodeId).toBe('test')
      expect(node.parentNodeId).toBeNull()
      expect(node.childState).toBe('UNRESOLVED')
      expect(node.isExpanded).toBe(false)
      expect(node.visibleSubtreeSize).toBe(1)
      expect(node.depth).toBe(0)
    })

    it('should set childState to RESOLVED when childNodeIds provided', () => {
      const node = createNode('test', { childNodeIds: ['a', 'b'] })

      expect(node.childState).toBe('RESOLVED')
      expect(node.childNodeIds).toEqual(['a', 'b'])
    })

    it('should set childState to EMPTY when empty childNodeIds provided', () => {
      const node = createNode('test', { childNodeIds: [] })

      expect(node.childState).toBe('EMPTY')
    })

    it('should respect custom options', () => {
      const node = createNode('test', {
        parentNodeId: 'parent',
        label: 'Custom Label',
        depth: 3,
        isExpanded: true,
      })

      expect(node.parentNodeId).toBe('parent')
      expect(node.label).toBe('Custom Label')
      expect(node.depth).toBe(3)
      expect(node.isExpanded).toBe(true)
    })
  })

  describe('addNode', () => {
    it('should add node to registry', () => {
      const node = createNode('a')
      addNode(registry, node)

      expect(registry.has('a')).toBe(true)
    })

    it('should set root if parentNodeId is null and no root exists', () => {
      const root = createNode('root')
      addNode(registry, root)

      expect(registry.getRootId()).toBe('root')
    })

    it('should not override existing root', () => {
      const root1 = createNode('root1')
      const root2 = createNode('root2')

      addNode(registry, root1)
      addNode(registry, root2)

      expect(registry.getRootId()).toBe('root1')
    })

    it('should not set child node as root', () => {
      const child = createNode('child', { parentNodeId: 'parent' })
      addNode(registry, child)

      expect(registry.getRootId()).toBeNull()
    })
  })

  describe('getRoot', () => {
    it('should return undefined when no root', () => {
      expect(getRoot(registry)).toBeUndefined()
    })

    it('should return root node', () => {
      const root = createNode('root', { label: 'Root' })
      addNode(registry, root)

      expect(getRoot(registry)?.label).toBe('Root')
    })
  })
})
