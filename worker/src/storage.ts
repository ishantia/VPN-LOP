/**
 * Cloudflare KV Storage Layer
 * Manages namespaced pricing documents, atomic versioning, rollback, and confirmation state.
 */

import { Plan, PricingData, PendingUpdate } from './types';

const SCHEMA_VERSION = 1;
const DEFAULT_LIST_ID = 'default';
const PENDING_TTL_SECONDS = 600; // 10 minutes

function getKey(prefix: string, listId = DEFAULT_LIST_ID): string {
  return `pricing:${listId}:${prefix}`;
}

function getPendingKey(adminId: number): string {
  return `pending:${adminId}`;
}

/**
 * Retrieve the currently published pricing document
 */
export async function getCurrentPrices(
  kv: KVNamespace,
  listId = DEFAULT_LIST_ID
): Promise<PricingData | null> {
  try {
    const raw = await kv.get(getKey('current', listId), 'text');
    if (!raw) return null;

    const data = JSON.parse(raw) as PricingData;
    if (!data || !Array.isArray(data.plans)) {
      return null;
    }
    return data;
  } catch (err) {
    console.error('Error fetching prices from KV:', err);
    return null;
  }
}

/**
 * Publish a new price list:
 * - Archives current active version into 'previous' key for rollback
 * - Writes new version into 'current' key
 */
export async function publishPrices(
  kv: KVNamespace,
  params: {
    title: string;
    plans: Plan[];
    currency: string;
  },
  listId = DEFAULT_LIST_ID
): Promise<PricingData> {
  const current = await getCurrentPrices(kv, listId);

  // Archive existing version for rollback if it exists
  if (current) {
    await kv.put(getKey('previous', listId), JSON.stringify(current));
  }

  const nextVersion = (current?.version || 0) + 1;
  const newDocument: PricingData = {
    title: params.title,
    currency: params.currency,
    updatedAt: new Date().toISOString(),
    plans: params.plans,
    version: nextVersion
  };

  await kv.put(getKey('current', listId), JSON.stringify(newDocument));
  return newDocument;
}

/**
 * Restore previous version (rollback / undo)
 */
export async function rollbackPrices(
  kv: KVNamespace,
  listId = DEFAULT_LIST_ID
): Promise<PricingData | null> {
  const previousRaw = await kv.get(getKey('previous', listId), 'text');
  if (!previousRaw) {
    return null;
  }

  const previousData = JSON.parse(previousRaw) as PricingData;
  if (!previousData || !Array.isArray(previousData.plans)) {
    return null;
  }

  // Current becomes previous before reverting
  const current = await getCurrentPrices(kv, listId);
  await kv.put(getKey('current', listId), JSON.stringify(previousData));

  if (current) {
    await kv.put(getKey('previous', listId), JSON.stringify(current));
  }

  return previousData;
}

/**
 * Update only the title of the published pricing list
 */
export async function updateTitle(
  kv: KVNamespace,
  newTitle: string,
  listId = DEFAULT_LIST_ID
): Promise<PricingData | null> {
  const current = await getCurrentPrices(kv, listId);
  if (!current) {
    return null;
  }

  current.title = newTitle;
  current.updatedAt = new Date().toISOString();
  await kv.put(getKey('current', listId), JSON.stringify(current));
  return current;
}

/**
 * Save pending update for Telegram confirmation flow with expiration TTL
 */
export async function setPendingUpdate(
  kv: KVNamespace,
  adminId: number,
  title: string,
  plans: Plan[]
): Promise<PendingUpdate> {
  const now = Date.now();
  const pending: PendingUpdate = {
    adminId,
    title,
    plans,
    createdAt: now,
    expiresAt: now + PENDING_TTL_SECONDS * 1000
  };

  await kv.put(getPendingKey(adminId), JSON.stringify(pending), {
    expirationTtl: PENDING_TTL_SECONDS
  });

  return pending;
}

/**
 * Get pending update for an admin
 */
export async function getPendingUpdate(
  kv: KVNamespace,
  adminId: number
): Promise<PendingUpdate | null> {
  try {
    const raw = await kv.get(getPendingKey(adminId), 'text');
    if (!raw) return null;

    const data = JSON.parse(raw) as PendingUpdate;
    if (Date.now() > data.expiresAt) {
      await clearPendingUpdate(kv, adminId);
      return null;
    }
    return data;
  } catch {
    return null;
  }
}

/**
 * Clear pending update
 */
export async function clearPendingUpdate(
  kv: KVNamespace,
  adminId: number
): Promise<void> {
  await kv.delete(getPendingKey(adminId));
}
