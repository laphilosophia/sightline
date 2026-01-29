# Project Sightline

> **Status:** Draft
> **Created:** 2026-01-29
> **Author:** Erdem Arslan

---

## Abstract

This RFC defines the technical architecture for rendering GB-scale JSON-derived object tree structures in a framework-agnostic, pagination-native, and low-overhead manner on the UI side.

**Core Principle:** The goal is not to virtualize the tree itself, but to virtualize a UI-meaningful projection of the tree.

---

## Problem Statement

The fundamental problem is not UI performance — the problem is presenting data structures to the UI with the wrong abstraction.

**The tree is never given to the UI. The UI is only given an addressable, windowed view.**

---

## Architectural Assumptions

The system assumes the following components already exist:

| Component                   | Purpose                         |
| --------------------------- | ------------------------------- |
| Ingestion layer             | Stream large JSON sources       |
| JSON→Schema ETL             | Transform raw data to schema    |
| Schema→Object DSL engine    | Generate object nodes           |
| Worker-based infrastructure | High-throughput data processing |

This document defines **only the UI-facing projection layer**.

---

## Fundamental Principle

The UI consumes only a **linear sequence**. This sequence is the flattened form of "visible nodes" of a logical tree.

Visibility depends on the node's expand/collapse state. Unexpanded subtrees are **never flattened, never computed, and never reflected to the UI**.

### DOM Virtualization vs Projection Virtualization

| Aspect | DOM Virtualization     | Projection Virtualization |
| ------ | ---------------------- | ------------------------- |
| Solves | Layout and measurement | Data addressability       |
| Input  | Full data structure    | Windowed projection       |
| Memory | Proportional to total  | Proportional to visible   |

---

## Core Data Model

### NodeID Requirements

- **Global and stable** — does not change during runtime
- **Not a path-string** — numeric or opaque identifier preferred
- **Immutable** — survives tree mutations

### Node Metadata

Each node carries the following minimum metadata:

```typescript
interface NodeMetadata {
  nodeId: NodeID
  parentNodeId: NodeID | null // null for root
  childNodeIds: NodeID[] // lazy or eager
  isExpanded: boolean
  visibleSubtreeSize: number // includes self
}
```

### visibleSubtreeSize Semantics

| State     | visibleSubtreeSize                     |
| --------- | -------------------------------------- |
| Collapsed | Always `1`                             |
| Expanded  | `1 + sum(children.visibleSubtreeSize)` |

This property enables O(log n) index resolution without flattening the entire tree.

---

## Flattened Logical Tree

**Critical distinction:** The flattened tree is **not a physical array**. It is a **conceptual ordering** that is computed only when index → NodeID mapping is required.

### Global Index Space

- Defined only over **visible nodes**
- Collapsed subtrees occupy **no space** in the index space
- `totalVisibleNodes = root.visibleSubtreeSize`

### Benefits

| Metric        | Value                                |
| ------------- | ------------------------------------ |
| UI node count | visibleNodeCount, not totalNodeCount |
| Memory in UI  | O(visible), not O(total)             |
| Render cost   | O(visible)                           |

---

## Index → NodeID Resolution

### Algorithm: Prefix-Sum Implicit Traversal

1. Start from root node
2. Target index is reduced by each child's subtree size
3. When target falls within a child's range, recurse into that child
4. Continue until target index reaches 0

### Complexity

| Method        | Complexity                                  |
| ------------- | ------------------------------------------- |
| Linear scan   | O(children) per level                       |
| Binary search | O(log children) per level                   |
| **Total**     | **O(depth × log branching)** ≈ **O(log n)** |

For practical UI scenarios this feels like O(1). True O(1) is possible with auxiliary index tables but usually unnecessary.

### Pseudocode

```typescript
function resolveIndex(targetIndex: number, node: NodeMetadata): NodeID {
  if (targetIndex === 0) return node.nodeId

  let remaining = targetIndex - 1 // subtract self

  for (const childId of node.childNodeIds) {
    const child = registry.get(childId)
    if (remaining < child.visibleSubtreeSize) {
      return resolveIndex(remaining, child)
    }
    remaining -= child.visibleSubtreeSize
  }

  throw new Error('Index out of bounds')
}
```

---

## NodeID → Node Lookup

**Must always be O(1).** Implemented via:

| Structure                   | Use Case                 |
| --------------------------- | ------------------------ |
| `Map<NodeID, NodeMetadata>` | Standard lookup          |
| Arena allocation            | Memory-optimized variant |

Node objects need not be immutable, but **view objects transported to UI must be immutable**.

---

## Lazy Child Loading

### Problem

Eager `childNodeIds` creates memory pressure for large, deep trees where most subtrees are never expanded.

### Two-Layer Model

The tree is conceptually split into:

| Layer             | Contains                              |
| ----------------- | ------------------------------------- |
| Structural Node   | ID, parent, flags, counters           |
| Children Provider | Materialization source (not resolved) |

### Child State Machine

