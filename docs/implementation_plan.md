# Sightline Implementation Plan

> **Based on:** RFC-0003 (Projection-Based Tree Virtualization)
> **Target:** `@voltakit/virtual` graduation

---

## 1. Goal

Build a framework-agnostic tree virtualization engine that renders GB-scale object trees with O(visible) UI cost.

**Core Principle:** UI never sees the tree — only a windowed projection.

---

## 2. Architecture Overview

```
┌─────────────────────────────────────────────────────────────┐
│  SOURCE TREE (any structure)                                │
└───────────────────────────┬─────────────────────────────────┘
                            │
                            ▼
┌─────────────────────────────────────────────────────────────┐
│  SIGHTLINE ENGINE                                           │
│  ┌───────────────┐  ┌──────────────────┐  ┌──────────────┐  │
│  │ NodeRegistry  │  │ VisibleSubtree   │  │ RangeQuery   │  │
│  │ O(1) lookup   │  │ Size Calculator  │  │ API          │  │
│  └───────────────┘  └──────────────────┘  └──────────────┘  │
│                                                              │
│  ┌───────────────┐  ┌──────────────────┐                    │
│  │ IndexResolver │  │ Expand/Collapse  │                    │
│  │ O(log n)      │  │ Controller       │                    │
│  └───────────────┘  └──────────────────┘                    │
└───────────────────────────┬─────────────────────────────────┘
                            │
                            ▼
┌─────────────────────────────────────────────────────────────┐
│  UI LAYER                                                   │
│  Receives: NodeView[] (flat, minimal, immutable)            │
└─────────────────────────────────────────────────────────────┘
```

---

## 3. Proposed Changes

### Phase 1: Core Data Model

#### [NEW] `src/types.ts`

- `NodeID` — opaque identifier (number | string)
- `ChildState` — `UNRESOLVED | LOADING | RESOLVED | EMPTY | ERROR`
- `NodeMetadata` — node structure with `childState`, optional `childCount`/`childNodeIds`, `visibleSubtreeSize`
- `NodeView` — minimal UI payload with optional `errorFlag`
- `MutationEpoch` — version counter for consistency checks
- `TelemetryHooks` — hook contract interface (no-op default, v2 implementations)

#### [NEW] `src/registry.ts`

- `NodeRegistry` class — O(1) Map-based storage
- `setRoot()`, `get()`, `set()`, `has()`, `size()`

---

### Phase 2: Index Resolution

#### [NEW] `src/resolver.ts`

- `resolveIndex(registry, targetIndex)` → NodeID | null
- Prefix-sum implicit traversal
- O(depth × log(branching)) complexity

---

### Phase 3: Subtree Size Propagation

#### [NEW] `src/propagation.ts`

- `recalculateSubtreeSize(registry, nodeId)` — local recalc
- `propagateSizeChange(registry, nodeId, delta)` — ancestor update

---

### Phase 4: Expand/Collapse Controller

#### [NEW] `src/controller.ts`

- `expand(registry, nodeId)` — make children visible
- `collapse(registry, nodeId)` — hide children
- Both trigger `propagateSizeChange` to ancestors

---

### Phase 5: Range Query API

#### [NEW] `src/query.ts`

- `getRange(registry, offset, limit)` → NodeView[]
- Recursive collector with depth tracking
- Respects expand/collapse state

---

### Phase 6: Factory & Public API

#### [NEW] `src/index.ts`

- `createSightline(registry, options?)` → Sightline
- Public interface:
  - `getRange(offset, limit)`
  - `expand(nodeId)`
  - `collapse(nodeId)`
  - `getTotalVisibleCount()`
  - `getEpoch()` — current mutation epoch

---

### Phase 7: Children Provider

#### [NEW] `src/provider.ts`

- `ChildrenProvider` interface — async child resolution
- `registerProvider(registry, nodeId, provider)` — attach lazy loader
- `triggerChildResolution(registry, nodeId)` → Promise<NodeID[]>
- Epoch validation on resolution callback

---

### Phase 8: Mutation API

#### [NEW] `src/mutation.ts`

- `insertNode(registry, parent, position?)` → NodeID
- `removeSubtree(registry, nodeId)`
- `moveSubtree(registry, nodeId, newParent, position?)`
- `updateNodeMetadata(registry, nodeId, patch)`
- `batchMutate(registry, mutations[])` — atomic batch
- Epoch increment on each batch

---

### Phase 9: Error Handling

#### [NEW] `src/errors.ts`

- `SightlineError` base class
- `StaleEpochError` — query with outdated epoch
- `ChildResolutionError` — provider failure
- `RegistryCorruptedError` — invariant violation (fatal)
- Error localization utilities

