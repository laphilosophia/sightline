# Sightline API Reference

## Core API

### `createSightline(options?)`

Create a Sightline engine instance.

```typescript
import { createSightline } from 'sightline'

const engine = createSightline({
  telemetry: {
    onGetRange(hitSize, latencyMs) {
      /* ... */
    },
    onVisibleCountChange(oldCount, newCount) {
      /* ... */
    },
  },
})
```

**Returns:** `SightlineEngine`

---

## SightlineEngine

### `getRange(offset, limit)`

Query visible nodes in a range.

```typescript
const views = engine.getRange(0, 50)
```

| Param  | Type     | Description             |
| ------ | -------- | ----------------------- |
| offset | `number` | Start index (0-based)   |
| limit  | `number` | Maximum items to return |

**Returns:** `NodeView[]`

**Complexity:** O(log n + limit)

---

### `expand(nodeId)`

Expand a node to show its children.

```typescript
engine.expand('folder-1')
```

If children are UNRESOLVED, marks as LOADING. Use `completeExpand()` after async resolution.

---

### `collapse(nodeId)`

Collapse a node to hide its children.

```typescript
engine.collapse('folder-1')
```

---

### `getTotalVisibleCount()`

Get total number of visible nodes (for scrollbar).

```typescript
const total = engine.getTotalVisibleCount()
```

---

### `getEpoch()`

Get current mutation epoch (for stale detection).

```typescript
const epoch = engine.getEpoch()
```

---

### `getRegistry()`

Access underlying NodeRegistry (advanced).

```typescript
const registry = engine.getRegistry()
```

---

### `completeExpand(nodeId, childIds, error?)`

Complete async expand after provider resolves.

```typescript
engine.completeExpand('folder-1', ['file-1', 'file-2'])
```

---

### `needsChildLoading(nodeId)`

Check if a node needs its children loaded.

```typescript
if (engine.needsChildLoading('folder-1')) {
  await loadChildren('folder-1')
}
```

---

## Types

### `NodeView`

Immutable view payload for UI.

```typescript
interface NodeView {
  readonly nodeId: NodeID
  readonly depth: number
  readonly isExpanded: boolean
  readonly hasChildren: boolean
  readonly label: string
  readonly errorFlag?: boolean
  readonly loadingFlag?: boolean
}
```

### `NodeMetadata`

Full node metadata (internal).

```typescript
interface NodeMetadata {
  readonly nodeId: NodeID
  parentNodeId: NodeID | null
  childState: ChildState
  childCount?: number
  childNodeIds?: NodeID[]
  isExpanded: boolean
  visibleSubtreeSize: number
  depth: number
  label: string
}
```

### `ChildState`

```typescript
type ChildState = 'UNRESOLVED' | 'LOADING' | 'RESOLVED' | 'EMPTY' | 'ERROR'
```

### `NodeID`

```typescript
type NodeID = string | number
```

---

## Registry Utilities

### `createRegistry()`

Create empty node registry.

```typescript
import { createRegistry } from 'sightline'
const registry = createRegistry()
```

### `createNode(nodeId, options?)`

Create node with defaults.

```typescript
const node = createNode('folder-1', {
  parentNodeId: 'root',
  depth: 1,
  label: 'Folder 1',
  childNodeIds: ['file-1', 'file-2'],
})
```

### `addNode(registry, node)`

Add node to registry. Sets as root if no root exists.

```typescript
addNode(registry, node)
```

---

## Provider API

### `createProviderRegistry()`

Create registry for lazy loading providers.

```typescript
const providers = createProviderRegistry()
providers.register('folder-1', {
  async resolveChildren(nodeId) {
    return await fetchChildren(nodeId)
  },
})
```

### `triggerChildResolution()`

Trigger async child resolution with epoch validation.

```typescript
await triggerChildResolution(registry, providers, nodeId, capturedEpoch, () => engine.getEpoch())
```

---

## Mutation Utilities

_Internal utilities for worker/orchestration layer._

### `reorderChildren(registry, parentId, newOrder)`

Reorder children within same parent.

```typescript
reorderChildren(registry, 'folder-1', ['c', 'a', 'b'])
```

### `moveNode(registry, nodeId, newParentId, insertIndex?)`

Move node to different parent (with cycle detection).

```typescript
moveNode(registry, 'file-1', 'folder-2', 0)
```

### `removeNode(registry, nodeId)`

Remove node and its subtree.

```typescript
const removed = removeNode(registry, 'folder-1') // returns count
```

### `insertNode(registry, parentId, newNodeId, insertIndex?)`

Insert existing node as child.

```typescript
insertNode(registry, 'folder-1', 'file-new', 0)
```

---

## Error Types

All errors extend `SightlineError`.

| Error                    | Code                      | Recoverable |
| ------------------------ | ------------------------- | ----------- |
| `StaleEpochError`        | `STALE_EPOCH`             | ✅          |
| `ChildResolutionError`   | `CHILD_RESOLUTION_FAILED` | ✅          |
| `NodeNotFoundError`      | `NODE_NOT_FOUND`          | ✅          |
| `IndexOutOfBoundsError`  | `INDEX_OUT_OF_BOUNDS`     | ✅          |
| `RegistryCorruptedError` | `REGISTRY_CORRUPTED`      | ❌ Fatal    |

### Utilities

```typescript
isSightlineError(error) // Type guard
isRecoverableError(error) // Non-fatal check
isFatalError(error) // Must freeze tree
getErrorCode(error) // Get string code
```

---

## Complexity Reference

| Operation                | Complexity        |
| ------------------------ | ----------------- |
| `getRange`               | O(log n + window) |
| `expand/collapse`        | O(depth)          |
| `getTotalVisibleCount`   | O(1)              |
| Node lookup              | O(1)              |
| Subtree size propagation | O(depth)          |
