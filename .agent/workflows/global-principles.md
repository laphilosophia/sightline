---
description: Global architectural principles for Sightline development
---

# Global Principles

## Architecture Philosophy

Sightline is a **projection engine**, not a UI framework.

> **Core Definition:** Deterministic, addressable, lazy-visible projection engine.

### What Sightline IS

- Flat index space over visible tree nodes
- O(log n) index resolution via prefix-sum traversal
- Single-writer registry with epoch-based consistency
- Lazy child materialization with provider pattern

### What Sightline IS NOT

- A rendering library
- A state management solution
- A framework binding layer
- A tree storage engine

---

## Decision Framework

When making architectural decisions, apply this priority order:

1. **Correctness** — Does it preserve projection invariants?
2. **Determinism** — Is the result reproducible given same inputs?
3. **Locality** — Does change propagation stay bounded?
4. **Performance** — Is it O(log n) or better?

Performance is LAST. Never sacrifice correctness for speed.

---

## Code Ownership

| Component   | Owner            | Scope                              |
| ----------- | ---------------- | ---------------------------------- |
| Registry    | Worker           | Node state + metadata              |
| Projection  | Worker           | Index resolution + range queries   |
| Visibility  | Worker           | Expand/collapse + size propagation |
| Provider    | Worker           | Child materialization              |
| Mutation    | Worker           | Transactional batches              |
| Consumption | Consumer (Volta) | Rendering + user interaction       |

---

## Integration Contract

Sightline provides:

```typescript
interface Sightline {
  getRange(offset: number, limit: number): NodeView[]
  expand(nodeId: NodeID): void
  collapse(nodeId: NodeID): void
  getTotalVisibleCount(): number
  getEpoch(): MutationEpoch
}
```

Sightline does NOT provide:

- Scroll handling
- Selection state
- Search/filter
- Keyboard navigation
- Rendering hints

These are consumer (Volta) responsibilities.
