# Puppeteer Testing Guidelines

**Created:** 2026-01-01  
**Purpose:** Ensure UI features are functionally tested, not just visually verified.

---

## Problem Statement

Screenshot-only testing catches rendering issues but misses:
- Form input focus/blur bugs
- State management issues
- Data persistence failures
- User interaction flows

---

## Testing Levels

### Level 1: Visual Verification (Minimum)
- Page loads without errors
- Key elements are visible
- Layout matches expectations

```javascript
// Example: Basic visual check
await puppeteer_navigate({ url: "http://localhost:3000/admin/rules" });
await puppeteer_screenshot({ name: "rules-page", width: 1200, height: 800 });
```

### Level 2: Interaction Testing (Required for Forms)
- Click buttons and verify state changes
- Type in form fields and verify input persists
- Submit forms and verify success/error states

```javascript
// Example: Form interaction test
await puppeteer_navigate({ url: "http://localhost:3000/admin/rules" });

// Click add button
await puppeteer_click({ selector: "button:has-text('Add Rule')" });
await puppeteer_screenshot({ name: "add-form-open" });

// Fill form fields
await puppeteer_fill({ selector: "input[placeholder*='Rule Name']", value: "Test Rule" });
await puppeteer_fill({ selector: "input[placeholder*='STARBUCKS']", value: "COFFEE" });

// Verify input persisted (critical for focus bug detection)
await puppeteer_screenshot({ name: "form-filled" });

// Submit and verify
await puppeteer_click({ selector: "button:has-text('Create Rule')" });
await puppeteer_screenshot({ name: "after-submit" });
```

### Level 3: Data Verification (Required for CRUD)
- Verify data was saved to database
- Verify data displays correctly after refresh
- Verify edit/delete operations work

```javascript
// Example: Data persistence check
await puppeteer_navigate({ url: "http://localhost:3000/admin/rules" });

// Check API returns saved data
const result = await puppeteer_evaluate({
  script: `
    fetch('/api/categorization/rules')
      .then(r => r.json())
      .then(d => JSON.stringify(d))
  `
});
// Verify result contains expected rule
```

---

## Workflow Puppeteer Section Template

Replace generic "take a screenshot" instructions with:

```markdown
## Puppeteer Verification

### Visual Checks
- [ ] Navigate to the page
- [ ] Screenshot: Page loads without errors
- [ ] Screenshot: All expected elements visible

### Interaction Checks (for forms/interactive elements)
- [ ] Click primary action button (Add/Edit/Delete)
- [ ] Fill all form fields with test data
- [ ] Screenshot: Verify form fields retain input (focus bug check)
- [ ] Submit form
- [ ] Screenshot: Verify success state or new item appears

### Data Checks (for CRUD operations)
- [ ] Refresh page and verify data persists
- [ ] Call API endpoint and verify data structure
- [ ] Test edit flow: modify existing item
- [ ] Test delete flow: remove item and verify removal
```

---

## Common Bugs This Catches

| Bug Type | Test That Catches It |
|----------|---------------------|
| Form loses focus on input | Fill field, screenshot, verify value |
| Data not saving | Submit, refresh, verify item exists |
| Component re-renders on state change | Fill multiple fields, verify all retain values |
| API errors not shown | Submit invalid data, verify error message |
| Navigation missing | Click nav link, verify page loads |

---

## Checklist for New UI Features

Before marking a UI feature complete:

- [ ] Page renders without console errors
- [ ] All interactive elements are clickable
- [ ] Form inputs accept and retain values
- [ ] Form submission works (success and error cases)
- [ ] Data persists after page refresh
- [ ] Navigation to/from page works
- [ ] Mobile/responsive layout (if applicable)

---

## Integration with Workflows

All workflows with UI components should include:

1. **Step N-1:** Implement the UI component
2. **Step N:** Puppeteer functional testing (not just screenshots)
3. **Step N+1:** Fix any issues found in testing

The Puppeteer step should explicitly list:
- Which buttons to click
- Which fields to fill
- What data to verify
- Expected outcomes

---

## Example: Improved Workflow 06 Puppeteer Section

**Before (insufficient):**
```markdown
10. **Puppeteer Verification:** Use the Puppeteer MCP server to:
    - Navigate to http://localhost:3000/admin/rules
    - Take a screenshot to verify the rules admin page renders
```

**After (comprehensive):**
```markdown
10. **Puppeteer Verification:**
    - Navigate to http://localhost:3000/admin/rules
    - Screenshot: Verify page loads with "Categorization Rules" heading
    - Click "+ Add Rule" button
    - Screenshot: Verify form appears
    - Fill "Rule Name" with "Test Coffee Rule"
    - Fill "Merchant Contains" with "STARBUCKS"
    - Select a category from dropdown
    - Screenshot: Verify all fields retain their values
    - Click "Create Rule"
    - Screenshot: Verify rule appears in list
    - Refresh page
    - Screenshot: Verify rule persists after refresh
    - Click edit button on the rule
    - Modify the name
    - Save and verify update
    - Delete the test rule and verify removal
```
