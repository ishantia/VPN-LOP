/**
 * Authentication and Security Utilities
 * Constant-time comparison, Telegram ID allowlisting, and API secret authentication.
 */

import { Env } from './types';

/**
 * Constant-time comparison of two strings to prevent timing attacks
 */
export function timingSafeEqual(a: string, b: string): boolean {
  if (typeof a !== 'string' || typeof b !== 'string') {
    return false;
  }

  const encoder = new TextEncoder();
  const aBuf = encoder.encode(a);
  const bBuf = encoder.encode(b);

  if (aBuf.byteLength !== bBuf.byteLength) {
    return false;
  }

  let result = 0;
  for (let i = 0; i < aBuf.byteLength; i++) {
    result |= aBuf[i] ^ bBuf[i];
  }
  return result === 0;
}

/**
 * Verify Telegram Webhook secret token
 */
export function verifyTelegramWebhook(request: Request, env: Env): boolean {
  const configuredSecret = env.TELEGRAM_WEBHOOK_SECRET;
  if (!configuredSecret) {
    // If no secret configured, reject or check security warning
    return false;
  }

  const headerSecret = request.headers.get('X-Telegram-Bot-Api-Secret-Token') || '';
  return timingSafeEqual(headerSecret, configuredSecret);
}

/**
 * Check if a Telegram user numeric ID is in the administrator allowlist
 */
export function isAuthorizedAdmin(userId: number | undefined, env: Env): boolean {
  if (typeof userId !== 'number' || !userId) {
    return false;
  }

  const adminIdsStr = env.ADMIN_TELEGRAM_IDS || '';
  if (!adminIdsStr) {
    return false;
  }

  const allowedIds = adminIdsStr
    .split(',')
    .map(id => id.trim())
    .filter(Boolean)
    .map(Number);

  return allowedIds.includes(userId);
}

/**
 * Authenticate direct admin REST API calls
 */
export function verifyAdminApiAuth(request: Request, env: Env): boolean {
  const configuredSecret = env.ADMIN_API_SECRET;
  if (!configuredSecret) {
    return false;
  }

  // Check Authorization Bearer header
  const authHeader = request.headers.get('Authorization') || '';
  if (authHeader.startsWith('Bearer ')) {
    const token = authHeader.slice(7).trim();
    if (timingSafeEqual(token, configuredSecret)) {
      return true;
    }
  }

  // Check X-Admin-Secret header
  const secretHeader = request.headers.get('X-Admin-Secret') || '';
  if (secretHeader && timingSafeEqual(secretHeader, configuredSecret)) {
    return true;
  }

  return false;
}
