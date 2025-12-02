# Testing Documentation

## Overview

This project now has comprehensive test coverage using Vitest, React Testing Library, and MSW (Mock Service Worker).

## Test Coverage

Current test coverage: **~94%**

- **Statement Coverage:** 93.79%
- **Branch Coverage:** 85.04%
- **Function Coverage:** 94.73%
- **Line Coverage:** 93.66%

Total: **98 passing tests** across 5 test suites

## Testing Stack

### Core Testing Libraries

1. **Vitest** (v4.0.15) - Fast unit testing framework optimized for Vite
2. **React Testing Library** (v16.3.0) - Component testing utilities
3. **@testing-library/jest-dom** (v6.9.1) - Custom matchers for DOM testing
4. **@testing-library/user-event** (v14.6.1) - User interaction simulation
5. **MSW** (v2.12.3) - API mocking for integration tests

### Environment

- **Test Environment:** jsdom (v27.2.0) - Simulates browser environment
- **Coverage Provider:** @vitest/coverage-v8

## Test Structure

```
src/
├── __tests__/              # Component tests
│   ├── App.auth.test.jsx   # Authentication flow tests (17 tests)
│   ├── App.dashboard.test.jsx  # Dashboard functionality tests (21 tests)
│   ├── App.roles.test.jsx  # Role-based access control tests (28 tests)
│   └── App.utils.test.jsx  # Utility functions tests (19 tests)
├── services/
│   └── __tests__/
│       └── api.test.js     # API services tests (13 tests)
├── tests/
│   ├── mocks/
│   │   ├── handlers.js     # MSW request handlers
│   │   └── server.js       # MSW server setup
│   └── utils/
│       └── testUtils.jsx   # Test utilities and helpers
└── setupTests.js           # Global test configuration
```

## Test Categories

### 1. API Services Tests (src/services/__tests__/api.test.js)

Tests for the API service layer:
- Request interceptor adds Bearer token
- Dashboard service endpoints (resumen, scoring, actividades)
- Polizas service endpoints (listar, obtener)
- Vehiculos service endpoints (listar, obtener)
- Authentication handling
- Error responses (401, 404, 500)
- Data validation

### 2. Authentication Tests (src/__tests__/App.auth.test.jsx)

Tests for login/logout functionality:
- Login form rendering and validation
- Successful login with valid credentials
- Failed login with invalid credentials
- Token storage in localStorage
- Automatic login with existing token
- Logout functionality and state cleanup
- Loading states during authentication
- Form validation

### 3. Role-Based Access Control Tests (src/__tests__/App.roles.test.jsx)

Tests for role-specific features:
- **Admin role:** Access to all 7 tabs (Dashboard, Usuarios, CRM, Clientes, Pólizas, Vehículos, Reportes)
- **Empleado role:** Access to 5 tabs (Dashboard, CRM, Clientes, Pólizas, Vehículos)
- **Cliente role:** Access to 5 tabs (Dashboard, Mis Datos, Mis Pólizas, Mis Vehículos, Soporte)
- Tab visibility restrictions
- Role color coding (Admin: red, Empleado: blue, Cliente: green)
- Tab navigation and state management

### 4. Dashboard Functionality Tests (src/__tests__/App.dashboard.test.jsx)

Tests for dashboard features:
- Dashboard data loading
- Polizas display and formatting
- Vehiculos display and insurance status
- Dashboard cards with metrics
- Empty states (no polizas/vehiculos)
- Currency formatting (Argentine locale)
- Date formatting and days until expiration
- Color-coded expiration warnings (< 30 days = red)
- Support/tickets section
- Under-development module placeholders
- Personal data display

### 5. Utility Functions Tests (src/__tests__/App.utils.test.jsx)

Tests for helper functions:
- `getRoleName()` - Spanish role name mapping
- `getRoleColor()` - Tailwind CSS color classes
- `getTabs()` - Role-specific tab configuration
- Currency and date formatting
- Days until expiration calculation

## Running Tests

### Commands

```bash
# Run tests in watch mode (development)
npm test

# Run tests once (CI/CD)
npm run test:run

# Run tests with UI (visual test runner)
npm run test:ui

# Generate coverage report
npm run test:coverage
```

### Coverage Thresholds

Configured in `vitest.config.js`:

```javascript
coverage: {
  thresholds: {
    lines: 60,
    functions: 60,
    branches: 50,
    statements: 60
  }
}
```

## MSW (Mock Service Worker)

### API Mocking

All API calls are intercepted and mocked using MSW. This provides:
- Fast, reliable tests without network dependencies
- Consistent test data
- Ability to test error scenarios

### Mock Endpoints

Configured in `src/tests/mocks/handlers.js`:

