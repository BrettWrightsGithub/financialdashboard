import { describe, it, expect, vi, beforeEach } from 'vitest'

// Mock the Supabase client before importing the handler
vi.mock('../supabase', () => ({
  createServerSupabaseClient: vi.fn(),
}))

import {
  linkReimbursement,
  unlinkReimbursement,
  getReimbursementPairs,
  findPotentialReimbursements,
  getReimbursementSummary,
} from './reimbursementHandler'
import { createServerSupabaseClient } from '../supabase'
import type { Transaction } from '@/types/database'

// Helper to create mock transaction
function createMockTransaction(overrides: Partial<Transaction> = {}): Transaction {
  return {
    id: crypto.randomUUID(),
    provider: 'plaid',
    provider_transaction_id: 'test-123',
    account_id: 'account-1',
    provider_account_id: 'prov-account-1',
    date: '2025-01-15',
    amount: -100,
    description_raw: 'Test transaction',
    description_clean: null,
    life_category_id: null,
    cashflow_group: null,
    flow_type: null,
    category_ai: null,
    category_ai_conf: null,
    category_locked: false,
    status: 'posted',
    provider_type: null,
    processing_status: null,
    counterparty_name: null,
    counterparty_id: null,
    is_transfer: false,
    is_pass_through: false,
    is_business: false,
    category_source: null,
    created_at: '2025-01-15T00:00:00Z',
    updated_at: '2025-01-15T00:00:00Z',
    ...overrides,
  }
}

// Mock Supabase query builder
function createMockSupabase() {
  const mockResult = { data: null, error: null }
  
  const mockQueryBuilder = {
    select: vi.fn().mockReturnThis(),
    update: vi.fn().mockReturnThis(),
    eq: vi.fn().mockReturnThis(),
    in: vi.fn().mockReturnThis(),
    not: vi.fn().mockReturnThis(),
    is: vi.fn().mockReturnThis(),
    gte: vi.fn().mockReturnThis(),
    lte: vi.fn().mockReturnThis(),
    gt: vi.fn().mockReturnThis(),
    single: vi.fn().mockResolvedValue(mockResult),
    // Terminal method - returns Promise
    then: (resolve: (value: typeof mockResult) => void) => resolve(mockResult),
  }
  
  return {
    from: vi.fn().mockReturnValue(mockQueryBuilder),
    _queryBuilder: mockQueryBuilder,
    _setResult: (data: unknown, error: unknown = null) => {
      mockResult.data = data as null
      mockResult.error = error as null
    },
  }
}

describe('linkReimbursement', () => {
  let mockSupabase: ReturnType<typeof createMockSupabase>

  beforeEach(() => {
    vi.clearAllMocks()
    mockSupabase = createMockSupabase()
    vi.mocked(createServerSupabaseClient).mockReturnValue(mockSupabase as unknown as ReturnType<typeof createServerSupabaseClient>)
  })

  it('links reimbursement to original expense with category copy', async () => {
    const originalCategoryId = 'cat-123'
    
    // Mock fetching original expense
    mockSupabase._queryBuilder.single
      .mockResolvedValueOnce({ data: { life_category_id: originalCategoryId }, error: null })
      .mockResolvedValueOnce({ data: null, error: null })

    const result = await linkReimbursement('reimbursement-id', 'original-id', true)

    expect(result.success).toBe(true)
    expect(mockSupabase.from).toHaveBeenCalledWith('transactions')
    expect(mockSupabase._queryBuilder.update).toHaveBeenCalled()
    expect(mockSupabase._queryBuilder.eq).toHaveBeenCalledWith('id', 'reimbursement-id')
  })

  it('returns error when original expense not found', async () => {
    mockSupabase._queryBuilder.single.mockResolvedValueOnce({
      data: null,
      error: { message: 'Not found' },
    })

    const result = await linkReimbursement('reimbursement-id', 'nonexistent-id', true)

    expect(result.success).toBe(false)
    expect(result.error).toContain('Failed to fetch original')
  })

  it('links without copying category when copyCategory is false', async () => {
    mockSupabase._queryBuilder.single.mockResolvedValueOnce({ data: null, error: null })

    const result = await linkReimbursement('reimbursement-id', 'original-id', false)

    expect(result.success).toBe(true)
    // Should not have called select for original when not copying category
    expect(mockSupabase._queryBuilder.select).not.toHaveBeenCalledWith('life_category_id')
  })
})

describe('unlinkReimbursement', () => {
  let mockSupabase: ReturnType<typeof createMockSupabase>

  beforeEach(() => {
    vi.clearAllMocks()
    mockSupabase = createMockSupabase()
    vi.mocked(createServerSupabaseClient).mockReturnValue(mockSupabase as unknown as ReturnType<typeof createServerSupabaseClient>)
  })

  it('unlinks reimbursement successfully', async () => {
    mockSupabase._queryBuilder.eq.mockResolvedValueOnce({ data: null, error: null })

    const result = await unlinkReimbursement('reimbursement-id')

    expect(result.success).toBe(true)
    expect(mockSupabase.from).toHaveBeenCalledWith('transactions')
    expect(mockSupabase._queryBuilder.update).toHaveBeenCalledWith(
      expect.objectContaining({
        reimbursement_of_id: null,
        is_pass_through: false,
      })
    )
  })

  it('returns error on database failure', async () => {
    mockSupabase._queryBuilder.eq.mockResolvedValueOnce({
      data: null,
      error: { message: 'Database error' },
    })

    const result = await unlinkReimbursement('reimbursement-id')

    expect(result.success).toBe(false)
    expect(result.error).toContain('Failed to unlink')
  })
})

