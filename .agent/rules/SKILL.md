---
description: Sightline-specific development rules for projection-based tree virtualization
---

# Sightline Development Rules

## Core Invariants

These rules are ABSOLUTE. Violation means the code is wrong.

### 1. Visibility Index Space

- `visibleSubtreeSize` MUST equal `1` when collapsed
- `visibleSubtreeSize` MUST equal `1 + sum(children.visibleSubtreeSize)` when expanded
- Index resolution MUST be O(log n), never O(n)

### 2. Single Writer

- Only worker thread mutates registry
- UI thread NEVER modifies node state
- All mutations are transactional batches

### 3. Projection Invariant

- `getRange()` sees frozen tree
- No mutation during query execution
- Epoch mismatch → empty result or soft reset

### 4. Lazy Loading Contract

- `childNodeIds` only present when `childState === RESOLVED`
- Unexpanded subtrees consume zero children memory
- Provider failure → `childState = ERROR`, tree intact

### 5. Error Locality

- Child resolution errors are node-scoped, not tree-scoped
- Corrupt graph detection → tree frozen, explicit state
- Silent continuation on invariant violation is FORBIDDEN

---

## Code Patterns

### DO

```typescript
// Propagate delta to ancestors
function propagateSizeChange(registry: NodeRegistry, nodeId: NodeID, delta: number): void {
  let current = nodeId
  while (current !== null) {
    const node = registry.get(current)
    node.visibleSubtreeSize += delta
    current = node.parentNodeId
  }
}
```

### DO NOT

```typescript
// WRONG: Recalculating entire tree
function recalculateAll(registry: NodeRegistry): void {
  for (const node of registry.values()) {
    node.visibleSubtreeSize = calculateSubtreeSize(node) // O(n²)
  }
}
```

---

## Test Requirements

- Every public function MUST have unit tests
- Edge cases: empty tree, single node, deep linear chain, wide shallow tree
- Epoch validation MUST be tested for stale queries
- Provider failure scenarios MUST be tested

---

## v1 Scope Boundaries

The following are EXPLICIT NON-GOALS for v1:

- Batch expand/collapse (Phase 2: range visibility transforms)
- LRU eviction (Phase 2: children materialization eviction)
- Full telemetry (v1: hook contracts only, no-op default)
- Search/filter API (Volta's responsibility)
- Scroll position restore (UI layer)