```typescript
type ChildState = 'UNRESOLVED' | 'LOADING' | 'RESOLVED' | 'EMPTY' | 'ERROR'

interface NodeMetadata {
  nodeId: NodeID
  parentNodeId: NodeID | null
  childState: ChildState
  childCount?: number // Known from schema/metadata, optional
  childNodeIds?: NodeID[] // Only present when RESOLVED
  isExpanded: boolean
  visibleSubtreeSize: number
}
```

### Expand Semantics

**Expand means:** "Make this node's children visible. I do not assume they exist."

When `expand(nodeId)` is called:

1. If `childState === UNRESOLVED`, trigger children provider (in worker)
2. `visibleSubtreeSize` remains `1` optimistically (node behaves as leaf until resolution)
3. On child resolution, subtree size propagates upward to ancestors

### Benefits

| Benefit                    | Description                               |
| -------------------------- | ----------------------------------------- |
| Zero memory for unexpanded | No children array allocated until needed  |
| Non-blocking UI            | UI never waits for children list          |
| Streaming compatible       | Works with JSON streaming and DSL engines |

### UX Hint

If `childCount` is known (from schema/metadata), UI can display "expandable but empty" indicator. If unknown, expandable icon is not rendered. This is a UX decision — core is unaffected.

---

## Mutation Handling

### Fundamental Principle

**Tree mutation and tree projection never occur simultaneously.**

### Single Writer Model

| Rule                  | Description                             |
| --------------------- | --------------------------------------- |
| Single writer         | All mutations performed by worker only  |
| UI read-only          | UI never directly mutates node registry |
| Transactional batches | Mutations applied atomically as batches |

### Mutation Operations

```typescript
interface MutationAPI {
  insertNode(parent: NodeID, position?: number): NodeID
  removeSubtree(nodeId: NodeID): void
  moveSubtree(nodeId: NodeID, newParent: NodeID, position?: number): void
  updateNodeMetadata(nodeId: NodeID, patch: Partial<NodeMetadata>): void
}
```

### Batch Processing Order

1. **Structural change** — parent/children graph modifications
2. **Invalidation** — affected nodes marked for recalculation
3. **Recalculation** — `visibleSubtreeSize` propagated to root
4. **Snapshot** — new `visibleNodeCount` finalized

### UI Notification

UI receives boundary notification, not deltas:

> "Index space has changed as of this moment."

### Consistency Guarantee

- Half-updated tree state is impossible
- `resolveIndex` never runs during mutation
- Simple RW lock or "mutation epoch" counter sufficient

**Projection invariant:** A `getRange()` call sees a frozen tree. Structure does not change mid-call.

---

## Error Boundaries

### Principle

Error boundaries belong in the **projection layer**, not UI. UI receives only "this node cannot be rendered" — never the reason.

### Edge Cases

#### 1. Stale Index

UI requests index based on outdated `visibleNodeCount`.

**Solution:** Epoch/version check. Mismatch → empty result or soft reset.

#### 2. Child Resolution Failure

Provider returns error during expand.

**Handling:**

- `childState = ERROR`
- `visibleSubtreeSize = 1`
- `NodeView` carries error flag (UI may render icon or ignore)
- Tree remains intact. Error is localized.

#### 3. Cycle / Corrupt Graph

Invalid parent pointer detected.

**Handling:**

- This is **fatal** but not exposed to UI
- Worker-side invariant check fails → tree frozen
- Explicit `REGISTRY_CORRUPTED` state
- Silent continuation is forbidden

#### 4. Concurrent Expand/Collapse Thrash

Rapid expand/collapse on same node.

**Handling:**

- Last state wins
- In-flight child resolution discarded if epoch mismatch
- No race conditions possible

### Error Locality

| Error Type       | Scope  | UI Impact              |
| ---------------- | ------ | ---------------------- |
| Stale index      | Query  | Empty/reset            |
| Child resolution | Node   | Error flag on NodeView |
| Corrupt graph    | Global | Tree frozen            |
| Thrash           | Node   | Latest state applied   |

---

## Range Query API

The **only contact point** between UI and data layer:

```typescript
interface ProjectionAPI {
  getRange(offset: number, limit: number): NodeView[]
  expand(nodeId: NodeID): void
  collapse(nodeId: NodeID): void
  getTotalVisibleCount(): number
}
```

### NodeView

Minimal render-ready structure:

```typescript
interface NodeView {
  nodeId: NodeID
  depth: number // for indentation
  isExpanded: boolean
  hasChildren: boolean
  label: string // display text
  // NO child lists
  // NO raw data payloads
  // NO large object graphs
}
```

### Pagination = Scrolling

From the API's perspective, pagination and scroll are identical — both are changes to `offset`.

---

## Expand/Collapse Mechanics

### Operation

1. Toggle `isExpanded` flag on target node
2. Recalculate `visibleSubtreeSize` for target
3. Propagate change to all ancestors up to root

### Locality

This is a **local update**. No full-tree recalculation required.

