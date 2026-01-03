# Testing Strategy

**Created:** 2026-01-01  
**Purpose:** Define a multi-layer testing approach to catch bugs early and reliably.

---

## Testing Pyramid

```
        ┌─────────────┐
        │   E2E       │  ← Few, slow, high confidence
        │ (Playwright)│
        ├─────────────┤
        │ Integration │  ← API routes, data flow
        │ (Vitest+MSW)│
        ├─────────────┤
        │ Component   │  ← React components
        │   (RTL)     │
        ├─────────────┤
        │   Unit      │  ← Pure functions, logic
        │  (Vitest)   │  ← Many, fast, focused
        └─────────────┘
```

---

## Layer 1: Unit Tests (Vitest)

**What:** Pure functions, utilities, business logic  
**Speed:** ~1ms per test  
**Coverage target:** 80%+ for `lib/` folder

### When to Write
- Any function in `lib/` that doesn't touch React or the database
- Categorization logic, cashflow calculations, data transformations

### Example
```typescript
// lib/categorization/payeeMemory.test.ts
import { normalizePayeeName } from './payeeMemory';

describe('normalizePayeeName', () => {
  it('lowercases and trims', () => {
    expect(normalizePayeeName('  STARBUCKS  ')).toBe('starbucks');
  });

  it('removes common suffixes', () => {
    expect(normalizePayeeName('Apple Inc')).toBe('apple');
    expect(normalizePayeeName('Google LLC')).toBe('google');
  });

  it('handles empty input', () => {
    expect(normalizePayeeName('')).toBe('');
    expect(normalizePayeeName(null as any)).toBe('');
  });
});
```

---

## Layer 2: Component Tests (React Testing Library)

**What:** React components in isolation  
**Speed:** ~10-50ms per test  
**Coverage target:** All interactive components

### When to Write
- Forms with multiple inputs
- Components with complex state
- Components that handle user interactions

### Example
```typescript
// components/admin/RuleForm.test.tsx
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { RuleForm, emptyFormData } from './RuleForm';

describe('RuleForm', () => {
  const mockSetFormData = vi.fn();
  const mockOnSave = vi.fn();
  const mockOnCancel = vi.fn();
  const mockCategories = [
    { id: '1', name: 'Groceries', cashflow_group: 'Variable' }
  ];

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders all form fields', () => {
    render(
      <RuleForm
        formData={emptyFormData}
        setFormData={mockSetFormData}
        categories={mockCategories}
        onSave={mockOnSave}
        onCancel={mockOnCancel}
        saving={false}
        isEditing={false}
      />
    );

    expect(screen.getByPlaceholderText(/Rule Name/i)).toBeInTheDocument();
    expect(screen.getByPlaceholderText(/STARBUCKS/i)).toBeInTheDocument();
    expect(screen.getByText(/Select category/i)).toBeInTheDocument();
  });

  it('retains input values while typing', async () => {
    const user = userEvent.setup();
    render(
      <RuleForm
        formData={emptyFormData}
        setFormData={mockSetFormData}
        categories={mockCategories}
        onSave={mockOnSave}
        onCancel={mockOnCancel}
        saving={false}
        isEditing={false}
      />
    );

    const nameInput = screen.getByPlaceholderText(/Rule Name/i);
    await user.type(nameInput, 'Test');
    
    // This would fail if component re-mounts on each keystroke
    expect(mockSetFormData).toHaveBeenCalledTimes(4); // T, e, s, t
  });

  it('disables submit when required fields empty', () => {
    render(
      <RuleForm
        formData={emptyFormData}
        setFormData={mockSetFormData}
        categories={mockCategories}
        onSave={mockOnSave}
        onCancel={mockOnCancel}
        saving={false}
        isEditing={false}
      />
    );

    expect(screen.getByText(/Create Rule/i)).toBeDisabled();
  });
});
```

---

## Layer 3: Integration Tests (Vitest + MSW)

**What:** API routes, database interactions  
**Speed:** ~100-500ms per test  
**Coverage target:** All API routes

### When to Write
- API route handlers
- Database queries
- External service integrations

### Example
```typescript
// app/api/categorization/rules/route.test.ts
import { GET, POST } from './route';
import { createMockRequest } from '@/test/utils';

describe('GET /api/categorization/rules', () => {
  it('returns empty array when no rules exist', async () => {
    const req = createMockRequest('GET');
    const res = await GET(req);
    const data = await res.json();
    
    expect(res.status).toBe(200);
    expect(data.rules).toEqual([]);
  });
});

describe('POST /api/categorization/rules', () => {
  it('requires name and category_id', async () => {
    const req = createMockRequest('POST', { body: {} });
    const res = await POST(req);
    
    expect(res.status).toBe(400);
  });

  it('creates rule with valid data', async () => {
    const req = createMockRequest('POST', {
      body: {
        name: 'Test Rule',
        assign_category_id: 'uuid-here',
        priority: 50,
      }
    });
    const res = await POST(req);
    
    expect(res.status).toBe(201);
  });
});
```

