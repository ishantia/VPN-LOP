import { describe, it, expect, beforeEach } from 'vitest';
import worker from '../src/index';
import { Env } from '../src/types';

class MockKV {
  private store = new Map<string, string>();

  async get(key: string): Promise<string | null> {
    return this.store.get(key) || null;
  }

  async put(key: string, value: string): Promise<void> {
    this.store.set(key, value);
  }

  async delete(key: string): Promise<void> {
    this.store.delete(key);
  }
}

describe('Worker API Endpoints', () => {
  let mockEnv: Env;

  beforeEach(() => {
    mockEnv = {
      PRICING_KV: new MockKV() as any,
      DEFAULT_TITLE: 'Special Plans',
      DEFAULT_CURRENCY: 'TOMAN',
      CORS_ORIGIN: '*',
      ADMIN_API_SECRET: 'test_admin_secret',
      TELEGRAM_WEBHOOK_SECRET: 'test_webhook_secret'
    };
  });

  it('should handle CORS preflight OPTIONS requests', async () => {
    const request = new Request('https://example.com/api/prices', {
      method: 'OPTIONS',
      headers: {
        'Origin': 'https://ishantia.github.io'
      }
    });

    const response = await worker.fetch(request, mockEnv);
    expect(response.status).toBe(204);
    expect(response.headers.get('Access-Control-Allow-Origin')).toBe('https://ishantia.github.io');
    expect(response.headers.get('Access-Control-Allow-Methods')).toContain('GET');
  });

  it('GET /api/health should return ok status', async () => {
    const request = new Request('https://example.com/api/health', {
      method: 'GET'
    });

    const response = await worker.fetch(request, mockEnv);
    expect(response.status).toBe(200);

    const json = await response.json() as any;
    expect(json.status).toBe('ok');
    expect(json.service).toBe('dynamic-pricing-worker');
  });

  it('GET /api/prices should return empty list when nothing is published', async () => {
    const request = new Request('https://example.com/api/prices', {
      method: 'GET'
    });

    const response = await worker.fetch(request, mockEnv);
    expect(response.status).toBe(200);
    expect(response.headers.get('Cache-Control')).toContain('max-age=60');

    const json = await response.json() as any;
    expect(json.title).toBe('Special Plans');
    expect(json.plans).toEqual([]);
  });

  it('Admin endpoints should reject unauthenticated requests', async () => {
    const request = new Request('https://example.com/api/admin/prices/preview', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text: '10GB -> 99K' })
    });

    const response = await worker.fetch(request, mockEnv);
    expect(response.status).toBe(401);
  });

  it('Admin preview and publish flow with valid secret', async () => {
    const textPayload = `Special Plans\n10GB → 99K\n20GB → 169K`;

    // 1. Preview
    const previewReq = new Request('https://example.com/api/admin/prices/preview', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': 'Bearer test_admin_secret'
      },
      body: JSON.stringify({ text: textPayload })
    });

    const previewRes = await worker.fetch(previewReq, mockEnv);
    expect(previewRes.status).toBe(200);
    const previewJson = await previewRes.json() as any;
    expect(previewJson.validation.isValid).toBe(true);
    expect(previewJson.parsed.plans).toHaveLength(2);

    // 2. Publish
    const publishReq = new Request('https://example.com/api/admin/prices/publish', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': 'Bearer test_admin_secret'
      },
      body: JSON.stringify({ text: textPayload })
    });

    const publishRes = await worker.fetch(publishReq, mockEnv);
    expect(publishRes.status).toBe(200);
    const publishJson = await publishRes.json() as any;
    expect(publishJson.success).toBe(true);

    // 3. Verify public GET /api/prices
    const getReq = new Request('https://example.com/api/prices');
    const getRes = await worker.fetch(getReq, mockEnv);
    const getJson = await getRes.json() as any;

    expect(getJson.title).toBe('Special Plans');
    expect(getJson.plans).toHaveLength(2);
    expect(getJson.plans[0].name).toBe('10GB');
    expect(getJson.plans[0].amount).toBe(99000);
  });
});
