import { triggerPlaidSync, triggerRetroactiveRules } from './triggerSync';

// Mock the global fetch
global.fetch = jest.fn();

describe('N8n Trigger Functions', () => {
  const originalEnv = process.env;

  beforeEach(() => {
    jest.resetModules();
    process.env = { ...originalEnv, N8N_WEBHOOK_URL: 'http://mock-n8n:5678/webhook' };
    (global.fetch as jest.Mock).mockClear();
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  it('triggerPlaidSync sends correct request', async () => {
    const mockResponse = { success: true, processed: 5 };
    (global.fetch as jest.Mock).mockResolvedValue({
      ok: true,
      json: async () => mockResponse,
    });

    const result = await triggerPlaidSync('acc_123');

    expect(global.fetch).toHaveBeenCalledWith(
      'http://mock-n8n:5678/webhook/trigger-sync',
      expect.objectContaining({
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ account_id: 'acc_123' }),
      })
    );
    expect(result).toEqual(mockResponse);
  });

  it('triggerPlaidSync handles missing env var', async () => {
    delete process.env.N8N_WEBHOOK_URL;
    const result = await triggerPlaidSync();
    expect(result.success).toBe(false);
    expect(result.error).toContain('N8n configuration missing');
  });

  it('triggerRetroactiveRules sends correct request', async () => {
    const mockResponse = { success: true };
    (global.fetch as jest.Mock).mockResolvedValue({
      ok: true,
      json: async () => mockResponse,
    });

    const result = await triggerRetroactiveRules('batch_1', ['txn_1', 'txn_2']);

    expect(global.fetch).toHaveBeenCalledWith(
      'http://mock-n8n:5678/webhook/apply-rules-retroactive',
      expect.objectContaining({
        method: 'POST',
        body: JSON.stringify({ batch_id: 'batch_1', transaction_ids: ['txn_1', 'txn_2'] }),
      })
    );
    expect(result).toEqual(mockResponse);
  });
});