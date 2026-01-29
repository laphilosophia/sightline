# Sightline

> **Projection-Based Tree Virtualization Engine**

[![TypeScript](https://img.shields.io/badge/TypeScript-5.3-blue.svg)](https://www.typescriptlang.org/)
[![License](https://img.shields.io/badge/License-MIT-yellow.svg)](./LICENSE)
[![Tests](https://img.shields.io/badge/Tests-123%20passing-brightgreen.svg)]()

---

## What is Sightline?

Sightline is a **framework-agnostic tree virtualization engine** that renders GB-scale object trees with constant UI overhead.

**Core Principle:** The UI never sees the tree. The UI only sees an addressable, windowed projection.

---

## Why Sightline?

| Problem         | Traditional Approach | Sightline               |
| --------------- | -------------------- | ----------------------- |
| 1M node tree    | Load all → crash     | Load visible → 50 nodes |
| Deep nesting    | Recursive render     | Flat sequence           |
| Expand/Collapse | Re-render subtree    | Local update            |
| Memory          | O(total)             | O(visible)              |

---

## Benchmark

Tested with 189MB GeoJSON (San Francisco City Lots):

| Metric                        | Value   |
| ----------------------------- | ------- |
| **Total Nodes**               | 211,887 |
| **Tree Build**                | 200ms   |
| **getRange(0, 50)**           | 0.01ms  |
| **getRange(5000, 50)**        | 0.28ms  |
| **Block Expand (2,294 lots)** | 2.09ms  |
| **Heap Used**                 | 540 MB  |

Sub-millisecond range queries on 200K+ node trees.

---

## Installation

```bash
pnpm add sightline
# or
npm install sightline
```

---

## Quick Start

```typescript
import { createSightline, createNode, addNode } from 'sightline'

// Create engine
const engine = createSightline()
const registry = engine.getRegistry()

// Build tree
const root = createNode('root', {
  childNodeIds: ['a', 'b', 'c'],
  label: 'Root',
})
addNode(registry, root)

addNode(registry, createNode('a', { parentNodeId: 'root', depth: 1, label: 'A' }))
addNode(registry, createNode('b', { parentNodeId: 'root', depth: 1, label: 'B' }))
addNode(registry, createNode('c', { parentNodeId: 'root', depth: 1, label: 'C' }))

// Query (collapsed - only root visible)
engine.getRange(0, 50) // → [{ nodeId: 'root', ... }]

// Expand
engine.expand('root')
engine.getRange(0, 50) // → [root, A, B, C]

// Collapse
engine.collapse('root')
engine.getRange(0, 50) // → [root]

// Total for scrollbar
engine.getTotalVisibleCount() // → 1 (collapsed) or 4 (expanded)
```

---

## Core API

### SightlineEngine

```typescript
interface Sightline {
  getRange(offset: number, limit: number): NodeView[]
  expand(nodeId: NodeID): void
  collapse(nodeId: NodeID): void
  getTotalVisibleCount(): number
  getEpoch(): MutationEpoch
}
```

### NodeView (UI Payload)

```typescript
interface NodeView {
  readonly nodeId: NodeID
  readonly depth: number // For indentation
  readonly isExpanded: boolean
  readonly hasChildren: boolean
  readonly label: string
  readonly errorFlag?: boolean
  readonly loadingFlag?: boolean
  // NO child arrays
  // NO object graphs
}
```

### Lazy Loading

```typescript
import { createProviderRegistry, triggerChildResolution } from 'sightline'

const providers = createProviderRegistry()

// Register provider for lazy nodes
providers.register('folder-1', {
  async resolveChildren(nodeId) {
    const children = await fetchChildrenFromAPI(nodeId)
    return children.map(c => createNode(c.id, { ... }))
  }
})

// Trigger when expanding UNRESOLVED node
const result = engine.expand('folder-1')
if (result.needsProvider) {
  await triggerChildResolution(registry, providers, 'folder-1', epoch, getEpoch)
}
```

---

## Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                     SOURCE DATA                              │
│  (GB-scale JSON, RenderTree, any tree structure)            │
└─────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────┐
│                    SIGHTLINE ENGINE                          │
│  ┌─────────────┐  ┌─────────────────┐  ┌────────────────┐   │
│  │ NodeRegistry │  │VisibleSubtree  │  │ Range Query    │   │
│  │ Map<ID,Node> │  │ Size Propagator │  │ O(log n)       │   │
│  └─────────────┘  └─────────────────┘  └────────────────┘   │
└─────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────┐
│                     UI LAYER                                 │
│  Receives only: NodeView[] (flat, minimal, immutable)       │
└─────────────────────────────────────────────────────────────┘
```

### Key Algorithms

| Module           | Complexity | Purpose                                |
| ---------------- | ---------- | -------------------------------------- |
| `resolver.ts`    | O(log n)   | Index → NodeID via prefix-sum          |
| `propagation.ts` | O(depth)   | visibleSubtreeSize delta propagation   |
| `query.ts`       | O(window)  | Range collection with subtree skipping |
| `registry.ts`    | O(1)       | Map-based node storage                 |

---

## Error Handling

```typescript
import {
  SightlineError,
  StaleEpochError,
  ChildResolutionError,
  RegistryCorruptedError,
  isRecoverableError,
  isFatalError,
} from 'sightline'

try {
  await resolveChildren(nodeId)
} catch (error) {
  if (isRecoverableError(error)) {
    // Show error state on node
  } else if (isFatalError(error)) {
    // Freeze tree, prevent further operations
  }
}
```

---

## Telemetry

```typescript
const engine = createSightline({
  telemetry: {
    onGetRange(hitSize, latencyMs) {
      metrics.recordLatency('sightline.getRange', latencyMs)
    },
    onVisibleCountChange(oldCount, newCount) {
      console.log(`Visible: ${oldCount} → ${newCount}`)
    },
  },
})
```

---

## Anti-Patterns

These approaches are explicitly rejected:

| ❌ Don't                      | Why                 |
| ----------------------------- | ------------------- |
| Make tree reactive/observable | State sync overhead |
| Store UI state per node       | Memory explosion    |
| Clone JSON for UI             | Unnecessary copies  |
| Assume Virtual DOM solves it  | Wrong abstraction   |

---

## Design Decisions

### Why No Cursor API?

Cursor (prev/next/position) is **UI state**, not kernel concern. Framework bindings handle cursor:

```typescript
// In @voltakit/virtual (not Sightline):
const { position, items } = useSightlineCursor(engine, windowSize)
```

### Why No Mutation Methods?

Mutations flow through execution layer (Sthira), not direct imperative calls:

```
UI Intent → Sthira → Worker → Registry mutate → Epoch++ → UI re-query
```

---

## Modules

| File             | Exports                                            | Purpose                   |
| ---------------- | -------------------------------------------------- | ------------------------- |
| `types.ts`       | Types                                              | Core type definitions     |
| `registry.ts`    | `createRegistry`, `createNode`, `addNode`          | O(1) node storage         |
| `resolver.ts`    | `resolveIndex`, `getIndexOfNode`                   | Index resolution          |
| `propagation.ts` | `recalculateAndPropagate`                          | Subtree size updates      |
| `controller.ts`  | `expand`, `collapse`, `toggle`                     | Visibility control        |
| `query.ts`       | `getRange`, `getTotalVisibleCount`                 | Range queries             |
| `provider.ts`    | `createProviderRegistry`, `triggerChildResolution` | Lazy loading              |
| `errors.ts`      | Error classes                                      | Structured error handling |
| `index.ts`       | `createSightline`, `SightlineEngine`               | Public API                |

---

## Status

| Phase             | Status                   |
| ----------------- | ------------------------ |
| Core Engine       | ✅ Complete (123 tests)  |
| Stress Test       | ✅ 211K nodes validated  |
| TypeScript Strict | ✅ Clean                 |
| ESLint            | ✅ Clean                 |
| Documentation     | ✅ Complete              |
| Graduation        | 🔲 → `@voltakit/virtual` |

---

## Graduation Path

Sightline is a PoC incubation project for the [Volta Platform Engine](https://github.com/laphilosophia/volta-next). Upon graduation, it becomes `@voltakit/virtual`.

---

## License

MIT
