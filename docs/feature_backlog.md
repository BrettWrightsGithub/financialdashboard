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



## Clean up and Optimize

**Description:**
Review and optimize the codebase by moving appropriate functions from TypeScript to Supabase stored procedures for better performance, and ensure existing stored procedures are optimized for their execution patterns.

**Current State Analysis Needed:**
- Review all TypeScript files in `lib/`, `app/api/`, and components for functions that could benefit from database-level execution
- Analyze existing stored procedures in `supabase/migrations/` for optimization opportunities
- Identify functions that are called frequently or process large datasets

**Optimization Opportunities:**
1. **Function Migration Assessment:**
   - Data processing functions that operate on large transaction sets
   - Cashflow calculation functions that aggregate across multiple tables
   - Categorization rule processing that requires complex JOIN operations
   - Analytics and reporting functions

2. **Stored Procedure Optimization:**
   - Review current procedures for proper indexing usage
   - Optimize query execution plans
   - Add appropriate batching for bulk operations
   - Implement proper error handling and logging

3. **Execution Pattern Analysis:**
   - **On-demand functions:** User-triggered operations (categorization, rule application)
   - **Batch jobs:** Overnight processing, data sync, analytics calculations
   - **Real-time functions:** Dashboard calculations, quick lookups

**Technical Considerations:**
- Database connection pooling and performance impact
- Maintainability trade-offs (TypeScript vs SQL)
- Testing strategies for stored procedures
- Version control and migration management
- Error handling and debugging capabilities

**Next Steps:**
1. Audit TypeScript codebase for migration candidates
2. Benchmark current stored procedure performance
3. Create optimization plan with performance targets
4. Implement changes incrementally with rollback strategy

**Priority:** Medium  
**Status:** Backlog - Needs Analysis  
**Dependencies:** None  
**Risk Level:** Medium (database changes require careful testing)
**Estimated Effort:** 2-3 weeks

**Success Metrics:**
- 20-30% improvement in data processing performance
- Reduced API response times for heavy operations
- Maintained code readability and maintainability


### 10. Transaction Export with User Feedback

**Description:**
Implement a transaction export feature that allows users to download their transaction data in CSV or Excel format, coupled with a feedback collection system to understand user needs and drive feature development.

**User Flow:**
1. User clicks "Download Transactions" button
2. Modal appears with:
   - Export format selection (CSV/Excel)
   - Date range picker (default: last 90 days)
   - Filter options (category, account, amount range)
   - Required feedback text field: "Please tell us why you're downloading this data and how you plan to use it. Your feedback helps us build better features!"
3. User completes form and submits
4. System generates file and initiates download
5. Feedback is stored with user context for product development

**Requirements:**
- Export modal component with form validation
- CSV and Excel generation capabilities
- Transaction filtering and date range selection
- Feedback storage system in Supabase
- Download progress indicators
- Export history tracking

**Technical Implementation:**
- Backend API endpoint for export generation
- Use libraries like `xlsx` for Excel export
- Feedback table schema: `user_id`, `export_reason`, `export_format`, `filters_applied`, `created_at`
- Rate limiting to prevent abuse
- Large dataset handling (pagination/streaming for exports >10k rows)

**Data Privacy Considerations:**
- Ensure exports only contain user's own data
- Add export logging for audit trail
- Consider data retention policies for exported files

**Priority:** Low  
**Status:** Backlog  
**Dependencies:** None  
**Risk Level:** Low (standard export functionality)
**Estimated Effort:** 1-2 weeks

**Success Metrics:**
- Successful export rate >95%
- User feedback collection rate >80%
- Export completion time <30 seconds for typical datasets

### 11. In-App Feedback System

**Description:**
Build a comprehensive feedback mechanism that allows users to provide suggestions, report issues, and request features directly within the application. Feedback should be tied to user accounts for context and used to drive product improvements.

