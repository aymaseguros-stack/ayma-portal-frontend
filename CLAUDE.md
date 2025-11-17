# CLAUDE.md - AI Assistant Guide for AYMA Portal Frontend

**Last Updated:** 2025-11-17
**Version:** 0.0.1
**Project:** AYMA Insurance Portal Frontend

---

## Table of Contents

- [Project Overview](#project-overview)
- [Technology Stack](#technology-stack)
- [Codebase Structure](#codebase-structure)
- [Architecture Patterns](#architecture-patterns)
- [Development Workflows](#development-workflows)
- [Key Conventions](#key-conventions)
- [API Integration](#api-integration)
- [State Management](#state-management)
- [Styling Approach](#styling-approach)
- [Common Tasks](#common-tasks)
- [Known Issues and Technical Debt](#known-issues-and-technical-debt)
- [Future Improvements](#future-improvements)

---

## Project Overview

**AYMA Portal Frontend** is an insurance management web application built with React and Vite. It provides role-based interfaces for administrators, employees, and clients to manage insurance policies, vehicles, and customer data.

### Key Features
- **Authentication:** JWT-based login with token persistence
- **Role-Based Access Control:** Three user types (admin, empleado, cliente) with different permissions
- **Dashboard:** Overview with scoring and activity tracking
- **Policy Management:** View and manage insurance policies (pólizas)
- **Vehicle Management:** Track insured vehicles
- **CRM Integration:** Customer relationship management features

### Project Stats
- **Total Lines of Code:** ~451 lines (excluding node_modules)
- **Main Component:** Single monolithic App.jsx (546 lines)
- **Project Stage:** MVP / Early Development (v0.0.1)

---

## Technology Stack

### Core Framework
- **React:** 19.2.0 (latest version with new hooks and features)
- **Vite:** 7.2.2 (`rolldown-vite` fork - experimental bundler)
- **JavaScript:** ES2020+ (no TypeScript despite having @types packages)

### Libraries
- **Axios:** 1.13.2 (HTTP client with interceptors)
- **Tailwind CSS:** 4.1.17 (utility-first CSS - **not properly configured**)

### Development Tools
- **ESLint:** 9.39.1 (flat config format)
- **Autoprefixer:** 10.4.22
- **PostCSS:** 8.5.6

### Important Notes
- Using **experimental Vite fork** (`rolldown-vite`) - be cautious with Vite documentation
- **No TypeScript** despite type packages being installed
- **No testing framework** configured
- **No routing library** (react-router-dom not installed)

---

## Codebase Structure

```
/home/user/ayma-portal-frontend/
├── public/                     # Static assets
│   └── vite.svg               # Vite logo (favicon)
│
├── src/                       # Source code
│   ├── assets/                # Application assets
│   │   └── react.svg          # React logo
│   │
│   ├── pages/                 # Page components
│   │   └── Dashboard.jsx      # ⚠️ LEGACY - DO NOT USE (unused component)
│   │
│   ├── services/              # API service layer
│   │   └── api.js             # ✅ Primary API client - USE THIS
│   │
│   ├── App.jsx                # ⚠️ Main monolithic component (546 lines)
│   ├── App.css                # Component-specific styles
│   ├── main.jsx               # Application entry point
│   └── index.css              # Global styles
│
├── .gitignore                 # Git ignore rules
├── eslint.config.js           # ESLint flat configuration
├── index.html                 # HTML entry point
├── package.json               # Dependencies and scripts
├── vite.config.js             # Vite build configuration
└── README.md                  # Standard Vite template docs
```

### Entry Point Flow
```
index.html → src/main.jsx → App.jsx → (Conditional inline views)
```

---

## Architecture Patterns

### 1. Monolithic Component Architecture ⚠️

**Current State:**
- Entire application in single `App.jsx` file (546 lines)
- All views rendered inline with conditional logic
- No component composition or separation

**Example:**
```javascript
// All views defined inline within App.jsx
function App() {
  const [activeTab, setActiveTab] = useState('dashboard')

  return (
    <>
      {!isLoggedIn ? (
        // Login view inline
      ) : (
        // All authenticated views inline
        activeTab === 'dashboard' ? (/* dashboard JSX */) :
        activeTab === 'polizas' ? (/* polizas JSX */) :
        activeTab === 'vehiculos' ? (/* vehiculos JSX */) :
        // ... etc
      )}
    </>
  )
}
```

**AI Assistant Guidelines:**
- ⚠️ **DO NOT** add more code to App.jsx without refactoring
- When adding features, **create separate components** in new files
- Gradually extract inline views into dedicated components
- Place new components in appropriate directories (e.g., `src/components/`, `src/views/`)

### 2. Service Layer Pattern ✅

**Location:** `src/services/api.js`

**Pattern:**
```javascript
// Centralized axios instance with authentication
const api = axios.create({ baseURL: API_URL })

api.interceptors.request.use((config) => {
  const token = localStorage.getItem('token')
  if (token) {
    config.headers.Authorization = `Bearer ${token}`
  }
  return config
})

// Domain-specific service modules
export const dashboardService = {
  async getResumen() { ... },
  async getScoring() { ... }
}

export const polizasService = {
  async listar() { ... },
  async obtener(id) { ... }
}
```

**AI Assistant Guidelines:**
- ✅ **ALWAYS** use service functions from `src/services/api.js`
- **NEVER** make direct axios calls in components
- When adding new API endpoints, add methods to appropriate service object
- Keep service methods async and return response.data
- Use the configured `api` instance (has automatic token injection)

### 3. Role-Based Access Control

**User Roles:**
- `admin` - Full access to all features
- `empleado` - Employee access (limited features)
- `cliente` - Client access (read-only dashboard and policies)

**Implementation:**
```javascript
// src/App.jsx
const getTabs = () => {
  if (userRole === 'admin') {
    return ['dashboard', 'usuarios', 'crm', 'clientes', 'polizas', 'vehiculos', 'reportes', 'datos', 'tickets']
  }
  if (userRole === 'empleado') {
    return ['dashboard', 'crm', 'polizas', 'vehiculos', 'tickets']
  }
  return ['dashboard', 'polizas'] // cliente
}
```

**AI Assistant Guidelines:**
- Check `userRole` state before rendering features
- Use `getTabs()` pattern or similar for dynamic navigation
- Store role in localStorage for persistence: `localStorage.getItem('role')`

---

## Development Workflows

### Setup and Installation

```bash
# Install dependencies
npm install

# Start development server (http://localhost:5173)
npm run dev

# Build for production
npm run build

# Preview production build
npm run preview

# Run linter
npm run lint
```

### File Naming Conventions
- **Components:** PascalCase with `.jsx` extension (e.g., `Dashboard.jsx`)
- **Services:** camelCase with `.js` extension (e.g., `api.js`)
- **Styles:** kebab-case or PascalCase matching component (e.g., `App.css`)
- **Assets:** lowercase with hyphens (e.g., `react.svg`)

### ESLint Rules

**Configuration:** `eslint.config.js` (flat config format)

**Key Rules:**
- `no-unused-vars`: Error (except variables matching `^[A-Z_]` pattern)
- React Hooks rules: Enforced via `eslint-plugin-react-hooks`
- React Fast Refresh: Enforced via `eslint-plugin-react-refresh`

**AI Assistant Guidelines:**
- Always run `npm run lint` before committing
- Fix all linting errors - do not suppress warnings without good reason
- Follow React Hooks rules strictly (dependencies array, hooks at top level)

---

## Key Conventions

### 1. State Management

**Current Pattern:** Pure React hooks (useState, useEffect)

```javascript
// Authentication state
const [isLoggedIn, setIsLoggedIn] = useState(false)
const [userEmail, setUserEmail] = useState('')
const [userRole, setUserRole] = useState('')

// UI state
const [activeTab, setActiveTab] = useState('dashboard')
const [loading, setLoading] = useState(false)
const [error, setError] = useState('')

// Data state
const [dashboardData, setDashboardData] = useState(null)
const [polizas, setPolizas] = useState([])
const [vehiculos, setVehiculos] = useState([])
```

**AI Assistant Guidelines:**
- **No global state library** - use component state or consider adding Context API
- For persistent data, use `localStorage` (token, email, role)
- When adding complex state, **consider introducing Context API or Zustand**
- Do not add Redux without discussing with team

### 2. Data Fetching Pattern

**Pattern:**
```javascript
const loadDashboardData = async () => {
  setLoadingDashboard(true)
  try {
    const [resumen, scoring] = await Promise.all([
      dashboardService.getResumen(),
      dashboardService.getScoring()
    ])
    setDashboardData({ ...resumen, scoring })
  } catch (err) {
    console.error('Error cargando dashboard:', err)
  } finally {
    setLoadingDashboard(false)
  }
}

useEffect(() => {
  loadDashboardData()
}, [])
```

**AI Assistant Guidelines:**
- Use `Promise.all()` for parallel requests
- Always wrap in try/catch with loading states
- Use `console.error()` for logging (no error tracking service configured)
- Set loading state in try, clear in finally

### 3. Navigation Pattern

**Current:** State-based tab navigation (no routing library)

```javascript
const [activeTab, setActiveTab] = useState('dashboard')

// Tabs: 'dashboard', 'usuarios', 'crm', 'clientes', 'polizas', 'vehiculos', 'reportes', 'datos', 'tickets'

// Conditional rendering
{activeTab === 'dashboard' && <DashboardView />}
{activeTab === 'polizas' && <PolizasView />}
```

**AI Assistant Guidelines:**
- **DO NOT** install react-router-dom without approval
- Continue using `activeTab` state for navigation
- When app grows, **recommend** adding react-router-dom
- Use `setActiveTab(tabName)` for navigation

### 4. Authentication Flow

**Login Process:**
```javascript
// 1. Submit credentials
const response = await axios.post(`${API_URL}/api/v1/auth/login`, { email, password })

// 2. Extract response
const { access_token, email: userEmail, tipo_usuario } = response.data

// 3. Store in localStorage
localStorage.setItem('token', access_token)
localStorage.setItem('email', userEmail)
localStorage.setItem('role', tipo_usuario)

// 4. Update state
setIsLoggedIn(true)
setUserEmail(userEmail)
setUserRole(tipo_usuario)
```

**Logout Process:**
```javascript
// 1. Clear localStorage
localStorage.removeItem('token')
localStorage.removeItem('email')
localStorage.removeItem('role')

// 2. Reset state
setIsLoggedIn(false)
setUserEmail('')
setUserRole('')
setActiveTab('dashboard')
```

**Session Persistence:**
```javascript
// On app mount
useEffect(() => {
  const token = localStorage.getItem('token')
  const savedEmail = localStorage.getItem('email')
  const savedRole = localStorage.getItem('role')
  if (token && savedEmail) {
    setIsLoggedIn(true)
    setUserEmail(savedEmail)
    setUserRole(savedRole || 'cliente')
  }
}, [])
```

**AI Assistant Guidelines:**
- **NEVER** store passwords in localStorage (only token)
- Token is automatically added to requests via axios interceptor
- No token refresh logic implemented - consider adding if needed
- No logout API call - purely client-side

---

## API Integration

### Backend Configuration

**Backend URL:** `https://ayma-portal-backend.onrender.com`

**⚠️ CRITICAL ISSUES:**
- API URL is **hardcoded** in 3 locations:
  - `src/App.jsx:6`
  - `src/pages/Dashboard.jsx:4` (unused legacy file)
  - `src/services/api.js:3` ✅ (correct location)
- **NO environment variables** configured
- **NO .env file** setup

**AI Assistant Guidelines:**
- When modifying API URL, **ONLY** change `src/services/api.js:3`
- **RECOMMEND** creating `.env` file with `VITE_API_URL`
- **DO NOT** hardcode additional API URLs in components

### API Endpoints

**Authentication:**
```javascript
POST /api/v1/auth/login
Body: { email: string, password: string }
Response: { access_token: string, email: string, tipo_usuario: string }
```

**Dashboard:**
```javascript
GET /api/v1/dashboard/              // Summary
GET /api/v1/dashboard/scoring       // User scoring
GET /api/v1/dashboard/actividades   // Recent activities
```

**Policies (Pólizas):**
```javascript
GET /api/v1/polizas/                // List all
GET /api/v1/polizas/:id             // Get specific policy
```

**Vehicles (Vehículos):**
```javascript
GET /api/v1/vehiculos/              // List all
GET /api/v1/vehiculos/:id           // Get specific vehicle
```

### Using Service Layer

**✅ CORRECT:**
```javascript
import { polizasService } from './services/api'

const loadPolizas = async () => {
  const data = await polizasService.listar()
  setPolizas(data)
}
```

**❌ INCORRECT:**
```javascript
import axios from 'axios'

// DO NOT make direct axios calls
const response = await axios.get('https://ayma-portal-backend.onrender.com/api/v1/polizas/')
```

### Adding New API Endpoints

**Step-by-step:**

1. Add service method to `src/services/api.js`:
```javascript
export const newService = {
  async getData() {
    const response = await api.get('/api/v1/new-endpoint/')
    return response.data
  },
  async create(data) {
    const response = await api.post('/api/v1/new-endpoint/', data)
    return response.data
  }
}
```

2. Import and use in component:
```javascript
import { newService } from './services/api'

const loadData = async () => {
  const data = await newService.getData()
  setState(data)
}
```

---

## State Management

### Current Approach: Component State Only

**No Global State Library** - Pure React hooks

**State Categories:**

1. **Authentication State**
   - `isLoggedIn`, `userEmail`, `userRole`
   - Persisted in localStorage
   - Initialized on mount

2. **UI State**
   - `activeTab`, `loading`, `error`
   - Not persisted
   - Reset on logout

3. **Data State**
   - `dashboardData`, `polizas`, `vehiculos`
   - Fetched from API
   - Cleared on logout

### When to Consider State Management Library

**Triggers:**
- Sharing state between 3+ components
- Deep prop drilling (passing props through 3+ levels)
- Complex state updates with multiple dependencies
- Need for state persistence beyond localStorage

**Recommended Libraries:**
1. **Context API** - For simple global state (auth, theme)
2. **Zustand** - For moderate complexity (recommended for this project)
3. **Redux Toolkit** - Only if app becomes very complex

---

## Styling Approach

### Tailwind CSS ⚠️

**Status:** Installed but **NOT properly configured**

**Issues:**
- No `tailwind.config.js` file
- No `@tailwind` directives in CSS
- Classes work but rely on auto-detection or CDN
- PostCSS configured but incomplete

**Current Usage:**
- 135+ Tailwind class usages in App.jsx
- Hybrid approach: Tailwind + CSS modules

**AI Assistant Guidelines:**
- Continue using Tailwind classes (they work despite config issues)
- Consider creating proper `tailwind.config.js` for customization
- Use Tailwind utility classes for layout, spacing, colors
- Use CSS modules for complex/custom styles

### CSS Files

**Global Styles:** `src/index.css`
```css
/* Global resets and base styles */
```

**Component Styles:** `src/App.css`
```css
/* App-specific styles */
/* Used for complex animations or custom CSS */
```

**AI Assistant Guidelines:**
- Prefer Tailwind classes for standard styling
- Use CSS files for:
  - Global resets
  - Complex animations
  - Custom keyframes
  - Browser-specific fixes

---

## Common Tasks

### Adding a New Feature

1. **Create feature component** (if not trivial):
```bash
# Create new component file
touch src/components/NewFeature.jsx
```

2. **Implement component**:
```javascript
import { useState, useEffect } from 'react'
import { newService } from '../services/api'

export default function NewFeature() {
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    loadData()
  }, [])

  const loadData = async () => {
    setLoading(true)
    try {
      const result = await newService.getData()
      setData(result)
    } catch (err) {
      console.error('Error:', err)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="p-4">
      {/* Your JSX */}
    </div>
  )
}
```

3. **Add to App.jsx navigation**:
```javascript
// Add to tabs array in getTabs()
// Add conditional render in main view
```

### Adding a New API Service

**Edit:** `src/services/api.js`

```javascript
export const newService = {
  async list() {
    const response = await api.get('/api/v1/resource/')
    return response.data
  },

  async get(id) {
    const response = await api.get(`/api/v1/resource/${id}`)
    return response.data
  },

  async create(data) {
    const response = await api.post('/api/v1/resource/', data)
    return response.data
  },

  async update(id, data) {
    const response = await api.put(`/api/v1/resource/${id}`, data)
    return response.data
  },

  async delete(id) {
    const response = await api.delete(`/api/v1/resource/${id}`)
    return response.data
  }
}
```

### Debugging Common Issues

**Issue:** Token not being sent with requests
```javascript
// Check localStorage
console.log('Token:', localStorage.getItem('token'))

// Verify interceptor is configured in api.js
// Should see Authorization header in Network tab
```

**Issue:** CORS errors
```javascript
// Backend issue - not frontend
// Verify backend allows origin: http://localhost:5173
```

**Issue:** Build fails
```bash
# Clear cache and rebuild
rm -rf node_modules dist
npm install
npm run build
```

**Issue:** Tailwind classes not working
```javascript
// Despite config issues, classes should work
// If not, check browser console for CSS errors
// Verify PostCSS and Autoprefixer are installed
```

---

## Known Issues and Technical Debt

### Critical Issues ⚠️

1. **Monolithic App Component**
   - **Problem:** All logic in single 546-line file
   - **Impact:** Hard to maintain, test, and scale
   - **Solution:** Extract inline views to separate components
   - **Priority:** High

2. **No Environment Variables**
   - **Problem:** API URL hardcoded in source
   - **Impact:** Can't switch environments, security risk
   - **Solution:** Create `.env` file with `VITE_API_URL`
   - **Priority:** High

3. **API URL Duplication**
   - **Problem:** Backend URL in 3 files
   - **Impact:** Easy to create inconsistencies
   - **Solution:** Use only `src/services/api.js` version
   - **Priority:** Medium

4. **No Testing Infrastructure**
   - **Problem:** Zero tests, no testing framework
   - **Impact:** No automated quality assurance
   - **Solution:** Add Vitest + React Testing Library
   - **Priority:** Medium

5. **No Routing Library**
   - **Problem:** Tab-based navigation doesn't support URLs
   - **Impact:** No deep linking, back button doesn't work
   - **Solution:** Add react-router-dom
   - **Priority:** Medium

6. **Tailwind Not Configured**
   - **Problem:** No tailwind.config.js
   - **Impact:** Can't customize theme, relying on defaults
   - **Solution:** Create proper Tailwind configuration
   - **Priority:** Low

### Legacy Code ⚠️

**File:** `src/pages/Dashboard.jsx`
- **Status:** Unused, legacy component
- **Action:** Can be safely deleted
- **Note:** Uses different styling approach (inline styles)

### TypeScript Packages Installed But Not Used

- `@types/react` and `@types/react-dom` installed
- Project uses `.jsx` files, not `.tsx`
- **Consider:** Migrating to TypeScript for better type safety

---

## Future Improvements

### Recommended Enhancements

1. **Component Architecture**
   - Extract inline views from App.jsx
   - Create component library structure
   - Implement proper component composition

2. **Routing**
   - Add `react-router-dom`
   - Implement URL-based navigation
   - Add route protection for authenticated routes

3. **State Management**
   - Add Context API for auth state
   - Consider Zustand for complex state
   - Implement proper state persistence

4. **Testing**
   - Add Vitest as test runner
   - Add React Testing Library
   - Write unit tests for services
   - Write integration tests for components

5. **Environment Configuration**
   - Create `.env` file structure
   - Add environment variables for API URL
   - Support dev/staging/production environments

6. **Build Configuration**
   - Configure Tailwind properly
   - Add build optimization
   - Implement code splitting
   - Add lazy loading for routes

7. **Code Quality**
   - Add TypeScript
   - Add Prettier for code formatting
   - Add Husky for pre-commit hooks
   - Add conventional commits

8. **Error Handling**
   - Add React Error Boundaries
   - Implement error tracking service (e.g., Sentry)
   - Add user-friendly error messages
   - Add error retry logic

9. **Performance**
   - Implement React.memo for expensive components
   - Add useMemo/useCallback where needed
   - Implement virtual scrolling for long lists
   - Add bundle size analysis

10. **Security**
    - Implement token refresh logic
    - Add CSRF protection
    - Implement rate limiting on client
    - Add input validation and sanitization

---

## AI Assistant Quick Reference

### DO's ✅

- Use service functions from `src/services/api.js`
- Create separate components instead of adding to App.jsx
- Follow React Hooks rules strictly
- Use Tailwind classes for styling
- Wrap API calls in try/catch with loading states
- Check user role before rendering features
- Store only token/email/role in localStorage
- Use `Promise.all()` for parallel requests
- Run `npm run lint` before committing

### DON'Ts ❌

- Don't make direct axios calls in components
- Don't add more code to App.jsx without refactoring
- Don't hardcode API URLs outside `src/services/api.js`
- Don't store passwords in localStorage
- Don't suppress ESLint warnings without reason
- Don't use `src/pages/Dashboard.jsx` (it's legacy)
- Don't install major libraries without discussing
- Don't modify Vite config unless necessary (using experimental fork)

### File References

- **Main Component:** `src/App.jsx` (⚠️ monolithic, refactor when modifying)
- **API Services:** `src/services/api.js` (✅ add new endpoints here)
- **Entry Point:** `src/main.jsx` (rarely modified)
- **Legacy Component:** `src/pages/Dashboard.jsx` (❌ do not use)
- **Configuration:** `vite.config.js`, `eslint.config.js`, `package.json`

### Common Code Patterns

**Service Call:**
```javascript
import { serviceName } from './services/api'
const data = await serviceName.methodName()
```

**Loading State:**
```javascript
const [loading, setLoading] = useState(false)
setLoading(true)
try { /* ... */ } finally { setLoading(false) }
```

**Error Handling:**
```javascript
try {
  const data = await apiCall()
} catch (err) {
  console.error('Error:', err)
  setError('User-friendly message')
}
```

**Role Check:**
```javascript
if (userRole === 'admin') { /* admin only feature */ }
```

---

## Questions or Clarifications

If you encounter ambiguity or need clarification:

1. Check this CLAUDE.md first
2. Review existing code patterns in `src/App.jsx` and `src/services/api.js`
3. Check ESLint configuration for code style
4. If still unclear, ask the user for guidance

---

**Document maintained for AI assistants working on AYMA Portal Frontend.**
**Update this file when significant architectural changes occur.**