describe('getReimbursementPairs', () => {
  let mockSupabase: ReturnType<typeof createMockSupabase>

  beforeEach(() => {
    vi.clearAllMocks()
    mockSupabase = createMockSupabase()
    vi.mocked(createServerSupabaseClient).mockReturnValue(mockSupabase as unknown as ReturnType<typeof createServerSupabaseClient>)
  })

  it('returns paired reimbursements and originals', async () => {
    const originalId = 'original-123'
    const reimbursement = createMockTransaction({
      id: 'reimbursement-456',
      amount: 100,
      date: '2025-01-20',
      reimbursement_of_id: originalId,
    } as Partial<Transaction> & { reimbursement_of_id: string })
    
    const original = createMockTransaction({
      id: originalId,
      amount: -100,
      date: '2025-01-15',
    })

    // Mock fetching reimbursements
    mockSupabase._queryBuilder.lte.mockResolvedValueOnce({
      data: [reimbursement],
      error: null,
    })

    // Mock fetching originals
    mockSupabase._queryBuilder.in.mockResolvedValueOnce({
      data: [original],
      error: null,
    })

    const pairs = await getReimbursementPairs('2025-01')

    expect(pairs).toHaveLength(1)
    expect(pairs[0].original.id).toBe(originalId)
    expect(pairs[0].reimbursement.id).toBe('reimbursement-456')
    expect(pairs[0].netAmount).toBe(0) // -100 + 100 = 0 (fully reimbursed)
  })

  it('returns empty array on error', async () => {
    mockSupabase._queryBuilder.lte.mockResolvedValueOnce({
      data: null,
      error: { message: 'Query failed' },
    })

    const pairs = await getReimbursementPairs('2025-01')

    expect(pairs).toEqual([])
  })
})

describe('findPotentialReimbursements', () => {
  let mockSupabase: ReturnType<typeof createMockSupabase>

  beforeEach(() => {
    vi.clearAllMocks()
    mockSupabase = createMockSupabase()
    vi.mocked(createServerSupabaseClient).mockReturnValue(mockSupabase as unknown as ReturnType<typeof createServerSupabaseClient>)
  })

  it('finds matching inflows for expense', async () => {
    const expense = createMockTransaction({
      id: 'expense-123',
      amount: -50,
      date: '2025-01-15',
    })

    const candidate = createMockTransaction({
      id: 'candidate-456',
      amount: 50,
      date: '2025-01-20',
    })

    // Mock fetching expense
    mockSupabase._queryBuilder.single.mockResolvedValueOnce({
      data: expense,
      error: null,
    })

    // Mock finding candidates
    mockSupabase._queryBuilder.is.mockResolvedValueOnce({
      data: [candidate],
      error: null,
    })

    const candidates = await findPotentialReimbursements('expense-123')

    expect(candidates).toHaveLength(1)
    expect(candidates[0].id).toBe('candidate-456')
  })

  it('returns empty for inflows (not expenses)', async () => {
    const inflow = createMockTransaction({
      id: 'inflow-123',
      amount: 100, // Positive = inflow
    })

    mockSupabase._queryBuilder.single.mockResolvedValueOnce({
      data: inflow,
      error: null,
    })

    const candidates = await findPotentialReimbursements('inflow-123')

    expect(candidates).toEqual([])
  })

  it('returns empty when expense not found', async () => {
    mockSupabase._queryBuilder.single.mockResolvedValueOnce({
      data: null,
      error: { message: 'Not found' },
    })

    const candidates = await findPotentialReimbursements('nonexistent-123')

    expect(candidates).toEqual([])
  })
})

describe('getReimbursementSummary', () => {
  let mockSupabase: ReturnType<typeof createMockSupabase>

  beforeEach(() => {
    vi.clearAllMocks()
    mockSupabase = createMockSupabase()
    vi.mocked(createServerSupabaseClient).mockReturnValue(mockSupabase as unknown as ReturnType<typeof createServerSupabaseClient>)
  })

  it('calculates summary statistics correctly', async () => {
    const reimbursements = [
      { ...createMockTransaction({ id: 'r1', amount: 100, date: '2025-01-20' }), reimbursement_of_id: 'o1' },
      { ...createMockTransaction({ id: 'r2', amount: 50, date: '2025-01-25' }), reimbursement_of_id: 'o2' },
    ]

    const originals = [
      createMockTransaction({ id: 'o1', amount: -100, date: '2025-01-15' }), // Fully reimbursed
      createMockTransaction({ id: 'o2', amount: -75, date: '2025-01-18' }),  // Partially reimbursed
    ]

    // Mock fetching reimbursements
    mockSupabase._queryBuilder.lte.mockResolvedValueOnce({
      data: reimbursements,
      error: null,
    })

    // Mock fetching originals
    mockSupabase._queryBuilder.in.mockResolvedValueOnce({
      data: originals,
      error: null,
    })

    const summary = await getReimbursementSummary('2025-01')

    expect(summary.pairCount).toBe(2)
    expect(summary.totalReimbursed).toBe(150) // 100 + 50
    expect(summary.fullyReimbursed).toBe(1)   // o1 fully reimbursed
    expect(summary.partiallyReimbursed).toBe(1) // o2 partially reimbursed
  })
})
