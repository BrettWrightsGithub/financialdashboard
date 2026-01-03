# Feature Backlog

This document tracks feature ideas, improvements, bugs, and technical debt for the Financial Dashboard application.

## Features

### 1. Natural Language to Structured Rule Creation

**Description:**  
Instead of filling out a form, users would be presented with a chat interface where they can describe rules in natural language.

**Example Use Case:**  
User types: "I want a rule that any time a transaction from Starbucks comes in that's below $10, it is categorized as a dining expense."

The LLM would:
- Parse the natural language input
- Extract rule parameters (merchant: "Starbucks", amount condition: "< $10", category: "Dining")
- Generate the structured rule
- Present the rule to the user for confirmation
- Save the rule upon approval

**Requirements:**
- Chat-based UI component
- LLM integration for natural language parsing
- Rule validation and sanitization
- Confirmation workflow before saving
- Proper guardrails to prevent:
  - Malformed rules
  - Conflicting rule logic
  - Security vulnerabilities
  - Invalid category assignments

**Priority:** TBD  
**Status:** Idea  
**Dependencies:** Existing rule engine (workflow 06)

---

### 2. Backfill Transaction Categorization with Review Process

**Description:**  
Enable users to retroactively apply a newly created categorization rule to existing transactions, with a review/preview modal before confirming the changes.

**User Flow:**
1. User creates a new categorization rule
2. System offers option to "Apply to existing transactions"
3. System analyzes and identifies all matching historical transactions
4. Preview modal displays:
   - Number of transactions that will be affected
   - List of transactions with current vs. new category
   - Before/after comparison
   - Ability to select/deselect individual transactions
5. User reviews and confirms changes
6. System applies categorization in bulk

**Requirements:**
- Background job/worker to find matching transactions based on rule criteria
- Preview modal component showing affected transactions
- Bulk update API endpoint
- Transaction comparison UI (current category → new category)
- Individual transaction selection/deselection
- Confirmation workflow with undo capability
- Performance optimization for large transaction sets
- Audit trail of bulk categorization changes

**Technical Considerations:**
- Should this be done via Supabase RPC function for performance?
- Need to handle large result sets efficiently (pagination in preview?)
- Consider rate limiting for bulk updates
- Should integrate with existing rule engine (workflow 06)
- Need to track which rules have been backfilled to avoid duplicate prompts

**Priority:** Medium  
**Status:** Backlog  
**Dependencies:** 
- Existing rule engine (workflow 06)
- Transaction categorization workflows

---

## Improvements

### 3. Visual Hierarchy for Split Transactions

**Description:**  
Add visual indentation/tabbing for child transactions from split transactions in the transaction table to improve readability and make parent-child relationships immediately clear.

**Visual Design:**
- Parent transaction displays normally at the left edge
- Child transactions are visually indented/tabbed to the right
- Optional: Add visual connector lines or icons (e.g., └─, ├─) to show hierarchy
- Possible collapse/expand functionality for parent transactions
- Different background shading or border styling for child rows

**Example Layout:**
```
Parent Transaction ($100)           Category: General
  └─ Child 1 ($60)                 Category: Groceries
  └─ Child 2 ($40)                 Category: Dining
```

**Requirements:**
- Detect parent-child relationship in transaction data
- CSS styling for indentation and visual hierarchy
- Optional: Collapsible rows for better space management
- Mobile-responsive design (consider horizontal space constraints)
- Maintain table sorting/filtering functionality with hierarchy
- Ensure accessibility (screen readers should understand hierarchy)

**Technical Considerations:**
- How to handle nested splits (splits within splits)?
- Should parent transaction amount be editable if children exist?
- Performance impact on large transaction lists with many splits
- Should child transactions be hideable by default for cleaner view?

**Priority:** Medium  
**Status:** Backlog  
**Dependencies:** 
- Transaction splitting functionality (workflow 09)
- TransactionTable component

---

### 4. Mobile Friendliness

**Description:**  
Improve the responsive design and mobile user experience across all pages of the application.

**Scope:**
- Responsive layouts for all pages
- Touch-friendly UI elements
- Mobile-optimized navigation
- Proper viewport handling
- Performance optimization for mobile devices

**Priority:** TBD  
**Status:** Backlog

---

### 5. Shadcn UI Front-End Overhaul

**Description:**  
Migrate the entire front-end to use Shadcn UI components for a more consistent, modern, and accessible design system.

**Benefits:**
- Consistent design language
- Improved accessibility
- Better component reusability
- Modern UI/UX
- Reduced custom CSS maintenance

**Priority:** TBD  
**Status:** Backlog

---

### 6. Feature-to-Database Mapping Documentation

**Description:**  
Create comprehensive documentation that maps each feature to its required database values, functions, and dependencies.

