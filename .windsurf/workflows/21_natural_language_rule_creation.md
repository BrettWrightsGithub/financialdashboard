---
description: Implement natural language rule creation via chat assistant interface. Users type "Categorize Starbucks under $15 as Coffee" and the system generates a rule. Replaces/Augments workflow 06.
auto_execution_mode: 1
---

## Phase 2: The "Assistant" Interface – Feature #1

**Context:** Replaces/Augments workflow 06 (Rules Engine).  
**Research Alignment:** "Hybrid Intelligence" – synthesizing deterministic logic (JSON rules) via adaptive reasoning (LLM).

## User Story

> As a user, I see a recurring "Starbucks" charge. Instead of opening a settings menu, I click the "Assistant" icon and type: "Categorize Starbucks under $15 as Coffee, but over $15 as Dining." The Assistant confirms the rule and saves it.

## Architecture Overview

```
┌─────────────────────────────────────────────────────────────────┐
│                    NL Rule Creation Flow                        │
├─────────────────────────────────────────────────────────────────┤
│  1. User Input     │ Chat message + optional selected tx        │
│  2. LLM Parse      │ Extract intent → structured rule JSON      │
│  3. Verification   │ Show rule card for user confirmation       │
│  4. Save           │ POST /api/categorization/rules             │
│  5. Backfill?      │ Optional: apply to existing transactions   │
└─────────────────────────────────────────────────────────────────┘
```

## Steps

### 1. Create Chat Assistant Component

Create `components/assistant/ChatAssistant.tsx`:

