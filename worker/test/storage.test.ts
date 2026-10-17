import { describe, it, expect, beforeEach } from 'vitest';
import {
  getCurrentPrices,
  publishPrices,
  rollbackPrices,
  updateTitle,
  setPendingUpdate,
  getPendingUpdate,
  clearPendingUpdate
} from '../src/storage';
import { Plan } from '../src/types';

/**
 * In-memory Mock of Cloudflare KVNamespace
 */
class MockKV {
  private store = new Map<string, { value: string; expires?: number }>();

  async get(key: string, type?: string): Promise<string | null> {
    const item = this.store.get(key);
    if (!item) return null;
    if (item.expires && Date.now() > item.expires) {
      this.store.delete(key);
      return null;
    }
    return item.value;
  }

  async put(key: string, value: string, options?: { expirationTtl?: number }): Promise<void> {
    const expires = options?.expirationTtl ? Date.now() + options.expirationTtl * 1000 : undefined;
    this.store.set(key, { value, expires });
  }

  async delete(key: string): Promise<void> {
    this.store.delete(key);
  }
}

describe('Storage Module', () => {
  let mockKv: any;

  beforeEach(() => {
    mockKv = new MockKV();
  });

  const samplePlans: Plan[] = [
    { id: '10gb', name: '10GB', amount: 99000, displayPrice: '99,000 تومان' },
    { id: '20gb', name: '20GB', amount: 169000, displayPrice: '169,000 تومان' }
  ];

  it('should return null when no prices are published', async () => {
    const current = await getCurrentPrices(mockKv);
    expect(current).toBeNull();
  });

  it('should publish new prices and increment version', async () => {
    const published1 = await publishPrices(mockKv, {
      title: 'First List',
      plans: samplePlans,
      currency: 'TOMAN'
    });

    expect(published1.title).toBe('First List');
    expect(published1.plans).toHaveLength(2);
    expect(published1.version).toBe(1);

    const fetched = await getCurrentPrices(mockKv);
    expect(fetched?.title).toBe('First List');
    expect(fetched?.version).toBe(1);

    // Second publish
    const published2 = await publishPrices(mockKv, {
      title: 'Second List',
      plans: [{ id: '50gb', name: '50GB', amount: 349000, displayPrice: '349,000 تومان' }],
      currency: 'TOMAN'
    });

    expect(published2.title).toBe('Second List');
    expect(published2.version).toBe(2);
  });

  it('should rollback to previous version successfully', async () => {
    // 1. Publish v1
    await publishPrices(mockKv, {
      title: 'Version 1',
      plans: samplePlans,
      currency: 'TOMAN'
    });

    // 2. Publish v2
    await publishPrices(mockKv, {
      title: 'Version 2',
      plans: [{ id: '50gb', name: '50GB', amount: 349000, displayPrice: '349,000 تومان' }],
      currency: 'TOMAN'
    });

    // 3. Rollback
    const restored = await rollbackPrices(mockKv);
    expect(restored).not.toBeNull();
    expect(restored?.title).toBe('Version 1');
    expect(restored?.plans).toHaveLength(2);

    // Check that current is now Version 1
    const current = await getCurrentPrices(mockKv);
    expect(current?.title).toBe('Version 1');
  });

  it('should update title of published list', async () => {
    await publishPrices(mockKv, {
      title: 'Old Title',
      plans: samplePlans,
      currency: 'TOMAN'
    });

    const updated = await updateTitle(mockKv, 'New Custom Title');
    expect(updated?.title).toBe('New Custom Title');

    const current = await getCurrentPrices(mockKv);
    expect(current?.title).toBe('New Custom Title');
  });

  it('should manage pending updates with TTL and deletion', async () => {
    const adminId = 12345;
    await setPendingUpdate(mockKv, adminId, 'Pending Plans', samplePlans);

    const pending = await getPendingUpdate(mockKv, adminId);
    expect(pending).not.toBeNull();
    expect(pending?.title).toBe('Pending Plans');
    expect(pending?.plans).toHaveLength(2);

    await clearPendingUpdate(mockKv, adminId);
    const cleared = await getPendingUpdate(mockKv, adminId);
    expect(cleared).toBeNull();
  });
});
