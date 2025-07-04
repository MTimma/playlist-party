# Linting Report

**Total Issues Found: 139 (136 errors, 3 warnings)**

## Summary by Category

### 1. TypeScript Type Issues (98+ occurrences)
**Rule: `@typescript-eslint/no-explicit-any`**

The most prevalent issue is the use of `any` type instead of specific types. This affects:
- Server code: `/workspace/server/src/index.ts` (3 occurrences)
- Component tests: Multiple test files with extensive `any` usage
- Main components: `CreateLobby.tsx`, `JoinLobby.tsx`

**Impact**: Reduces type safety and defeats the purpose of using TypeScript.

### 2. Unused Variables/Imports (15+ occurrences)
**Rules: `@typescript-eslint/no-unused-vars`**

Files with unused imports/variables:
- `/workspace/server/src/index.ts`: Unused `Request`, `Response` imports
- Multiple test files: Unused `fireEvent` imports
- `SearchDialog.tsx`: Unused `addTrackProposal`, `isHost` variables
- `firebase.test.ts`: Unused `getCurrentUser`, `serverTimestamp`

### 3. React Hook Issues (3 warnings)
**Rules: `react-hooks/exhaustive-deps`, `react-refresh/only-export-components`**

- `CreateLobby.tsx`: Missing dependency `fetchSpotifyUser` in useEffect
- `SearchDialog.tsx`: useCallback with unknown dependencies
- `AuthContext.tsx`: Fast refresh warning for mixed exports

### 4. Import Style Issues (1 occurrence)
**Rule: `@typescript-eslint/no-require-imports`**

- `Lobby.test.tsx`: Using `require()` instead of ES module imports

### 5. Function Type Issues (1 occurrence)
**Rule: `@typescript-eslint/no-unsafe-function-type`**

- `Lobby.test.tsx`: Using unsafe `Function` type instead of explicit function signature

## Files with Most Issues

1. **`/workspace/src/services/__tests__/firebase.test.ts`** - 54 errors (mostly `any` types)
2. **`/workspace/src/components/Lobby/__tests__/Lobby.test.tsx`** - 29 errors
3. **`/workspace/src/components/Host/__tests__/CreateLobby.test.tsx`** - 14 errors
4. **`/workspace/src/components/Player/__tests__/JoinLobby.test.tsx`** - 9 errors

## Recommendations

### High Priority
1. **Replace `any` types** with proper TypeScript interfaces/types
2. **Remove unused imports** to clean up the codebase
3. **Fix React Hook dependencies** to prevent potential bugs

### Medium Priority
4. **Update require() imports** to ES modules
5. **Define explicit function types** instead of using `Function`

### Type Safety Improvements
- Create proper TypeScript interfaces for test mocks
- Define types for Firebase document structures
- Add proper typing for Spotify API responses

## Next Steps
1. Start with the server file `/workspace/server/src/index.ts` as it has fewer issues
2. Focus on test files systematically, starting with `firebase.test.ts`
3. Consider configuring ESLint to be less strict on test files if extensive mocking is needed
4. Implement proper TypeScript interfaces for frequently used data structures

## Security Audit Results

**7 moderate security vulnerabilities found** (all in development dependencies):
- Primary issue: esbuild vulnerability (GHSA-67mh-4wv8-2f99)
- Affected packages: vite, vitest, @vitest/coverage-v8, @vitest/ui, vite-node
- **Impact**: Development server security (not production)
- **Fix**: Run `npm audit fix --force` (may introduce breaking changes in test setup)

## TypeScript Compilation Status

✅ **TypeScript compilation successful** - No type errors found despite linting issues

**Note**: Most issues are in test files, which suggests the main application code is relatively clean. Consider whether strict typing rules should be relaxed for test files or if proper types should be implemented throughout.