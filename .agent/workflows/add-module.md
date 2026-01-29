---
description: How to add a new module to Sightline following the established patterns
---

# Add New Module

## Steps

1. Create the source file in `src/`:

```
src/<module-name>.ts
```

2. Create corresponding test file:

```
src/__tests__/<module-name>.test.ts
```

3. Export from `src/index.ts` if public API

4. Follow the functional pattern:
   - Functions take `registry: NodeRegistry` as first parameter
   - Pure functions preferred
   - No global state

## Module Template

```typescript
// src/<module-name>.ts
import type { NodeRegistry, NodeID } from './types'

/**
 * Description of what this function does.
 * @param registry - The node registry
 * @param nodeId - Target node
 * @returns Description of return value
 */
export function myFunction(registry: NodeRegistry, nodeId: NodeID): ReturnType {
  // Implementation
}
```

## Test Template

```typescript
// src/__tests__/<module-name>.test.ts
import { describe, it, expect, beforeEach } from 'vitest'
import { myFunction } from '../<module-name>'
import { createTestRegistry, createNode } from './helpers'

describe('<module-name>', () => {
  let registry: NodeRegistry

  beforeEach(() => {
    registry = createTestRegistry()
  })

  it('should handle basic case', () => {
    // Arrange
    const node = createNode({ ... })

    // Act
    const result = myFunction(registry, node.nodeId)

    // Assert
    expect(result).toBe(expected)
  })

  it('should handle edge case: empty tree', () => {
    // ...
  })
})
```

## Checklist

- [ ] Source file created
- [ ] Types defined/imported
- [ ] Test file created with 4+ tests
- [ ] Exported from index.ts (if public)
- [ ] All tests pass
- [ ] No TypeScript errors
