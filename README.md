# Sightline

> **Projection-Based Tree Virtualization Engine**

[![TypeScript](https://img.shields.io/badge/TypeScript-5.3-blue.svg)](https://www.typescriptlang.org/)
[![License](https://img.shields.io/badge/License-MIT-yellow.svg)](./LICENSE)

---

## What is Sightline?

Sightline is a **framework-agnostic tree virtualization engine** that renders GB-scale object trees with constant UI overhead.

**Core Principle:** The UI never sees the tree. The UI only sees an addressable, windowed projection.

---

## Why Sightline?

| Problem         | Traditional Approach | Sightline                |
| --------------- | -------------------- | ------------------------ |
| 1M node tree    | Load all → crash     | Load visible → 200 nodes |
| Deep nesting    | Recursive render     | Flat sequence            |
| Expand/Collapse | Re-render subtree    | Local update             |
| Memory          | O(total)             | O(visible)               |

---

## Key Features

- ⚡ **O(log n) index resolution** — Prefix-sum implicit traversal
- 🎯 **O(1) node lookup** — NodeID registry
- 📊 **Range Query API** — `getRange(offset, limit)`
- 🔧 **Worker-based state** — UI thread stays free
- 🎨 **Framework agnostic** — React, Vue, Canvas, Terminal

---

## Status

| Phase              | Status                                                                                                          |
| ------------------ | --------------------------------------------------------------------------------------------------------------- |
| RFC                | ✅ [RFC-0003](https://github.com/laphilosophia/volta-next/blob/main/docs/rfc/0003-projection-virtualization.md) |
| PoC Implementation | 🔄 In Progress                                                                                                  |
| Test Coverage      | 🔲 Target: 80%+                                                                                                 |
| Graduation         | 🔲 → `@voltakit/virtual`                                                                                        |

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
│  │ Map<ID,Node>│  │ Size Calculator │  │ API            │   │
│  └─────────────┘  └─────────────────┘  └────────────────┘   │
└─────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────┐
│                     UI LAYER                                 │
│  Receives only: NodeView[] (flat, minimal, immutable)       │
└─────────────────────────────────────────────────────────────┘
```

---

## API

```typescript
import { createSightline } from 'sightline'

const sightline = createSightline(sourceTree)

// Range query — the ONLY way UI gets data
const views = sightline.getRange(0, 50)

// Expand/Collapse
sightline.expand(nodeId)
sightline.collapse(nodeId)

// Total visible count for scrollbar
const total = sightline.getTotalVisibleCount()
```

---

## NodeView

```typescript
interface NodeView {
  nodeId: NodeID
  depth: number // for indentation
  isExpanded: boolean
  hasChildren: boolean
  label: string
  // NO child arrays
  // NO raw payloads
  // NO object graphs
}
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

## Graduation Path

Sightline is a PoC incubation project for the [Volta Platform Engine](https://github.com/laphilosophia/volta-next). Upon reaching maturity (80% test coverage, stable API), it will graduate to `@voltakit/virtual`.

---

## License

MIT
