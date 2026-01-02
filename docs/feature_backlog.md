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

## Improvements

### 2. Mobile Friendliness

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

### 3. Shadcn UI Front-End Overhaul

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

### 4. Feature-to-Database Mapping Documentation

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

### 4.1 Interactive Admin Documentation Layer

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
**Dependencies:** Feature #4 (database mapping documentation)

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