```tsx
'use client'

import { useState, useRef, useEffect } from 'react'
import { MessageSquare, X, Send, Loader2, Check, AlertCircle } from 'lucide-react'
import { RulePreviewCard } from './RulePreviewCard'

interface Message {
  id: string
  role: 'user' | 'assistant' | 'system'
  content: string
  rulePreview?: GeneratedRule
  status?: 'pending' | 'confirmed' | 'cancelled'
}

interface ChatAssistantProps {
  selectedTransaction?: Transaction | null
  onRuleCreated?: (rule: CategoriesRule) => void
}

export function ChatAssistant({ selectedTransaction, onRuleCreated }: ChatAssistantProps) {
  const [isOpen, setIsOpen] = useState(false)
  const [messages, setMessages] = useState<Message[]>([])
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const messagesEndRef = useRef<HTMLDivElement>(null)

  // Auto-scroll to bottom
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  // Context-aware greeting when transaction selected
  useEffect(() => {
    if (selectedTransaction && isOpen && messages.length === 0) {
      setMessages([{
        id: 'welcome',
        role: 'assistant',
        content: `I see you've selected a transaction from "${selectedTransaction.description_clean}" for $${Math.abs(selectedTransaction.amount).toFixed(2)}. How would you like to categorize it? You can say things like:\n\n• "Categorize this as Groceries"\n• "Create a rule: all Starbucks under $15 → Coffee"\n• "Mark similar transactions as transfers"`
      }])
    }
  }, [selectedTransaction, isOpen])

  async function handleSend() {
    if (!input.trim() || loading) return

    const userMessage: Message = {
      id: Date.now().toString(),
      role: 'user',
      content: input
    }
    setMessages(prev => [...prev, userMessage])
    setInput('')
    setLoading(true)

    try {
      const response = await fetch('/api/assistant/parse-rule', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: input,
          selectedTransaction: selectedTransaction || null
        })
      })

      const data = await response.json()

      if (data.rule) {
        const assistantMessage: Message = {
          id: (Date.now() + 1).toString(),
          role: 'assistant',
          content: 'Here\'s the rule I designed based on your request:',
          rulePreview: data.rule,
          status: 'pending'
        }
        setMessages(prev => [...prev, assistantMessage])
      } else if (data.clarification) {
        setMessages(prev => [...prev, {
          id: (Date.now() + 1).toString(),
          role: 'assistant',
          content: data.clarification
        }])
      } else {
        setMessages(prev => [...prev, {
          id: (Date.now() + 1).toString(),
          role: 'assistant',
          content: data.response || 'I couldn\'t understand that request. Try something like "Categorize Amazon purchases over $100 as Shopping".'
        }])
      }
    } catch (error) {
      setMessages(prev => [...prev, {
        id: (Date.now() + 1).toString(),
        role: 'system',
        content: 'Failed to process request. Please try again.'
      }])
    } finally {
      setLoading(false)
    }
  }

  async function handleConfirmRule(messageId: string, rule: GeneratedRule) {
    setLoading(true)

    try {
      const response = await fetch('/api/categorization/rules', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(rule)
      })

      if (response.ok) {
        const savedRule = await response.json()
        
        setMessages(prev => prev.map(m => 
          m.id === messageId ? { ...m, status: 'confirmed' } : m
        ))
        
        setMessages(prev => [...prev, {
          id: Date.now().toString(),
          role: 'assistant',
          content: `✅ Rule saved! "${rule.name}" will now categorize matching transactions automatically.\n\nWould you like to apply this rule to existing transactions?`
        }])

        onRuleCreated?.(savedRule)
      }
    } catch (error) {
      setMessages(prev => [...prev, {
        id: Date.now().toString(),
        role: 'system',
        content: 'Failed to save rule. Please try again.'
      }])
    } finally {
      setLoading(false)
    }
  }

  function handleCancelRule(messageId: string) {
    setMessages(prev => prev.map(m => 
      m.id === messageId ? { ...m, status: 'cancelled' } : m
    ))
    setMessages(prev => [...prev, {
      id: Date.now().toString(),
      role: 'assistant',
      content: 'No problem! Let me know if you\'d like to try a different approach.'
    }])
  }

  return (
    <>
      {/* Floating Action Button */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="fixed bottom-6 right-6 w-14 h-14 bg-blue-600 text-white rounded-full shadow-lg hover:bg-blue-700 transition-colors flex items-center justify-center z-50"
      >
        {isOpen ? <X className="w-6 h-6" /> : <MessageSquare className="w-6 h-6" />}
      </button>

      {/* Chat Panel */}
      {isOpen && (
        <div className="fixed bottom-24 right-6 w-96 h-[500px] bg-white rounded-lg shadow-2xl border flex flex-col z-50">
          {/* Header */}
          <div className="p-4 border-b bg-blue-600 text-white rounded-t-lg">
            <h3 className="font-semibold">Rule Assistant</h3>
            <p className="text-sm text-blue-100">Create rules using natural language</p>
          </div>

          {/* Context Banner */}
          {selectedTransaction && (
            <div className="p-2 bg-blue-50 border-b text-sm">
              <span className="text-gray-600">Context: </span>
              <span className="font-medium">{selectedTransaction.description_clean}</span>
              <span className="text-gray-500"> (${Math.abs(selectedTransaction.amount).toFixed(2)})</span>
            </div>
          )}

          {/* Messages */}
          <div className="flex-1 overflow-y-auto p-4 space-y-4">
            {messages.map(message => (
              <div key={message.id} className={`flex ${message.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                <div className={`max-w-[80%] rounded-lg p-3 ${
                  message.role === 'user' 
                    ? 'bg-blue-600 text-white' 
                    : message.role === 'system'
                    ? 'bg-red-100 text-red-800'
                    : 'bg-gray-100 text-gray-800'
                }`}>
                  <p className="whitespace-pre-wrap text-sm">{message.content}</p>
                  
                  {message.rulePreview && message.status === 'pending' && (
                    <div className="mt-3">
                      <RulePreviewCard rule={message.rulePreview} />
                      <div className="flex gap-2 mt-2">
                        <button
                          onClick={() => handleConfirmRule(message.id, message.rulePreview!)}
                          disabled={loading}
                          className="flex-1 py-2 bg-green-600 text-white rounded text-sm hover:bg-green-700 disabled:opacity-50"
                        >
                          <Check className="w-4 h-4 inline mr-1" />
                          Confirm
                        </button>
                        <button
                          onClick={() => handleCancelRule(message.id)}
                          disabled={loading}
                          className="flex-1 py-2 bg-gray-300 text-gray-700 rounded text-sm hover:bg-gray-400"
                        >
                          Cancel
                        </button>
                      </div>
                    </div>
                  )}

                  {message.status === 'confirmed' && message.rulePreview && (
                    <div className="mt-3">
                      <RulePreviewCard rule={message.rulePreview} />
                      <div className="mt-2 text-green-700 text-sm flex items-center gap-1">
                        <Check className="w-4 h-4" />
                        Rule saved
                      </div>
                    </div>
                  )}
                </div>
              </div>
            ))}
            {loading && (
              <div className="flex justify-start">
                <div className="bg-gray-100 rounded-lg p-3">
                  <Loader2 className="w-5 h-5 animate-spin text-gray-500" />
                </div>
              </div>
            )}
            <div ref={messagesEndRef} />
          </div>

          {/* Input */}
          <div className="p-4 border-t">
            <div className="flex gap-2">
              <input
                type="text"
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleSend()}
                placeholder="e.g., Categorize Starbucks as Coffee..."
                className="flex-1 px-3 py-2 border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
              <button
                onClick={handleSend}
                disabled={loading || !input.trim()}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
              >
                <Send className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
```

### 2. Create Rule Preview Card Component

Create `components/assistant/RulePreviewCard.tsx`:

```tsx
interface RulePreviewCardProps {
  rule: GeneratedRule
}

export function RulePreviewCard({ rule }: RulePreviewCardProps) {
  return (
    <div className="bg-white border rounded-lg p-3 text-sm">
      <div className="font-medium text-gray-900 mb-2">{rule.name}</div>
      
      <div className="space-y-1 text-gray-600">
        {/* Match Conditions */}
        <div className="flex items-start gap-2">
          <span className="text-gray-400 w-16">Match:</span>
          <div>
            {rule.match_merchant_contains && (
              <span className="bg-blue-100 text-blue-800 px-2 py-0.5 rounded text-xs">
                Contains "{rule.match_merchant_contains}"
              </span>
            )}
            {rule.match_merchant_exact && (
              <span className="bg-purple-100 text-purple-800 px-2 py-0.5 rounded text-xs">
                Exact "{rule.match_merchant_exact}"
              </span>
            )}
          </div>
        </div>

        {/* Amount Range */}
        {(rule.match_amount_min || rule.match_amount_max) && (
          <div className="flex items-start gap-2">
            <span className="text-gray-400 w-16">Amount:</span>
            <span className="text-gray-800">
              {rule.match_amount_min && `≥ $${rule.match_amount_min}`}
              {rule.match_amount_min && rule.match_amount_max && ' and '}
              {rule.match_amount_max && `≤ $${rule.match_amount_max}`}
            </span>
          </div>
        )}

        {/* Category Assignment */}
        <div className="flex items-start gap-2">
          <span className="text-gray-400 w-16">Assign:</span>
          <span className="bg-green-100 text-green-800 px-2 py-0.5 rounded text-xs">
            {rule.category_name}
          </span>
        </div>

        {/* Priority */}
        <div className="flex items-start gap-2">
          <span className="text-gray-400 w-16">Priority:</span>
          <span className="text-gray-800">
            {rule.priority >= 75 ? 'High' : rule.priority >= 25 ? 'Medium' : 'Low'}
            <span className="text-gray-400 ml-1">({rule.priority})</span>
          </span>
        </div>
      </div>
    </div>
  )
}
```

### 3. Create LLM Rule Parser API

Create `app/api/assistant/parse-rule/route.ts`:

```typescript
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase'
import OpenAI from 'openai'

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY
})

interface ParsedRule {
  name: string
  match_merchant_contains?: string
  match_merchant_exact?: string
  match_amount_min?: number
  match_amount_max?: number
  match_direction?: 'inflow' | 'outflow' | null
  assign_category_id: string
  category_name: string
  priority: number
}

const SYSTEM_PROMPT = `You are a financial categorization assistant. Parse user requests into structured categorization rules.

Your job is to convert natural language into a JSON rule object matching this schema:
{
  "name": "Human-readable rule name",
  "match_merchant_contains": "Substring to match in transaction description (optional)",
  "match_merchant_exact": "Exact merchant name to match (optional)",
  "match_amount_min": "Minimum transaction amount in dollars (optional)",
  "match_amount_max": "Maximum transaction amount in dollars (optional)",
  "match_direction": "inflow" | "outflow" | null,
  "category_name": "The category to assign",
  "priority": 50 (default Medium; use 75 for "always", 25 for "fallback")
}

Guidelines:
- Use match_merchant_contains for phrases like "Starbucks" or "Amazon"
- Use match_merchant_exact only if user says "exactly" or "only when it says"
- Extract amount ranges from phrases like "under $15", "over $100", "between $10 and $50"
- Infer priority from phrases like "always" (75), "if nothing else matches" (25)
- If the request mentions multiple conditions (e.g., "under $15 as Coffee, over $15 as Dining"), create TWO separate rules
- If context includes a selected transaction, use its description to infer the merchant name

If you cannot parse the request into a valid rule, return:
{ "clarification": "I need more details. What category should I assign?" }

Available categories: Groceries, Restaurants, Coffee, Shopping, Entertainment, Travel, Gas, Utilities, Insurance, Healthcare, Subscriptions, Income, Transfer, Dining, Home, Personal Care, Gifts, Education, Business, Other`

export async function POST(req: NextRequest) {
  const { message, selectedTransaction } = await req.json()

  // Build context
  let context = ''
  if (selectedTransaction) {
    context = `\n\nContext: User has selected a transaction:
- Description: ${selectedTransaction.description_clean || selectedTransaction.description_raw}
- Amount: $${Math.abs(selectedTransaction.amount).toFixed(2)} (${selectedTransaction.amount > 0 ? 'inflow' : 'outflow'})
- Current Category: ${selectedTransaction.category_name || 'Uncategorized'}`
  }

  try {
    const completion = await openai.chat.completions.create({
      model: 'gpt-4o-mini', // Low latency, good at structured output
      messages: [
        { role: 'system', content: SYSTEM_PROMPT },
        { role: 'user', content: message + context }
      ],
      response_format: { type: 'json_object' },
      temperature: 0.3, // Low temperature for consistent parsing
      max_tokens: 500
    })

    const result = JSON.parse(completion.choices[0].message.content || '{}')

    // If clarification needed
    if (result.clarification) {
      return NextResponse.json({ clarification: result.clarification })
    }

    // Handle multiple rules
    const rules = result.rules || [result]

    // Validate and enrich with category ID
    const supabase = createClient()
    const enrichedRules: ParsedRule[] = []

    for (const rule of rules) {
      if (!rule.category_name) continue

      // Look up category ID
      const { data: category } = await supabase
        .from('categories')
        .select('id, name')
        .ilike('name', rule.category_name)
        .limit(1)
        .single()

      if (category) {
        enrichedRules.push({
          ...rule,
          assign_category_id: category.id,
          category_name: category.name,
          priority: rule.priority || 50
        })
      }
    }

    if (enrichedRules.length === 0) {
      return NextResponse.json({
        clarification: `I couldn't find a category matching "${rules[0]?.category_name}". Available categories include: Groceries, Restaurants, Coffee, Shopping, etc.`
      })
    }

    // Return first rule (or could return array for multi-rule requests)
    return NextResponse.json({ rule: enrichedRules[0] })

  } catch (error) {
    console.error('LLM parsing error:', error)
    return NextResponse.json({
      response: 'I had trouble understanding that. Try something like "Categorize Starbucks purchases as Coffee".'
    })
  }
}
```

### 4. Add Alternative Model Support (Claude)

Create `lib/assistant/ruleParser.ts`:

```typescript
import Anthropic from '@anthropic-ai/sdk'
import OpenAI from 'openai'

export type LLMProvider = 'openai' | 'anthropic'

const SYSTEM_PROMPT = `...` // Same as above

export async function parseRuleWithLLM(
  message: string,
  context: string,
  provider: LLMProvider = 'openai'
): Promise<ParseResult> {
  if (provider === 'anthropic') {
    return parseWithClaude(message, context)
  }
  return parseWithOpenAI(message, context)
}

async function parseWithClaude(message: string, context: string): Promise<ParseResult> {
  const anthropic = new Anthropic({
    apiKey: process.env.ANTHROPIC_API_KEY
  })

  const response = await anthropic.messages.create({
    model: 'claude-3-haiku-20240307', // Fast and structured
    max_tokens: 500,
    system: SYSTEM_PROMPT,
    messages: [
      { role: 'user', content: message + context }
    ]
  })

  const text = response.content[0].type === 'text' ? response.content[0].text : ''
  
  // Extract JSON from response
  const jsonMatch = text.match(/\{[\s\S]*\}/)
  if (jsonMatch) {
    return JSON.parse(jsonMatch[0])
  }
  
  return { clarification: 'Could not parse response' }
}

async function parseWithOpenAI(message: string, context: string): Promise<ParseResult> {
  const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY })

  const completion = await openai.chat.completions.create({
    model: 'gpt-4o-mini',
    messages: [
      { role: 'system', content: SYSTEM_PROMPT },
      { role: 'user', content: message + context }
    ],
    response_format: { type: 'json_object' },
    temperature: 0.3
  })

  return JSON.parse(completion.choices[0].message.content || '{}')
}
```

### 5. Create Rule Saving API Enhancement

Update `app/api/categorization/rules/route.ts`:

```typescript
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase'

export async function POST(req: NextRequest) {
  const supabase = createClient()
  const rule = await req.json()

  // Validate required fields
  if (!rule.name || !rule.assign_category_id) {
    return NextResponse.json(
      { error: 'Rule name and category are required' },
      { status: 400 }
    )
  }

  // Map frontend fields to DB schema
  const dbRule = {
    name: rule.name,
    description: rule.description || `Created via Assistant`,
    priority: rule.priority || 50,
    is_active: true,
    match_merchant_contains: rule.match_merchant_contains || null,
    match_merchant_exact: rule.match_merchant_exact || null,
    match_amount_min: rule.match_amount_min || null,
    match_amount_max: rule.match_amount_max || null,
    match_direction: rule.match_direction || null,
    assign_category_id: rule.assign_category_id,
    assign_is_transfer: rule.assign_is_transfer || null,
    assign_is_pass_through: rule.assign_is_pass_through || null
  }

  const { data, error } = await supabase
    .from('categorization_rules')
    .insert(dbRule)
    .select('*, categories!assign_category_id(name)')
    .single()

  if (error) {
    console.error('Rule creation error:', error)
    return NextResponse.json({ error: 'Failed to create rule' }, { status: 500 })
  }

  return NextResponse.json(data)
}
```

### 6. Integrate Chat Assistant into Transactions Page

Update `app/transactions/page.tsx`:

```tsx
import { ChatAssistant } from '@/components/assistant/ChatAssistant'

export default function TransactionsPage() {
  const [selectedTransaction, setSelectedTransaction] = useState<Transaction | null>(null)

  function handleRuleCreated(rule: CategoriesRule) {
    // Optionally refresh transactions or show toast
    toast.success(`Rule "${rule.name}" created successfully!`)
  }

  return (
    <div>
      <TransactionTable 
        onRowSelect={setSelectedTransaction}
        selectedId={selectedTransaction?.id}
      />
      
      <ChatAssistant 
        selectedTransaction={selectedTransaction}
        onRuleCreated={handleRuleCreated}
      />
    </div>
  )
}
```

### 7. Add Example Prompts/Suggestions

Create `lib/assistant/examplePrompts.ts`:

```typescript
export const EXAMPLE_PROMPTS = [
  {
    text: 'Categorize Starbucks as Coffee',
    description: 'Simple merchant → category'
  },
  {
    text: 'Any Amazon purchase over $100 is Shopping',
    description: 'Merchant + amount condition'
  },
  {
    text: 'Starbucks under $10 → Coffee, over $10 → Dining',
    description: 'Split by amount range'
  },
  {
    text: 'Mark all Zelle transfers as Internal Transfer',
    description: 'Flag as transfer'
  },
  {
    text: 'Anything from Netflix or Spotify → Subscriptions',
    description: 'Multiple merchants'
  }
]
```

### 8. Add Environment Variables

Update `.env.example`:

```env
# LLM for Rule Parsing (choose one)
OPENAI_API_KEY=sk-...
ANTHROPIC_API_KEY=sk-ant-...

# Default LLM provider (openai or anthropic)
LLM_PROVIDER=openai
```

### 9. Write Tests

Create `tests/unit/ruleParser.test.ts`:

```typescript
import { describe, it, expect, vi } from 'vitest'

describe('Rule Parser', () => {
  it('parses simple merchant → category request', async () => {
    const input = 'Categorize Starbucks as Coffee'
    const result = await parseRule(input)
    
    expect(result.match_merchant_contains).toBe('Starbucks')
    expect(result.category_name).toBe('Coffee')
  })

  it('extracts amount ranges correctly', async () => {
    const input = 'Amazon purchases under $50 should be Shopping'
    const result = await parseRule(input)
    
    expect(result.match_merchant_contains).toBe('Amazon')
    expect(result.match_amount_max).toBe(50)
  })

  it('infers merchant from selected transaction context', async () => {
    const input = 'Categorize this as Groceries'
    const context = { description_clean: 'WHOLE FOODS #12345' }
    const result = await parseRule(input, context)
    
    expect(result.match_merchant_contains).toContain('WHOLE FOODS')
  })

  it('sets high priority for "always" keyword', async () => {
    const input = 'Always categorize Netflix as Subscriptions'
    const result = await parseRule(input)
    
    expect(result.priority).toBeGreaterThanOrEqual(75)
  })
})
```

### 10. Document the Feature

Create `docs/assistant/natural_language_rules.md`:

```markdown
# Natural Language Rule Creation

## Overview

Users can create categorization rules by typing natural language commands instead of filling out forms.

## Supported Phrases

### Basic Merchant Matching
- "Categorize Starbucks as Coffee"
- "Mark all Amazon transactions as Shopping"

### Amount Conditions
- "Starbucks under $15 → Coffee"
- "Amazon over $100 → Shopping"
- "Between $10 and $50 → Dining"

### Priority Keywords
- "Always" → High priority (75)
- "If nothing else matches" → Low priority (25)
- Default → Medium priority (50)

### Transfer Flagging
- "Mark Zelle transfers as Internal Transfer"
- "Flag Venmo as transfer"

## LLM Configuration

Models used:
- **OpenAI GPT-4o-mini**: Default, fast, good at JSON
- **Claude 3 Haiku**: Alternative, similar performance

Set `LLM_PROVIDER` in `.env` to switch.

## Context Awareness

When a transaction is selected, the assistant uses its description to infer:
- Merchant name for matching
- Amount for range suggestions
```

### 11. Puppeteer Verification

Use the Puppeteer MCP server to:
- Navigate to http://localhost:3000/transactions
- Click the floating Assistant button
- Type "Categorize Starbucks as Coffee"
- Verify rule preview card appears
- Click Confirm and verify success message
- Take screenshot of the complete flow
- Test with selected transaction context
