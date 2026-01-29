/**
 * Sightline Factory Tests
 */

import { beforeEach, describe, expect, it } from 'vitest'
import { addNode, createNode, createSightline, SightlineEngine } from '../index'

describe('SightlineEngine', () => {
  let engine: SightlineEngine

  beforeEach(() => {
    engine = createSightline()
  })

  describe('createSightline', () => {
    it('should create engine instance', () => {
      expect(engine).toBeInstanceOf(SightlineEngine)
    })

    it('should start with epoch 0', () => {
      expect(engine.getEpoch()).toBe(0)
    })

    it('should start with empty tree', () => {
      expect(engine.getTotalVisibleCount()).toBe(0)
      expect(engine.getRange(0, 10)).toEqual([])
    })
  })

  describe('getRegistry', () => {
    it('should return underlying registry', () => {
      const registry = engine.getRegistry()
      expect(registry).toBeDefined()
      expect(registry.size()).toBe(0)
    })

    it('should allow adding nodes directly', () => {
      const registry = engine.getRegistry()
      const root = createNode('root', { label: 'Root' })
      addNode(registry, root)

      expect(engine.getTotalVisibleCount()).toBe(1)
    })
  })

  describe('expand/collapse', () => {
    beforeEach(() => {
      const registry = engine.getRegistry()
      const root = createNode('root', { childNodeIds: ['a', 'b'], label: 'Root' })
      addNode(registry, root)

      addNode(registry, createNode('a', { parentNodeId: 'root', depth: 1, label: 'A' }))
      addNode(registry, createNode('b', { parentNodeId: 'root', depth: 1, label: 'B' }))
    })

    it('should expand and update visible count', () => {
      engine.expand('root')

      expect(engine.getTotalVisibleCount()).toBe(3)
      expect(engine.getEpoch()).toBe(1)
    })

    it('should collapse and update visible count', () => {
      engine.expand('root')
      engine.collapse('root')

      expect(engine.getTotalVisibleCount()).toBe(1)
      expect(engine.getEpoch()).toBe(2)
    })

    it('should return correct range after expand', () => {
      engine.expand('root')

      const range = engine.getRange(0, 10)

      expect(range).toHaveLength(3)
      expect(range.map((n) => n.label)).toEqual(['Root', 'A', 'B'])
    })
  })

  describe('telemetry', () => {
    it('should call onGetRange hook', () => {
      let called = false
      let hitSize = 0

      engine = createSightline({
        telemetry: {
          onGetRange(size, _latency) {
            called = true
            hitSize = size
          },
        },
      })

      const registry = engine.getRegistry()
      addNode(registry, createNode('root', { label: 'Root' }))

      engine.getRange(0, 10)

      expect(called).toBe(true)
      expect(hitSize).toBe(1)
    })

    it('should call onVisibleCountChange hook', () => {
      let oldCount = -1
      let newCount = -1

      engine = createSightline({
        telemetry: {
          onVisibleCountChange(old, next) {
            oldCount = old
            newCount = next
          },
        },
      })

      const registry = engine.getRegistry()
      const root = createNode('root', { childNodeIds: ['a'] })
      addNode(registry, root)
      addNode(registry, createNode('a', { parentNodeId: 'root', depth: 1 }))

      engine.expand('root')

      expect(oldCount).toBe(1)
      expect(newCount).toBe(2)
    })
  })

  describe('completeExpand', () => {
    it('should complete async expand', () => {
      const registry = engine.getRegistry()
      const root = createNode('root', { label: 'Root' })
      root.childState = 'LOADING'
      addNode(registry, root)

      const childA = createNode('a', { parentNodeId: 'root', depth: 1, label: 'A' })
      addNode(registry, childA)

      engine.completeExpand('root', ['a'])

      expect(registry.get('root')?.childState).toBe('RESOLVED')
      expect(registry.get('root')?.isExpanded).toBe(true)
      expect(engine.getEpoch()).toBe(1)
    })
  })

  describe('needsChildLoading', () => {
    it('should return true for UNRESOLVED', () => {
      const registry = engine.getRegistry()
      addNode(registry, createNode('root'))

      expect(engine.needsChildLoading('root')).toBe(true)
    })

    it('should return false for RESOLVED', () => {
      const registry = engine.getRegistry()
      addNode(registry, createNode('root', { childNodeIds: ['a'] }))

      expect(engine.needsChildLoading('root')).toBe(false)
    })
  })
})
