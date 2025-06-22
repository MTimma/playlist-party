# Test Suite Documentation

## Overview

This test suite provides comprehensive coverage for Phase 1 (Basic Lobby) functionality of the music game project. The tests are built using Vitest, React Testing Library, and include extensive mocking for Firebase and Spotify services.

## Test Structure

### Component Tests (`__tests__/`)

#### `CreateLobby.test.tsx`
- **Authentication States**: Login prompts, Spotify connection handling
- **Form Validation**: Required fields, input length limits, data sanitization
- **Lobby Creation Process**: Success flows, loading states, navigation
- **Error Handling**: Creation failures, retry mechanisms
- **Accessibility**: Form labels, keyboard navigation, screen reader support
- **Edge Cases**: Rapid submissions, whitespace handling, missing data

#### `JoinLobby.test.tsx`
- **Form Rendering**: All required fields, URL parameter pre-filling
- **Validation**: Name/lobby ID requirements, format validation
- **Joining Process**: Success flows, loading states, navigation
- **Error Scenarios**: Lobby not found, full lobbies, network errors
- **Accessibility**: Proper labeling, keyboard support, error announcements
- **Edge Cases**: Input sanitization, case handling, concurrent requests

#### `PlayerList.test.tsx`
- **Player Display**: Names, scores, host badges, avatar handling
- **Time Calculations**: Join time formatting, relative timestamps
- **Current User Highlighting**: Visual distinction, "You" indicators
- **Empty States**: No players, loading states
- **Sorting**: Host first, chronological ordering
- **Accessibility**: ARIA labels, list semantics, screen reader support
- **Performance**: Large player lists, efficient rendering
- **Edge Cases**: Long names, special characters, invalid data

#### `Lobby.test.tsx`
- **Host vs Guest Controls**: Different UI based on user role
- **Real-time Updates**: Player joins/leaves, status changes
- **Share Functionality**: Link copying, success/error messages
- **Status Transitions**: Waiting, collecting songs, in progress, finished
- **Error Handling**: Subscription failures, operation errors
- **Loading States**: Initial load, operation feedback
- **Accessibility**: ARIA labels, status announcements

### Service Tests

#### `firebase.service.test.ts`
- **Authentication**: Anonymous sign-in, user state management
- **CRUD Operations**: Create, read, update lobby operations
- **Real-time Subscriptions**: Live updates, error handling
- **Data Validation**: Input sanitization, structure validation
- **Concurrent Operations**: Race conditions, simultaneous requests
- **Error Handling**: Network failures, permission errors
- **Security**: Input sanitization, XSS prevention

### Integration Tests

#### `integration.test.tsx`
- **End-to-End User Flows**: Complete lobby creation and joining
- **Real-time Update Scenarios**: Multi-user interactions
- **Error Recovery**: Network failures, retry mechanisms
- **Cross-Component State**: Consistent state across navigation

## Test Coverage

### Current Coverage Areas ✅

- **Component Rendering**: All components render correctly
- **User Interactions**: Form submissions, button clicks, navigation
- **Form Validation**: Input validation, error messages
- **Authentication Flow**: Spotify login, user state management
- **Real-time Updates**: Live lobby updates, player management
- **Error Handling**: Network errors, validation failures
- **Accessibility**: Screen readers, keyboard navigation
- **Edge Cases**: Invalid inputs, concurrent operations
- **Security**: Input sanitization, XSS prevention

### Coverage Goals

- **Unit Tests**: 90%+ line coverage for components and services
- **Integration Tests**: Critical user paths covered
- **E2E Tests**: Main user flows automated
- **Performance Tests**: Large data sets, concurrent users
- **Security Tests**: Input validation, error message sanitization
- **Accessibility Tests**: Screen reader compatibility, keyboard navigation

## Running Tests

### Basic Commands

```bash
# Run all tests
npm test

# Run tests in watch mode
npm run test:watch

# Run tests with UI
npm run test:ui

# Generate coverage report
npm run test:coverage
```

### Test Filtering

```bash
# Run specific test file
npm test CreateLobby

# Run tests matching pattern
npm test -- --grep "authentication"

# Run tests for specific component
npm test -- __tests__/PlayerList.test.tsx
```

### Coverage Reports

Coverage reports are generated in the `coverage/` directory:
- **HTML Report**: `coverage/index.html` - Interactive coverage browser
- **Text Report**: Console output during test runs
- **JSON Report**: `coverage/coverage-final.json` - Machine-readable data

## Test Configuration

### Vitest Configuration (`vitest.config.ts`)