- `POST /api/v1/auth/login` - Authentication
- `GET /api/v1/dashboard/` - Dashboard summary
- `GET /api/v1/dashboard/scoring` - Scoring data
- `GET /api/v1/dashboard/actividades` - Activities
- `GET /api/v1/polizas/` - List policies
- `GET /api/v1/polizas/:id` - Get policy by ID
- `GET /api/v1/vehiculos/` - List vehicles
- `GET /api/v1/vehiculos/:id` - Get vehicle by ID

### Mock Data

Test data is defined in `src/tests/utils/testUtils.jsx`:

- **mockUsers:** Admin, Empleado, Cliente users with credentials
- **mockDashboardData:** Dashboard metrics
- **mockScoringData:** Scoring information
- **mockPolizas:** 2 sample policies with full details
- **mockVehiculos:** 2 sample vehicles with insurance status

## Test Utilities

### Custom Helpers (src/tests/utils/testUtils.jsx)

```javascript
// Mock localStorage with authentication data
mockLocalStorage.setAuthData(token, email, role)

// Wait for loading to finish
await waitForLoadingToFinish()

// Custom render with providers
renderWithProviders(<Component />)
```

## Best Practices

### 1. Test Isolation

Each test is isolated with:
- `beforeEach()` - Clear localStorage, reset mocks
- `afterEach()` - Reset MSW handlers, cleanup components

### 2. Async Handling

Always use `waitFor()` or `findBy*` queries for async operations:

```javascript
// Good
await waitFor(() => {
  expect(screen.getByText('Dashboard')).toBeInTheDocument()
})

// Good
const element = await screen.findByText('Dashboard')

// Bad (may cause flaky tests)
expect(screen.getByText('Dashboard')).toBeInTheDocument()
```

### 3. Accessibility

Tests use accessible queries:
- `getByLabelText()` for form inputs
- `getByRole()` for interactive elements
- `getByText()` for content

### 4. User-Centric Testing

Tests simulate real user interactions:

```javascript
const user = userEvent.setup()
await user.type(emailInput, 'user@example.com')
await user.click(loginButton)
```

## Continuous Integration

Tests are designed to run in CI/CD pipelines:
- Fast execution (~8 seconds)
- No external dependencies
- Deterministic results
- Coverage reporting

## Future Improvements

### High Priority

1. **E2E Tests** - Add Playwright or Cypress for full user flows
2. **Component Isolation** - Extract large components for easier testing
3. **Performance Tests** - Add tests for render performance
4. **Visual Regression** - Add snapshot testing for UI consistency

### Medium Priority

1. **Integration Tests** - Test full user journeys across multiple pages
2. **Error Boundary Tests** - Test error handling and recovery
3. **Accessibility Tests** - Add automated a11y testing with axe-core
4. **Mobile Tests** - Add tests for responsive behavior

### Nice to Have

1. **Mutation Testing** - Use Stryker to verify test quality
2. **Load Testing** - Test with large datasets
3. **Network Error Tests** - Test offline scenarios and retry logic
4. **Security Tests** - Test XSS, CSRF protection

## Troubleshooting

### Common Issues

**Issue:** Tests timeout
**Solution:** Increase timeout in `waitFor()`: `{ timeout: 3000 }`

**Issue:** "Unable to find element"
**Solution:** Use `findBy*` queries for async elements or add `waitFor()`

**Issue:** localStorage not working
**Solution:** Check `setupTests.js` - localStorage is mocked with actual storage

**Issue:** MSW not intercepting requests
**Solution:** Verify handlers in `src/tests/mocks/handlers.js` match exact URLs

### Debug Mode

Run tests with Vitest UI for debugging:

```bash
npm run test:ui
```

This opens a browser-based test runner with:
- Test execution timeline
- Console logs
- Component render tree
- Test failure details

## Resources

- [Vitest Documentation](https://vitest.dev/)
- [React Testing Library](https://testing-library.com/react)
- [MSW Documentation](https://mswjs.io/)
- [Testing Best Practices](https://kentcdodds.com/blog/common-mistakes-with-react-testing-library)

## Maintenance

### Adding New Tests

1. Create test file in appropriate directory
2. Import test utilities: `import { render, screen, waitFor } from '@testing-library/react'`
3. Use `mockLocalStorage.setAuthData()` for authenticated tests
4. Add MSW handlers if new API endpoints are tested
5. Run `npm run test:coverage` to verify coverage

### Updating Tests

When modifying components:
1. Update corresponding tests
2. Verify all tests still pass
3. Check coverage hasn't decreased
4. Update this documentation if test structure changes

---

**Last Updated:** December 2025
**Test Coverage:** 94%
**Total Tests:** 98
**Status:** ✅ All tests passing