```typescript
function propagateSizeChange(nodeId: NodeID, delta: number): void {
  let current = nodeId
  while (current !== null) {
    const node = registry.get(current)
    node.visibleSubtreeSize += delta
    current = node.parentNodeId
  }
}
```

This is why **parent reference is mandatory**.

---

## Worker Architecture

### State Location

| Component                       | Location |
| ------------------------------- | -------- |
| Node registry                   | Worker   |
| Expand/collapse state           | Worker   |
| visibleSubtreeSize calculations | Worker   |

### UI Thread Responsibilities

- Call `getRange()`
- Dispatch expand/collapse events
- Render NodeView[]

### PostMessage Payloads

- Only NodeID and minimal view metadata
- **Never copy object graphs**

---

## Framework Independence

This architecture is **identical** for:

- React
- Vue
- Canvas
- Terminal UI
- WebGL

The UI only renders a **linear list**. Tree perception is created by:

- Indentation (padding/margin)
- Icons (▶ / ▼)
- Visual hierarchy

**Critical separation:** Tree = data structure, Indentation = visualization.

---

## Performance Summary

| Metric           | Depends On                    |
| ---------------- | ----------------------------- |
| Render cost      | Visible node count, not total |
| Memory (UI side) | Visible window only           |
| Memory (Worker)  | Node registry size            |

### Example

| Total Nodes | Visible Nodes | UI Cost |
| ----------- | ------------- | ------- |
| 1,000,000   | 200           | 200     |
| 10,000,000  | 50            | 50      |

**JS/TS is sufficient.** The problem is abstraction level, not language.

---

## Anti-Patterns

The following approaches conflict with this architecture:

| Anti-Pattern                  | Problem Created                |
| ----------------------------- | ------------------------------ |
| Make tree observable/reactive | State synchronization overhead |
| Store UI state per node       | Memory explosion               |
| Clone JSON for UI             | Unnecessary copies             |
| Assume Virtual DOM solves it  | Wrong abstraction level        |

These create **state synchronization problems** instead of solving visibility problems.

---

## Integration with Volta

### Relationship to Existing Components

| Volta Component       | Virtualization Role     |
| --------------------- | ----------------------- |
| VDL Parser            | Produces tree structure |
| Render Tree           | Source for NodeMetadata |
| `@voltakit/execution` | Worker infrastructure   |
| `@voltakit/virtual`   | **This RFC**            |

### API Surface

```typescript
// @voltakit/virtual
export interface VirtualTree {
  getRange(offset: number, limit: number): NodeView[]
  expand(nodeId: NodeID): void
  collapse(nodeId: NodeID): void
  getTotalVisibleCount(): number

  // Events
  onRangeChange(callback: (views: NodeView[]) => void): Unsubscribe
}

export function createVirtualTree(source: RenderTree, options?: VirtualTreeOptions): VirtualTree
```

---

## Explicit Non-Goals (v1)

The following are **intentionally out of scope** for v1. They are not deficiencies but conscious boundaries.

| Non-Goal                | Rationale                                           |
| ----------------------- | --------------------------------------------------- |
| Batch expand/collapse   | Requires range visibility transforms (segment-tree) |
| LRU eviction            | Lazy load sufficient for v1; unload adds complexity |
| Full telemetry          | Hook contracts defined, implementations deferred    |
| Search/filter API       | Consumer (Volta) responsibility, not projection     |
| Scroll position restore | UI layer decision                                   |
| Depth enforcement       | Source tree constraint                              |

### v1 Core Definition

> **Deterministic, addressable, lazy-visible projection engine.**

---

## Phase 2 Vision

### Batch Visibility Transforms

Current model: expand/collapse triggers O(n) propagation per node.

Phase 2 model: Visibility as **range transform** over flattened index space.

Technical direction:

- Second layer over prefix-sum tree (segment-tree pattern)
- "This interval opened/closed" instead of node-by-node propagation
- Enables `expandAll(nodeId)` and `collapseToDepth(nodeId, depth)` efficiently

### LRU Eviction

Memory management for long-running sessions.

Eviction scope: **Children materialization only**, not structural nodes.

What remains permanent:

- NodeID, parent pointer, flags, counters

What can be evicted:

- `childNodeIds` array
- `childState` reverts to `UNRESOLVED`

LRU key: Last visible timestamp.

Invariant preservation: Expand triggers provider again. Projection correctness unaffected.

### Telemetry Observability

Hook contracts (defined in v1, no-op by default):

```typescript
interface TelemetryHooks {
  onResolveIndex?(latencyMs: number, depth: number): void
  onGetRange?(hitSize: number, latencyMs: number): void
  onChildLoad?(nodeId: NodeID, durationMs: number, success: boolean): void
  onVisibleCountChange?(oldCount: number, newCount: number): void
}
```

Phase 2 provides concrete implementations and dashboard integration.

---

## Conclusion

This architecture enables safe, predictable, and scalable rendering of large and deep object trees in UI. The critical point is **virtualizing the tree's visible projection, not the tree itself**.

When this distinction is maintained, pagination, scroll, lookup, and performance problems become **deterministic**.
