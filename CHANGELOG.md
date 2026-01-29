# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [0.1.0] - 2026-01-29

### Added

- **Core Engine**
  - `createSightline()` factory function
  - `SightlineEngine` class implementing `Sightline` interface
  - Telemetry hooks (`onGetRange`, `onVisibleCountChange`)

- **Registry**
  - O(1) Map-based node storage
  - `createRegistry()`, `createNode()`, `addNode()`, `getRoot()`

- **Index Resolution**
  - O(log n) `resolveIndex()` function
  - `getIndexOfNode()` reverse lookup

- **Subtree Propagation**
  - `recalculateSubtreeSize()` for local updates
  - `propagateSizeChange()` for ancestor chain
  - `recalculateAndPropagate()` combined operation

- **Expand/Collapse**
  - `expand()`, `collapse()`, `toggle()`
  - `completeExpand()` for async resolution
  - `canExpand()`, `canCollapse()` utilities

- **Range Query**
  - `getRange(offset, limit)` with subtree skipping
  - `getTotalVisibleCount()` for scrollbar
  - `getNodeView()` single node lookup

- **Provider System**
  - `createProviderRegistry()` for lazy loading
  - `triggerChildResolution()` with epoch validation
  - `createGlobalProvider()` helper

- **Mutation Utilities**
  - `reorderChildren()` same-parent reorder
  - `moveNode()` cross-parent move with cycle detection
  - `removeNode()` subtree removal
  - `insertNode()` child insertion

- **Error Handling**
  - `SightlineError` base class
  - `StaleEpochError`, `ChildResolutionError`, `NodeNotFoundError`
  - `IndexOutOfBoundsError`, `RegistryCorruptedError`
  - `isRecoverableError()`, `isFatalError()` utilities

### Benchmark Results

Tested with 189MB GeoJSON (211,887 nodes):

| Operation                  | Latency |
| -------------------------- | ------- |
| Tree build                 | 200ms   |
| `getRange(0, 50)`          | 0.01ms  |
| `getRange(5000, 50)`       | 0.28ms  |
| Block expand (2,294 nodes) | 2.09ms  |

### Test Coverage

- 137 tests passing
- 10 test suites
- TypeScript strict mode
- ESLint clean

---

[0.1.0]: https://github.com/laphilosophia/sightline/releases/tag/v0.1.0