**Scope:**
- Document all features
- List required tables, columns, and functions
- Document relationships and dependencies
- Create visual diagrams where appropriate

**Priority:** TBD  
**Status:** Backlog

---

### 7. Interactive Admin Documentation Layer

**Description:**  
Build a front-end admin layer that provides inline documentation for each feature and field with hover tooltips.

**Components:**
1. **Admin Documentation View:**
   - Visual representation of feature-to-database mappings
   - Interactive hover tooltips on each field
   - Links to detailed documentation

2. **Developer IDE Rule:**
   - Enforce documentation updates when new features are created
   - Lint rule or pre-commit hook to ensure documentation is added
   - Template for documenting new features

**Requirements:**
- Tooltip component system
- Documentation metadata storage
- Admin-only access control
- IDE integration (ESLint rule or similar)

**Priority:** TBD  
**Status:** Backlog  
**Dependencies:** Feature #6 (database mapping documentation)

---

### 8. JavaScript Bundle Optimization

**Description:**  
Reduce JavaScript execution time and bundle size to improve page load performance and responsiveness.

**Current Performance Metrics (from Lighthouse - Development Build):**
- Total JavaScript execution time: 1.4s
- Main-thread work: 4.5s
- Largest contributors:
  - react-dom-client.development.js: 2,358ms CPU time, 996ms script evaluation
  - Transactions page: 943ms CPU time, 105ms script evaluation

**Note:** Current metrics are from development build. Production build testing required to establish actual baseline performance before implementing optimizations.

**Next Steps:**
1. **Baseline Production Performance:**
   - Run Lighthouse on production build first
   - Establish actual performance metrics
   - Identify real bottlenecks (development React explains ~2.3s of current metrics)

2. **Code Splitting (if needed after prod testing):**
   - Implement dynamic imports for route-based code splitting
   - Lazy load heavy components (charts, modals, complex tables)
   - Split vendor bundles more aggressively

3. **Bundle Analysis (if needed after prod testing):**
   - Run webpack-bundle-analyzer to identify largest dependencies
   - Replace heavy libraries with lighter alternatives where possible
   - Tree-shake unused code

4. **Runtime Performance (if needed after prod testing):**
   - Memoize expensive computations
   - Optimize React re-renders with React.memo and useMemo
   - Defer non-critical JavaScript execution

**Priority:** Low (blocked until production baseline established)  
**Status:** Backlog - Needs Production Testing First  
**Risk Level:** Low (standard optimization practices)

**Success Metrics:**
- TBD after production build baseline
- Target: < 1s JavaScript execution time
- Target: < 3s main-thread work

---

### 9. Main-Thread Work Optimization

**Description:**  
Reduce blocking main-thread work to improve application responsiveness and user experience.

**Current Breakdown (from Lighthouse - Development Build):**
- Other: 2,037ms
- Script Evaluation: 1,429ms
- Rendering: 766ms
- Style & Layout: 142ms
- Garbage Collection: 69ms

**Note:** Current metrics are from development build. Production build testing required to establish actual baseline performance before implementing optimizations.

**Next Steps:**
1. **Baseline Production Performance:**
   - Run Lighthouse on production build first
   - Establish actual rendering/main-thread metrics
   - Development build overhead likely inflates these numbers

2. **Rendering Optimization (if needed after prod testing):**
   - Implement virtual scrolling for large transaction tables
   - Reduce unnecessary DOM manipulations
   - Optimize CSS selectors and reduce style recalculations

3. **Offload Heavy Computations (if needed after prod testing):**
   - Move data processing to Web Workers where applicable
   - Use requestIdleCallback for non-critical work
   - Debounce/throttle expensive operations (table filtering, search)

4. **Reduce Garbage Collection (if needed after prod testing):**
   - Minimize object creation in hot paths
   - Reuse objects where possible
   - Avoid memory leaks from event listeners and subscriptions

**Priority:** Low (blocked until production baseline established)  
**Status:** Backlog - Needs Production Testing First  
**Risk Level:** Low-Medium (requires careful testing of rendering changes)

**Dependencies:** Should evaluate after Feature #8 (production baseline)

**Success Metrics:**
- TBD after production build baseline
- Target: < 3s main-thread work
- Target: Smooth interactions with no janky scrolling or input lag

---

## Template for New Entries

```markdown
### [ID]. [Feature/Improvement/Bug Title]

**Description:**  
[Brief description of the feature, improvement, or bug]

**Priority:** [High/Medium/Low/TBD]  
**Status:** [Idea/Backlog/In Progress/Blocked/Complete]  
**Dependencies:** [List any dependencies]

**Additional Details:**
[Any additional context, requirements, or implementation notes]
```
