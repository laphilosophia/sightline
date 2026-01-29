# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Added

- Initial project structure
- Core virtualization engine
  - `NodeRegistry` — O(1) node lookup
  - `resolveIndex` — O(log n) index → NodeID resolution
  - `expand` / `collapse` — Local subtree updates
  - `getRange` — Range Query API for UI
  - `createSightline` — Factory function
- Test suite with 10+ tests
- Full tooling setup
  - ESLint (strict TypeScript)
  - Prettier
  - Husky + lint-staged
  - Commitlint (conventional commits)
  - Semantic Release

### Documentation

- README with architecture overview
- RFC-0003 reference (Volta integration)