**Features:**
1. **Feedback Modal:**
   - Triggered by floating feedback button (top-right corner)
   - Feedback type selection: Bug Report, Feature Request, General Feedback
   - Priority rating: Low, Medium, High
   - Rich text editor for detailed descriptions
   - Screenshot attachment capability
   - Current page/context auto-capture

2. **Feedback Management:**
   - Categorization and tagging system
   - Status tracking (New, In Progress, Resolved, Won't Fix)
   - Admin dashboard for review and prioritization
   - Response notifications to users

3. **User Context Integration:**
   - Link feedback to user account and subscription tier
   - Capture user's current view/data context
   - Track feedback history per user
   - Identify power users and frequent contributors

**Database Schema:**
```sql
feedback_entries:
  - id (uuid, pk)
  - user_id (uuid, fk)
  - type (enum: bug, feature, general)
  - priority (enum: low, medium, high)
  - title (text)
  - description (text)
  - context_url (text)
  - screenshot_path (text)
  - status (enum: new, in_progress, resolved, wont_fix)
  - admin_response (text)
  - created_at, updated_at
```

**Technical Requirements:**
- Feedback modal component with rich text editor
- File upload for screenshots (Supabase Storage)
- Admin dashboard for feedback management
- Email notifications for status updates
- Feedback analytics and reporting

**Priority:** Low  
**Status:** Backlog  
**Dependencies:** None  
**Risk Level:** Low (internal feature)  
**Estimated Effort:** 2-3 weeks

**Success Metrics:**
- Feedback submission completion rate >70%
- Response time <48 hours for high-priority items
- User satisfaction with feedback process

### 12. Internal Transfer Detection and Visualization

**Description:**
Develop a system to automatically identify and visualize internal transfers between user's accounts, particularly those using intermediary services like Venmo, Zelle, or PayPal. This will help users understand money movement within their financial ecosystem.

**Use Cases:**
- Spouse transfers money via Venmo: Checking → Venmo → Spouse's Checking
- Internal account moves: Checking → Savings
- Bill payment services: Checking → BillPay → Credit Card
- Investment transfers: Checking → Brokerage → Investment Account

**Detection Algorithm:**
1. **Time-based Matching:**
   - Look for transactions with same amounts within 24-48 hour window
   - Weight by proximity (closer = higher confidence)
   - Consider typical processing times for different providers

2. **Amount-based Matching:**
   - Exact amount matches (highest confidence)
   - Amount minus fees (Venmo instant transfer, etc.)
   - Round number patterns (e.g., $100.00, $500.00)

3. **Provider Pattern Recognition:**
   - Venmo: "Venmo *UserName*" patterns
   - Zelle: "Zelle *UserName*" patterns
   - PayPal: "PayPal *Merchant*" patterns
   - Internal: "Transfer to/from *AccountName*"

**Visualization Features:**
- Transfer chain view showing money flow
- Group related transactions in transaction list
- Transfer summary dashboard
- Net transfer calculations by time period
- Exclude internal transfers from cashflow calculations

**Technical Implementation:**
- Background job to scan for transfer patterns
- Transfer relationship table: `parent_tx_id`, `child_tx_id`, `confidence_score`
- UI components for transfer chain visualization
- Manual override capability for incorrect matches
- Performance optimization for large transaction sets

**Database Schema Addition:**
```sql
transfer_relationships:
  - id (uuid, pk)
  - parent_transaction_id (uuid, fk)
  - child_transaction_id (uuid, fk)
  - transfer_type (enum: direct, venmo, zelle, paypal, internal)
  - confidence_score (numeric 0-1)
  - is_confirmed (boolean, default false)
  - created_at
```

**Priority:** Low  
**Status:** Backlog  
**Dependencies:** Transaction categorization system  
**Risk Level:** Medium (complex matching logic)  
**Estimated Effort:** 3-4 weeks

**Success Metrics:**
- Transfer detection accuracy >85%
- False positive rate <10%
- User satisfaction with transfer visualization

### 13. Application Maintenance and Testing Framework

**Description:**
Establish a comprehensive maintenance schedule and automated testing framework to ensure application reliability, performance, and data integrity. This includes both human maintenance tasks and automated programmatic tests.

**Human Maintenance Schedule:**
1. **Daily Checks (5 minutes):**
   - Application health dashboard status
   - Error rate monitoring (Sentry/log analysis)
   - Database performance metrics
   - External service status (Plaid, Teller, email services)

2. **Weekly Reviews (30 minutes):**
   - User feedback review and prioritization
   - Performance trend analysis
   - Security scan results review
   - Backup verification checks

3. **Monthly Deep Dives (2 hours):**
   - Database optimization review
   - User behavior analytics
   - Feature usage statistics
   - Security audit and updates
   - Performance benchmarking

4. **Quarterly Planning (4 hours):**
   - Architecture review and technical debt assessment
   - Scalability planning
   - Dependency updates and security patches
   - Disaster recovery testing

**Automated Testing Framework:**
1. **Unit Tests (Vitest):**
   - Core business logic functions (cashflow calculations, categorization rules)
   - Utility functions and data transformations
   - Database query functions
   - Target: >90% code coverage for critical paths

2. **Integration Tests:**
   - API endpoint testing with real Supabase connections
   - Database migration testing
   - External service integration mocking
   - End-to-end user workflows

3. **Performance Tests:**
   - Load testing for transaction processing
   - Database query performance benchmarks
   - Frontend bundle size monitoring
   - API response time tracking

4. **Data Integrity Tests:**
   - Transaction categorization accuracy
   - Cashflow calculation verification
   - Account balance consistency
   - Cross-table relationship validation

**Critical Functionality Priority Matrix:**
**High Impact, High Frequency:**
- Transaction import and categorization
- Dashboard cashflow calculations
- User authentication and data access

**High Impact, Low Frequency:**
- Database migrations and schema updates
- Backup and restore procedures
- Security incident response

**Medium Impact, High Frequency:**
- Transaction search and filtering
- Budget planning calculations
- Export functionality

**Implementation Plan:**
1. **Phase 1 (Week 1-2):** Set up basic testing infrastructure
   - Configure Vitest with Supabase test database
   - Write tests for core business logic functions
   - Set up CI/CD pipeline for automated testing

2. **Phase 2 (Week 3-4):** Implement monitoring and alerting
   - Set up application health monitoring
   - Configure error tracking and alerting
   - Create maintenance dashboard

3. **Phase 3 (Week 5-6):** Build comprehensive test suite
   - Add integration tests for API endpoints
   - Implement performance monitoring
   - Create data integrity validation tests

**Priority:** Medium  
**Status:** Backlog - Needs MVP Completion  
**Dependencies:** MVP application completion  
**Risk Level:** Low (internal processes)  
**Estimated Effort:** 4-6 weeks

**Success Metrics:**
- Test coverage >85% for critical code paths
- Mean time to detection (MTTD) <1 hour for critical issues
- Maintenance task completion rate >90%
- Zero critical bugs in production for >30 days

### 14. Multi-User Architecture and Scaling

**Description:**
Transform the single-user application into a multi-tenant SaaS platform supporting multiple users with proper data isolation, security, and scalability considerations.

**Architecture Changes Required:**

1. **Database Multi-Tenancy:**
   - Add `user_id` and `tenant_id` to all user-facing tables
   - Implement Row Level Security (RLS) policies for data isolation
   - Create user management and authentication system
   - Add user profile and subscription management

2. **Data Model Updates:**
```sql
-- New tables needed
users:
  - id (uuid, pk)
  - email (text, unique)
  - name (text)
  - subscription_tier (enum: free, premium, enterprise)
  - is_active (boolean)
  - created_at, updated_at

tenants:
  - id (uuid, pk)
  - name (text)
  - owner_user_id (uuid, fk)
  - subscription_status (enum: trial, active, past_due, cancelled)
  - billing_cycle_start (date)
  - created_at, updated_at

user_tenant_memberships:
  - id (uuid, pk)
  - user_id (uuid, fk)
  - tenant_id (uuid, fk)
  - role (enum: owner, admin, member, viewer)
  - invited_at (timestamptz)
  - joined_at (timestamptz)
```

3. **Security Implementation:**
   - Row Level Security (RLS) policies on all tables
   - JWT token-based authentication
   - Role-based access control (RBAC)
   - API rate limiting per user/tenant
   - Data encryption for sensitive information

4. **Performance and Scaling:**
   - Database connection pooling (PgBouncer)
   - Caching layer (Redis) for frequently accessed data
   - CDN for static assets
   - Database indexing strategy for multi-tenant queries
   - Query optimization for tenant-scoped data

5. **User Experience Changes:**
   - User registration and onboarding flow
   - Tenant creation and management
   - Team invitation system
   - User switching for multi-tenant users
   - Tenant-scoped navigation and branding

**Migration Strategy:**
1. **Phase 1 - Schema Migration:**
   - Add user/tenant columns to existing tables
   - Create new user management tables
   - Migrate existing data to single-tenant structure
   - Implement RLS policies

2. **Phase 2 - Authentication:**
   - Implement user registration/login
   - Add JWT token management
   - Create user session handling
   - Update API endpoints for authentication

3. **Phase 3 - Frontend Updates:**
   - Add authentication UI components
   - Implement tenant switching
   - Update all data fetching to be tenant-aware
   - Add user management interface

**Technical Considerations:**
- **Data Migration:** Safely migrate existing single-user data
- **Performance:** Ensure multi-tenant queries don't impact performance
- **Security:** Prevent data leakage between tenants
- **Backup/Recovery:** Tenant-level backup and restore capabilities
- **Compliance:** GDPR, CCPA compliance for user data

**Priority:** Medium  
**Status:** Backlog  
**Dependencies:** None (but should be done after MVP stability)  
**Risk Level:** High (complex architectural changes)  
**Estimated Effort:** 8-12 weeks

**Success Metrics:**
- Zero data leakage between tenants
- Page load times <2 seconds with 1000+ tenants
- User registration completion rate >80%
- Support for 10,000+ concurrent users

### 15. Stripe Payment Integration and Subscription Management

**Description:**
Implement a comprehensive payment system using Stripe for subscription management, billing, and payment processing with proper security, scalability, and audit capabilities.

**Payment Features Required:**

1. **Subscription Tiers:**
   - **Free Tier:** Basic transaction viewing, limited categories
   - **Premium Tier ($9.99/month):** Unlimited transactions, advanced categorization, export features
   - **Enterprise Tier ($29.99/month):** Multi-user support, API access, advanced analytics

2. **Stripe Integration Components:**
   - Payment method collection (credit cards, ACH)
   - Subscription lifecycle management
   - Automated billing and invoicing
   - Failed payment handling and retry logic
   - Refund processing
   - Tax calculation and compliance

3. **Database Schema for Billing:**
```sql
subscription_plans:
  - id (uuid, pk)
  - name (text)
  - stripe_price_id (text)
  - amount (numeric)
  - currency (text, default 'usd')
  - billing_interval (enum: month, year)
  - features (jsonb)
  - is_active (boolean)

user_subscriptions:
  - id (uuid, pk)
  - user_id (uuid, fk)
  - plan_id (uuid, fk)
  - stripe_subscription_id (text)
  - status (enum: trial, active, past_due, cancelled, unpaid)
  - current_period_start (timestamptz)
  - current_period_end (timestamptz)
  - cancel_at_period_end (boolean)
  - created_at, updated_at

payment_methods:
  - id (uuid, pk)
  - user_id (uuid, fk)
  - stripe_payment_method_id (text)
  - type (enum: card, bank_account)
  - last4 (text)
  - brand (text)
  - expires_month (int)
  - expires_year (int)
  - is_default (boolean)
  - created_at

invoices:
  - id (uuid, pk)
  - user_id (uuid, fk)
  - stripe_invoice_id (text)
  - amount (numeric)
  - currency (text)
  - status (enum: draft, open, paid, uncollectible, void)
  - due_date (timestamptz)
  - paid_at (timestamptz)
  - created_at
```

4. **Security and Compliance:**
   - PCI DSS compliance for payment processing
   - Stripe Elements for secure payment collection
   - Webhook signature verification
   - Sensitive data encryption
   - Audit logging for all payment operations
   - Fraud detection and prevention

5. **User Experience:**
   - Plan comparison and selection page
   - Payment method management interface
   - Billing history and invoice downloads
   - Subscription upgrade/downgrade flow
   - Cancellation flow with retention offers
   - Payment failure handling and retry UI

**Implementation Phases:**

**Phase 1 - Core Integration (Week 1-2):**
- Set up Stripe account and webhook endpoints
- Implement basic subscription creation
- Add payment method collection
- Create billing database schema

**Phase 2 - Management Interface (Week 3-4):**
- Build subscription management UI
- Implement plan upgrade/downgrade
- Add billing history and invoices
- Create admin dashboard for subscription monitoring

**Phase 3 - Advanced Features (Week 5-6):**
- Implement tax calculation
- Add refund processing
- Create dunning management for failed payments
- Build analytics and reporting for subscription metrics

**Technical Requirements:**
- Stripe SDK integration (Node.js backend)
- Stripe Elements for frontend payment forms
- Webhook handlers for Stripe events
- Error handling and retry logic
- Database transaction management for payment operations
- Logging and monitoring for payment events

**Priority:** Medium  
**Status:** Backlog  
**Dependencies:** Multi-user architecture (Feature #14)  
**Risk Level:** High (payment processing requires extreme care)  
**Estimated Effort:** 6-8 weeks

**Success Metrics:**
- Payment success rate >95%
- Subscription conversion rate >15% from free to paid
- Churn rate <5% monthly
- Zero payment-related security incidents
- Billing dispute rate <1%

### 16. Competitive Subscription Model Design

**Description:**
Research and design a subscription pricing model that is competitive in the personal finance software market while providing clear value propositions that align with the features and capabilities of the Financial Command Center.

**Market Research Required:**
1. **Competitor Analysis:**
   - **Mint:** Free with ads, basic features
   - **YNAB:** $84/year ($7/month) - budgeting focused
   - **Personal Capital:** Free with wealth management upsell
   - **Copilot:** $95/year ($8/month) - modern UI, good categorization
   - **Tiller:** $79/year ($6.58/month) - spreadsheet-focused
   - **Monarch Money:** $99/year ($8.25/month) - comprehensive features

2. **Value Proposition Analysis:**
   - **Unique Strengths:** Transaction categorization accuracy, cashflow focus, transfer detection
   - **Target Audience:** financially savvy households, small business owners
   - **Key Differentiators:** AI-powered categorization, internal transfer visualization

**Proposed Subscription Tiers:**

**Free Tier - "Starter":**
- Up to 3 bank connections
- 500 transactions per month
- Basic categorization (manual)
- Dashboard view only
- Community support
- **Value:** User acquisition, feature demonstration

**Premium Tier - "Plus" - $9.99/month or $99/year:**
- Unlimited bank connections
- Unlimited transactions
- AI-powered categorization
- Advanced analytics and reporting
- Transaction export (CSV/Excel)
- Priority email support
- Mobile app access
- **Value:** Core product experience, revenue generation

**Business Tier - "Pro" - $29.99/month or $299/year:**
- Everything in Plus
- Multi-user support (up to 5 users)
- API access for integrations
- Custom categorization rules engine
- Advanced transfer detection
- White-label options
- Phone support
- **Value:** Power users, small businesses, high LTV customers

**Enterprise Tier - Custom Pricing:**
- Unlimited users
- Custom integrations
- Dedicated account manager
- SLA guarantees
- Custom reporting
- On-premise deployment option

**Pricing Strategy Considerations:**

1. **Psychological Pricing:**
   - Use .99 endings for perceived value
   - Annual discount (17% off) for customer retention
   - Price anchoring with higher tiers

2. **Feature Gating Strategy:**
   - **Free:** Must-have features to drive adoption
   - **Premium:** Core differentiated features
   - **Business:** Advanced/power user features
   - **Enterprise:** Custom/enterprise requirements

3. **Conversion Optimization:**
   - 14-day free trial of Premium features
   - Feature usage triggers for upgrade prompts
   - Gradual feature limitations (not hard walls)
   - Value-based messaging at upgrade points

**Implementation Requirements:**
1. **Feature Flagging System:**
   - Implement feature flags for all tier-based features
   - Usage tracking for feature limits
   - Graceful degradation when limits reached

2. **Upgrade/Downgrade Flows:**
   - In-app upgrade prompts with value messaging
   - Seamless plan changes without data loss
   - Prorated billing calculations
   - Retention offers for cancellations

3. **Analytics and Tracking:**
   - Conversion funnel analysis
   - Feature usage by tier
   - Customer lifetime value tracking
   - Churn prediction and prevention

**Priority:** Medium  
**Status:** Backlog  
**Dependencies:** Stripe payment integration (Feature #15)  
**Risk Level:** Medium (market validation required)  
**Estimated Effort:** 2-3 weeks (research and design) + 4-6 weeks (implementation)

**Success Metrics:**
- Free-to-paid conversion rate >12%
- Customer acquisition cost (CAC) < $50
- Customer lifetime value (LTV) > $300
- Monthly recurring revenue (MRR) growth >20% month-over-month
- Churn rate <8% monthly

---

### 17. Unified Transactions and Review Queue Page

**Description:**  
Merge the separate Transactions and Review Queue pages into a single, unified interface to simplify the user experience and reduce navigation complexity.

**Current State:**  
- Transactions page: Full transaction list with filtering and inline editing
- Review Queue page: Focused view of uncategorized/low-confidence transactions
- Users must navigate between two pages to manage their transactions

**Proposed Unified Design:**  
1. **Two-Table Layout:**
   - **Top Table:** "Top 5 transactions to review" (from Feature #18)
   - **Bottom Table:** Full transaction list with all current functionality

2. **Enhanced Metrics Section:**
   - Move "To Review Metrics" from Review Queue page to Transactions page
   - Change "Processed" to "Processed Today"
   - Add new "Categorized" metric showing total categorized transactions
   - Include notification icon counter for transactions needing review

3. **Unified Filtering:**
   - Apply all Review Queue filtering options to the main transaction table
   - Filter by confidence level, amount ranges, date ranges, categories
   - Filter state persistence based on user preference

4. **Enhanced Review Experience:**
   - Highlight transactions needing categorization with visual indicators
   - Bulk categorization tools available in both tables
   - Priority sorting for review queue items (confidence score, amount, frequency)

5. **UI Improvements:**
   - Cleaner navigation with one less top-level menu item
   - Better visual hierarchy with clear separation between tables
   - Contextual actions based on transaction categorization status

**Requirements:**
- Create two-table layout with Top 5 review section and full transaction table
- Move Review Queue metrics to Transactions page with updated naming
- Add notification counter for transactions needing review
- Apply all Review Queue filters to main transaction table
- Maintain all current filtering and editing capabilities
- Add smart categorization indicators
- Implement filter state persistence
- Ensure performance with large transaction sets
- Update navigation structure

**Technical Considerations:**
- URL routing for view states (/transactions?view=review)
- Component refactoring to share logic between views
- Performance optimization for combined data loading
- State management for filter preferences

**Priority:** Medium  
**Status:** Backlog  
**Dependencies:** 
- Transactions page functionality (workflow 04)
- Review queue functionality (workflow 10)
- Categorization system

**Risk Level:** Low (UI consolidation, no new backend logic)  
**Estimated Effort:** 1-2 weeks

**Success Metrics:**
- Reduced navigation clicks (goal: 50% fewer page transitions)
- User satisfaction with unified interface
- No loss of existing functionality
- Faster transaction review completion time

---

### 18. Daily Top 5 Categorization Suggestions

**Description:**  
Add a "Top 5 to Categorize" section on the unified Transactions page that surfaces the most important transactions needing user attention, refreshed daily to provide focused categorization priorities.

**Algorithm Logic:**  
The top 5 suggestions are selected from the full review queue based on:

1. **Frequency Score (40% weight):**
   - Count of similar transactions by description/pattern
   - Higher frequency = higher priority (e.g., recurring "Netflix" charges)

2. **Amount Score (30% weight):**
   - Higher absolute amounts get priority
   - Large transactions have bigger budget impact

3. **Confidence Score (30% weight):**
   - Lower categorization confidence = higher priority
   - AI uncertainty indicates need for human input

**Selection Process:**
```sql
-- Simplified example of selection logic
SELECT * FROM review_queue 
WHERE created_at >= CURRENT_DATE - INTERVAL '7 days'
ORDER BY (
  (frequency_score * 0.4) + 
  (amount_score * 0.3) + 
  ((1 - confidence_score) * 0.3)
) DESC 
LIMIT 5
```

**UI Design:**
- Compact card section at top of Transactions page
- Shows: merchant/description, amount, suggested category, confidence score
- Quick categorization buttons (Accept/Override/Skip)
- "View All Review Items" link to full review queue
- Daily reset indicator ("Updated today at 6:00 AM")

**Features:**
1. **Smart Refresh:** Resets daily at 6:00 AM server time
2. **Exclusion Logic:** Skips already categorized items
3. **Persistence:** Remembers user dismissals within the day
4. **Contextual Actions:** One-click categorization from suggestions

**Database Requirements:**
- Add `suggestion_priority` column to transactions table
- Background job to calculate daily scores
- Track user interaction with suggestions

**Technical Implementation:**
- Daily cron job to calculate top 5 suggestions
- Cache results for performance
- API endpoint for suggestion data
- Frontend component for suggestion display

**Priority:** Medium  
**Status:** Backlog  
**Dependencies:** 
- Unified Transactions page (Feature #17)
- Categorization confidence scoring
- Review queue data pipeline

**Risk Level:** Low (algorithmic feature, safe to iterate)  
**Estimated Effort:** 1-2 weeks

**Success Metrics:**
- Daily categorization completion rate increase (goal: +25%)
- User engagement with suggestion feature
- Reduced average age of uncategorized transactions
- Positive user feedback on prioritization

---

### 19. Dynamic Template Swapping System

**Description:**  
Create a flexible template system that allows the application UI to be dynamically changed based on JSON configuration files. This enables AI-driven design extraction from screenshots and real-time template switching from the frontend.

**Use Cases:**
1. **AI Design Extraction:** Upload screenshot → AI extracts design patterns → generates structured JSON → apply as new template
2. **A/B Testing:** Switch between different UI templates to test user engagement
3. **Branding:** Apply different color schemes and layouts for different users/contexts
4. **Rapid Prototyping:** Test new UI designs without code changes

**Template Structure:**
```json
{
  "template": {
    "name": "Modern Dark Theme",
    "version": "1.0.0",
    "author": "AI Designer",
    "created_at": "2026-01-04T00:00:00Z",
    "components": {
      "colors": {
        "primary": "#3b82f6",
        "secondary": "#64748b", 
        "accent": "#f59e0b",
        "background": "#0f172a",
        "surface": "#1e293b",
        "text": "#f1f5f9",
        "text_secondary": "#94a3b8"
      },
      "typography": {
        "font_family": "Inter, sans-serif",
        "font_sizes": {
          "xs": "0.75rem",
          "sm": "0.875rem", 
          "base": "1rem",
          "lg": "1.125rem",
          "xl": "1.25rem",
          "2xl": "1.5rem",
          "3xl": "1.875rem"
        },
        "font_weights": {
          "normal": "400",
          "medium": "500",
          "semibold": "600",
          "bold": "700"
        }
      },
      "spacing": {
        "xs": "0.25rem",
        "sm": "0.5rem",
        "md": "1rem", 
        "lg": "1.5rem",
        "xl": "2rem",
        "2xl": "3rem"
      },
      "components": {
        "card": {
          "border_radius": "0.5rem",
          "border_width": "1px",
          "shadow": "0 1px 3px 0 rgb(0 0 0 / 0.1)",
          "padding": "1rem"
        },
        "button": {
          "border_radius": "0.375rem",
          "padding_x": "1rem",
          "padding_y": "0.5rem",
          "font_weight": "500"
        },
        "table": {
          "border_radius": "0.5rem",
          "cell_padding": "0.75rem",
          "header_background": "#f8fafc",
          "stripe_color": "#f1f5f9"
        }
      },
      "layout": {
        "container_max_width": "1280px",
        "sidebar_width": "256px",
        "header_height": "64px",
        "card_gap": "1rem"
      }
    }
  }
}
```

**System Architecture:**

1. **Template Storage:**
   - JSON files in `templates/` directory
   - Database table for user custom templates
   - Template validation and versioning

2. **Template Engine:**
   - CSS-in-JS or CSS custom properties generation
   - Component styling overrides
   - Tailwind CSS dynamic configuration

3. **Template Manager:**
   - Template loading and caching
   - Validation and error handling
   - Fallback to default template

4. **Frontend Template Selector:**
   - Template gallery/preview
   - Real-time template switching
   - Template creation/upload interface

**Implementation Plan:**

**Phase 1 - Core Template System (Week 1-2):**
- Create template JSON schema and validation
- Build template engine for CSS generation
- Implement template loading and caching
- Create basic template selector component

**Phase 2 - AI Integration (Week 3-4):**
- Build screenshot upload interface
- Integrate with AI service for design extraction
- Create template generation from AI output
- Add template preview and editing

**Phase 3 - Advanced Features (Week 5-6):**
- Template gallery and sharing
- User custom template creation
- Template versioning and rollback
- Performance optimization

**Database Schema:**
```sql
templates:
  - id (uuid, pk)
  - name (text)
  - description (text)
  - config (jsonb)
  - is_active (boolean)
  - is_default (boolean)
  - created_by (uuid, fk users)
  - created_at, updated_at

user_template_preferences:
  - id (uuid, pk)
  - user_id (uuid, fk)
  - template_id (uuid, fk)
  - applied_at (timestamptz)
```

**Technical Requirements:**
- Template validation using JSON Schema
- CSS-in-JS library (styled-components, emotion) or CSS custom properties
- Dynamic Tailwind config generation
- File upload handling for screenshots
- AI service integration (OpenAI Vision, Claude, etc.)
- Template preview generation
- Performance optimization for template switching

**Frontend Components:**
- `TemplateSelector.tsx` - Template gallery and selection
- `TemplatePreview.tsx` - Live template preview
- `TemplateEditor.tsx` - Manual template editing
- `ScreenshotUploader.tsx` - Screenshot upload for AI extraction

**Security Considerations:**
- Template file validation and sanitization
- User-uploaded template sandboxing
- AI service API key management
- Template access control and permissions

**Priority:** Medium  
**Status:** Backlog  
**Dependencies:** None (standalone feature)  
**Risk Level:** Medium (complex CSS generation, AI integration)  
**Estimated Effort:** 4-6 weeks

**Success Metrics:**
- Template switching time <2 seconds
- AI template extraction accuracy >80%
- User template creation rate
- Template system adoption rate
- UI consistency across templates

**Future Enhancements:**
- Component-level template overrides
- Template marketplace/sharing
- Real-time collaborative template editing
- Template analytics and usage tracking
- Mobile-specific templates


