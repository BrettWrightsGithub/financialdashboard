---
description: Modernize the application shell with a collapsible left-side drawer navigation. Replaces traditional top navbar for better space utilization.
auto_execution_mode: 1
---

## Phase 3: Workflow Polish – UI Overhaul

**Context:** Modernizes the application shell for better space utilization and usability. Replaces the traditional top navbar with a collapsible side drawer.

## Layout Structure

```
┌────┬────────────────────────────────────────────────────────┐
│ ☰  │                                                        │
│    │                                                        │
│ 🏠 │                    MAIN CONTENT                        │
│    │                                                        │
│ 📊 │                                                        │
│    │                                                        │
│ 💰 │                                                        │
│    │                                                        │
│    │                                                        │
│    │                                                        │
├────┤                                                        │
│ 👤 │                                                        │
│ ⚙️ │                                                        │
└────┴────────────────────────────────────────────────────────┘

Collapsed (64px)          Expanded (240px)
┌────┐                    ┌──────────────────┐
│ ☰  │                    │ 💰 Command Center│
│ 🏠 │                    │ 🏠 Dashboard     │
│ 📊 │                    │ 📊 Transactions  │
│ 💰 │                    │ 💰 Budget        │
│    │                    │                  │
│ 👤 │                    │ 👤 Profile       │
│ ⚙️ │                    │ ⚙️ Settings      │
└────┘                    └──────────────────┘
```

## Steps

### 1. Create Sidebar Component

Create `components/layout/Sidebar.tsx`:

```tsx
'use client'

import { useState } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import {
  LayoutDashboard,
  Receipt,
  PiggyBank,
  Settings,
  User,
  ChevronLeft,
  ChevronRight,
  DollarSign
} from 'lucide-react'

const NAV_ITEMS = [
  { href: '/', icon: LayoutDashboard, label: 'Dashboard' },
  { href: '/transactions', icon: Receipt, label: 'Transactions' },
  { href: '/budget-planner', icon: PiggyBank, label: 'Budget Planner' },
]

const BOTTOM_ITEMS = [
  { href: '/profile', icon: User, label: 'Profile' },
  { href: '/admin', icon: Settings, label: 'Settings' },
]

export function Sidebar() {
  const [expanded, setExpanded] = useState(true)
  const pathname = usePathname()

  return (
    <aside className={`fixed left-0 top-0 h-screen bg-gray-900 text-white flex flex-col transition-all duration-300 z-40 ${expanded ? 'w-60' : 'w-16'}`}>
      {/* Logo/Brand */}
      <div className="h-16 flex items-center px-4 border-b border-gray-800">
        <DollarSign className="w-8 h-8 text-green-500 flex-shrink-0" />
        {expanded && <span className="ml-3 font-bold text-lg">Command Center</span>}
      </div>

      {/* Toggle Button */}
      <button
        onClick={() => setExpanded(!expanded)}
        className="absolute -right-3 top-20 w-6 h-6 bg-gray-700 rounded-full flex items-center justify-center hover:bg-gray-600"
      >
        {expanded ? <ChevronLeft className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
      </button>

      {/* Main Navigation */}
      <nav className="flex-1 py-4">
        {NAV_ITEMS.map((item) => (
          <NavItem key={item.href} item={item} expanded={expanded} isActive={pathname === item.href} />
        ))}
      </nav>

      {/* Bottom Navigation */}
      <div className="border-t border-gray-800 py-4">
        {BOTTOM_ITEMS.map((item) => (
          <NavItem key={item.href} item={item} expanded={expanded} isActive={pathname === item.href} />
        ))}
      </div>
    </aside>
  )
}

function NavItem({ item, expanded, isActive }) {
  return (
    <Link
      href={item.href}
      className={`flex items-center px-4 py-3 mx-2 rounded-lg transition-colors ${isActive ? 'bg-gray-800 text-white' : 'text-gray-400 hover:bg-gray-800 hover:text-white'}`}
    >
      <item.icon className="w-5 h-5 flex-shrink-0" />
      {expanded && <span className="ml-3">{item.label}</span>}
    </Link>
  )
}
```

### 2. Create Layout Wrapper

Update `app/layout.tsx`:

```tsx
import { Sidebar } from '@/components/layout/Sidebar'

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body>
        <Sidebar />
        <main className="ml-16 lg:ml-60 min-h-screen transition-all duration-300">
          {children}
        </main>
      </body>
    </html>
  )
}
```

### 3. Add Mobile Responsiveness

Create `components/layout/MobileNav.tsx`:

```tsx
'use client'

import { useState } from 'react'
import { Menu, X } from 'lucide-react'

export function MobileNav() {
  const [open, setOpen] = useState(false)

  return (
    <>
      {/* Hamburger Button - visible only on mobile */}
      <button
        onClick={() => setOpen(true)}
        className="lg:hidden fixed top-4 left-4 z-50 p-2 bg-gray-900 text-white rounded-lg"
      >
        <Menu className="w-6 h-6" />
      </button>

      {/* Overlay Drawer */}
      {open && (
        <>
          <div className="fixed inset-0 bg-black/50 z-40" onClick={() => setOpen(false)} />
          <aside className="fixed left-0 top-0 h-screen w-60 bg-gray-900 z-50">
            {/* Same nav content as Sidebar */}
            <button onClick={() => setOpen(false)} className="absolute right-4 top-4">
              <X className="w-6 h-6 text-white" />
            </button>
          </aside>
        </>
      )}
    </>
  )
}
```

### 4. Handle Sidebar State Persistence

```tsx
// Use localStorage to remember preference
useEffect(() => {
  const saved = localStorage.getItem('sidebar-expanded')
  if (saved !== null) setExpanded(JSON.parse(saved))
}, [])

useEffect(() => {
  localStorage.setItem('sidebar-expanded', JSON.stringify(expanded))
}, [expanded])
```

### 5. Add Keyboard Shortcut

```tsx
useEffect(() => {
  function handleKeydown(e: KeyboardEvent) {
    if (e.key === '[' && (e.metaKey || e.ctrlKey)) {
      e.preventDefault()
      setExpanded(prev => !prev)
    }
  }
  window.addEventListener('keydown', handleKeydown)
  return () => window.removeEventListener('keydown', handleKeydown)
}, [])
```

### 6. Settings Gear Navigation

Clicking the gear icon navigates to `/admin`:

```tsx
{ href: '/admin', icon: Settings, label: 'Settings' }
```

The `/admin` page contains:
- Account connections management
- Rule configuration
- Batch history
- System settings

### 7. Update Tailwind Config

Add sidebar transition classes:

```js
// tailwind.config.ts
theme: {
  extend: {
    transitionProperty: {
      'width': 'width',
      'spacing': 'margin, padding',
    }
  }
}
```

### 8. Remove Old Navigation

Delete or deprecate `components/Navigation.tsx` (top navbar).

### 9. Write Tests

- Sidebar renders in expanded/collapsed state
- Toggle button works
- Active state highlights correctly
- Mobile hamburger menu works
- Keyboard shortcut toggles sidebar

### 10. Puppeteer Verification

Use the Puppeteer MCP server to:
- Navigate to http://localhost:3000
- Take screenshot of expanded sidebar
- Click toggle button, take screenshot of collapsed
- Resize to mobile width, verify hamburger appears
- Test navigation to all pages
