# Package Update Checklist

Quick reference for fixing circular dependency heap overflow.

## Critical Updates (Fix Heap Overflow)

- [ ] **@industry-theme/repository-composition-panels@0.2.51**
  - [ ] `@principal-ai/principal-view-core`: `^0.12.2` → `^0.15.3`
  - [ ] `@principal-ai/principal-view-react`: `^0.8.0` → `^0.10.0`
  - [ ] `@principal-ai/repository-abstraction`: `^0.5.0` → `^0.5.1`

- [ ] **@industry-theme/principal-view-panels@0.6.3**
  - [ ] `@principal-ai/repository-abstraction`: `0.2.5` → `^0.5.1`

## Secondary Updates (Clean Up Conflicts)

- [ ] **@industry-theme/agent-panels@0.2.25**
  - [ ] `@principal-ai/repository-abstraction`: `^0.4.0` → `^0.5.1`

- [ ] **@industry-theme/alexandria-docs-panel@0.4.28**
  - [ ] `@principal-ai/repository-abstraction`: `^0.2.4` → `^0.5.1`

- [ ] **@industry-theme/file-city-panel@0.2.56**
  - [ ] `@principal-ai/repository-abstraction`: `^0.5.0` → `^0.5.1`

## Optional (Better Peer Dep Support)

- [ ] **@principal-ai/repository-abstraction@0.5.1**
  - [ ] peerDependencies `globby`: `^14.0.0` → `^14.0.0 || ^16.0.0`

## After Updates - Test in Build Directory

```bash
cd /Users/griever/Developer/builds/electron-app
rm -rf node_modules package-lock.json
npm install --legacy-peer-deps
npm run build
```
