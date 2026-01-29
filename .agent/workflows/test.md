---
description: How to run tests for Sightline
---

# Run Tests

// turbo-all

1. Run all tests with coverage:

```bash
pnpm test
```

2. Run tests in watch mode during development:

```bash
pnpm test:watch
```

3. Run specific test file:

```bash
pnpm test src/__tests__/registry.test.ts
```

4. Check coverage report:

```bash
pnpm test --coverage
```

## Expected Results

- All tests MUST pass
- Coverage target: ≥ 85%
- No TypeScript errors (strict mode)