---

## Layer 4: E2E Tests (Playwright)

**What:** Full user flows in real browser  
**Speed:** 1-10s per test  
**Coverage target:** Critical user journeys

### Why Playwright over Puppeteer
- Auto-wait (no flaky `waitForSelector`)
- Better assertions (`toBeVisible`, `toHaveValue`)
- Multi-browser support
- Built-in test runner
- Trace viewer for debugging

### When to Write
- Critical user flows (login, checkout, etc.)
- Complex multi-page interactions
- Visual regression testing

### Example
```typescript
// e2e/rules.spec.ts
import { test, expect } from '@playwright/test';

test.describe('Categorization Rules', () => {
  test('can create, edit, and delete a rule', async ({ page }) => {
    await page.goto('/admin/rules');
    
    // Create
    await page.click('text=Add Rule');
    await page.fill('[placeholder*="Rule Name"]', 'E2E Test Rule');
    await page.fill('[placeholder*="STARBUCKS"]', 'TESTMERCHANT');
    await page.selectOption('select:has-text("Select category")', { index: 1 });
    await page.click('text=Create Rule');
    
    // Verify created
    await expect(page.locator('text=E2E Test Rule')).toBeVisible();
    
    // Edit
    await page.click('[title="Edit"]');
    await page.fill('[placeholder*="Rule Name"]', 'E2E Test Rule Updated');
    await page.click('text=Update Rule');
    
    // Verify updated
    await expect(page.locator('text=E2E Test Rule Updated')).toBeVisible();
    
    // Delete
    await page.click('[title="Delete"]');
    
    // Verify deleted
    await expect(page.locator('text=E2E Test Rule Updated')).not.toBeVisible();
  });

  test('form retains values while typing', async ({ page }) => {
    await page.goto('/admin/rules');
    await page.click('text=Add Rule');
    
    const nameInput = page.locator('[placeholder*="Rule Name"]');
    await nameInput.fill('Test Value');
    
    // This catches the focus bug
    await expect(nameInput).toHaveValue('Test Value');
    await expect(nameInput).toBeFocused();
  });
});
```

---

## Setup Instructions

### Install Dependencies
```bash
npm install -D vitest @testing-library/react @testing-library/user-event jsdom @playwright/test msw
```

### Configure Vitest
```typescript
// vitest.config.ts
import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import path from 'path';

export default defineConfig({
  plugins: [react()],
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: ['./test/setup.ts'],
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './'),
    },
  },
});
```

### Configure Playwright
```typescript
// playwright.config.ts
import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: './e2e',
  use: {
    baseURL: 'http://localhost:3000',
    trace: 'on-first-retry',
  },
  webServer: {
    command: 'npm run dev',
    port: 3000,
    reuseExistingServer: true,
  },
});
```

---

## Workflow Integration

Each workflow should specify which test types are required:

```markdown
## Testing Requirements

- [ ] **Unit tests:** `lib/categorization/newFeature.test.ts`
  - Test pure functions
  - Test edge cases
  
- [ ] **Component tests:** `components/NewComponent.test.tsx`
  - Test rendering
  - Test user interactions
  - Test form input retention (if applicable)
  
- [ ] **Integration tests:** `app/api/new-route/route.test.ts`
  - Test success cases
  - Test error handling
  - Test validation
  
- [ ] **E2E tests:** `e2e/new-feature.spec.ts`
  - Test complete user flow
  - Test data persistence
```

---

## Test Commands

```json
// package.json scripts
{
  "test": "vitest",
  "test:ui": "vitest --ui",
  "test:coverage": "vitest --coverage",
  "test:e2e": "playwright test",
  "test:e2e:ui": "playwright test --ui"
}
```

---

## What Each Layer Catches

| Bug Type | Unit | Component | Integration | E2E |
|----------|------|-----------|-------------|-----|
| Logic errors | ✅ | | | |
| Prop type issues | | ✅ | | |
| Form focus bugs | | ✅ | | ✅ |
| State management | | ✅ | | ✅ |
| API contract | | | ✅ | ✅ |
| Data persistence | | | ✅ | ✅ |
| Full user flow | | | | ✅ |
| Cross-browser | | | | ✅ |

---

## Priority for This Project

Given the current state, I recommend adding tests in this order:

1. **Unit tests for `lib/categorization/`** - Critical business logic
2. **Component tests for forms** - Prevent focus/state bugs
3. **E2E tests for critical flows** - Rules CRUD, transaction categorization
4. **Integration tests for API routes** - As needed

Start with the categorization module since it's the most complex and has the most business logic.