---

### Phase 10: Worker Support

#### [NEW] `src/worker.ts`

- MessageChannel-based communication
- State lives in worker, UI thread only receives NodeView[]
- Epoch passed with each response
- Single writer enforcement (worker owns registry)

---

## 4. File Structure

```
sightline/
├── src/
│   ├── types.ts           # Type definitions (ChildState, NodeMetadata, etc.)
│   ├── registry.ts        # NodeRegistry class
│   ├── resolver.ts        # Index → NodeID resolution
│   ├── propagation.ts     # visibleSubtreeSize updates
│   ├── controller.ts      # Expand/Collapse logic
│   ├── query.ts           # Range Query API
│   ├── provider.ts        # Lazy children resolution
│   ├── mutation.ts        # Transactional mutation API
│   ├── errors.ts          # Error types and handling
│   ├── index.ts           # Public API & factory
│   ├── worker.ts          # Worker-based state management
│   └── __tests__/
│       ├── registry.test.ts
│       ├── resolver.test.ts
│       ├── propagation.test.ts
│       ├── controller.test.ts
│       ├── query.test.ts
│       ├── provider.test.ts
│       ├── mutation.test.ts
│       ├── errors.test.ts
│       └── integration.test.ts
├── docs/
│   └── RFC-0003.md        # Architecture spec
├── package.json
├── tsconfig.json
└── [tooling configs]
```

---

## 5. Graduation Criteria

| Criterion     | Target                       |
| ------------- | ---------------------------- |
| Test coverage | ≥ 80%                        |
| API stability | 2+ weeks no breaking changes |
| Performance   | 100K nodes, <16ms getRange   |
| Documentation | README + API Reference       |
| TypeScript    | Strict mode, 0 errors        |

---

## 6. Implementation Order

| #   | Phase          | Priority | Tests |
| --- | -------------- | -------- | ----- |
| 1   | types.ts       | HIGH     | —     |
| 2   | registry.ts    | HIGH     | 4+    |
| 3   | resolver.ts    | HIGH     | 5+    |
| 4   | propagation.ts | HIGH     | 4+    |
| 5   | controller.ts  | HIGH     | 6+    |
| 6   | query.ts       | HIGH     | 8+    |
| 7   | index.ts       | HIGH     | 4+    |
| 8   | provider.ts    | HIGH     | 5+    |
| 9   | mutation.ts    | HIGH     | 6+    |
| 10  | errors.ts      | HIGH     | 4+    |
| 11  | worker.ts      | HIGH     | 4+    |
| 12  | Benchmarks     | MEDIUM   | —     |

---

## 7. Alternatives Considered

### A: Single-file vs Multi-file

| Approach         | Pros                 | Cons                      |
| ---------------- | -------------------- | ------------------------- |
| Single file      | Simple               | Hard to test in isolation |
| **Multi-file** ✓ | Testable, composable | More files                |

**Decision:** Multi-file for testability and clear module boundaries.

### B: Class-based vs Functional

| Approach         | Pros           | Cons                      |
| ---------------- | -------------- | ------------------------- |
| Class-based      | Familiar OOP   | State coupling            |
| **Functional** ✓ | Pure, testable | Requires registry passing |

**Decision:** Functional with explicit registry parameter for determinism.

### C: Eager vs Lazy childNodeIds

| Approach    | Pros                | Cons                   |
| ----------- | ------------------- | ---------------------- |
| **Eager** ✓ | Simple, fast lookup | Memory for large trees |
| Lazy        | Memory efficient    | Complex async handling |

**Decision:** Eager for v1, lazy as future optimization.

---

## 8. Unknowns

1. **Worker thread transfer** — Structured clone vs SharedArrayBuffer for NodeView[] payloads?
2. **Epoch overflow** — 32-bit vs 64-bit counter? Wrap-around handling?
3. **Provider timeout** — How long to wait for child resolution before ERROR state?

---

## 9. Verification Plan

### Automated Tests

- Unit tests per module (vitest)
- Integration test: full expand/collapse/getRange cycle
- Benchmark: 100K node tree, measure getRange latency

### Manual Verification

- Console-based demo with mock tree
- Verify depth calculation visually

---

## 10. Success Metrics

| Metric                       | Target         |
| ---------------------------- | -------------- |
| Total tests                  | 45+            |
| Coverage                     | ≥ 85%          |
| getRange(0, 50) on 100K tree | < 5ms          |
| Lazy expand resolution       | < 10ms         |
| Build size                   | < 15KB gzipped |