```typescript
export default defineConfig({
  plugins: [react()],
  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: ['./src/test/setup.ts'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html'],
      exclude: [
        'node_modules/',
        'src/test/',
        '**/*.d.ts',
        '**/*.config.*',
        'dist/',
        'coverage/',
      ],
    },
  },
})
```

### Test Setup (`setup.ts`)

- **Global Mocks**: Firebase, environment variables, browser APIs
- **Test Utilities**: jest-dom matchers, cleanup functions
- **Mock Configuration**: Consistent mock behavior across tests

## Mocking Strategy

### Firebase Services
- **Complete Mocking**: All Firebase functions mocked at module level
- **Realistic Responses**: Mock data matches actual Firebase responses
- **Error Simulation**: Network failures, permission errors
- **State Management**: Consistent mock state across test scenarios

### Authentication Context
- **Flexible Mocking**: Different auth states per test
- **User Scenarios**: Authenticated, unauthenticated, loading states
- **Spotify Integration**: Mock Spotify user data and API responses

### Browser APIs
- **Clipboard API**: Mock copy functionality
- **Navigation**: Mock routing and URL parameters
- **Crypto API**: Deterministic UUID generation for testing

## Best Practices

### Test Writing
- **Descriptive Names**: Clear test descriptions explaining what is being tested
- **Arrange-Act-Assert**: Clear test structure with setup, action, and verification
- **Single Responsibility**: Each test focuses on one specific behavior
- **Mock Isolation**: Tests don't depend on external services or state

### Component Testing
- **User-Centric**: Tests focus on user interactions and visible behavior
- **Accessibility**: Tests verify screen reader compatibility and keyboard navigation
- **Error States**: Tests cover error conditions and edge cases
- **Loading States**: Tests verify loading indicators and disabled states

### Service Testing
- **Input Validation**: Tests verify all input validation rules
- **Error Handling**: Tests cover all error scenarios
- **Data Integrity**: Tests verify data structure and consistency
- **Concurrency**: Tests handle simultaneous operations

## Troubleshooting

### Common Issues

#### Test Timeouts
```bash
# Increase timeout for slow tests
npm test -- --timeout 10000
```

#### Mock Issues
- **Stale Mocks**: Clear mocks between tests with `vi.clearAllMocks()`
- **Mock Leakage**: Use `beforeEach` to reset mock state
- **Async Mocks**: Use `waitFor` for async operations

#### Environment Issues
- **Node Version**: Ensure Node.js 18+ for compatibility
- **Dependencies**: Run `npm install` to ensure all packages are installed
- **Cache**: Clear test cache with `npm test -- --no-cache`

### Debugging Tests

```bash
# Run tests with debug output
npm test -- --reporter=verbose

# Run single test with debugging
npm test -- --grep "specific test name" --reporter=verbose

# Debug with VS Code
# Use "Debug Test" option in VS Code test explorer
```

### Performance Issues

```bash
# Run tests in parallel (default)
npm test -- --threads

# Run tests sequentially for debugging
npm test -- --no-threads

# Profile test performance
npm test -- --reporter=verbose --profile
```

## CI/CD Integration

### GitHub Actions

The test suite is designed for CI/CD integration:

```yaml
- name: Run Tests
  run: npm test -- --coverage --reporter=json

- name: Upload Coverage
  uses: codecov/codecov-action@v3
  with:
    file: ./coverage/coverage-final.json
```

### Pre-commit Hooks

Tests can be run automatically before commits:

```json
{
  "husky": {
    "hooks": {
      "pre-commit": "npm test"
    }
  }
}
```

## Future Enhancements

### Phase 2 Testing (Song Collection)
- **Spotify API Integration**: Mock Spotify Web API calls
- **Playlist Management**: Test playlist creation and song addition
- **Search Functionality**: Test song search and selection
- **Real-time Synchronization**: Test multi-user song collection

### Advanced Testing
- **Visual Regression**: Screenshot comparisons for UI consistency
- **Performance Testing**: Load testing for concurrent users
- **Security Testing**: Penetration testing for input validation
- **Mobile Testing**: Responsive design and touch interactions

### Test Automation
- **Automated Test Generation**: AI-powered test case generation
- **Mutation Testing**: Test quality verification
- **Property-Based Testing**: Random input generation for edge cases
- **Contract Testing**: API contract verification

## Contributing

When adding new tests:

1. **Follow Naming Conventions**: Use descriptive test names
2. **Add Documentation**: Update this README for new test categories
3. **Maintain Coverage**: Ensure new code has corresponding tests
4. **Update Mocks**: Keep mock data realistic and up-to-date
5. **Test Edge Cases**: Consider error conditions and boundary cases

For questions or issues with the test suite, please refer to the project documentation or create an issue in the repository. 