---
description: How to build and lint Sightline
---

# Build & Lint

// turbo-all

1. Type check (no emit):

```bash
pnpm tsc --noEmit
```

2. Lint with ESLint:

```bash
pnpm lint
```

3. Format with Prettier:

```bash
pnpm format
```

4. Build for production:

```bash
pnpm build
```

## Quality Gates

- Zero TypeScript errors (strict mode)
- Zero ESLint errors
- All files formatted
