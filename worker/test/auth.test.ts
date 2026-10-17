import { describe, it, expect } from 'vitest';
import { timingSafeEqual, verifyTelegramWebhook, isAuthorizedAdmin, verifyAdminApiAuth } from '../src/auth';
import { Env } from '../src/types';

describe('Auth & Security Module', () => {
  describe('timingSafeEqual', () => {
    it('should return true for identical strings', () => {
      expect(timingSafeEqual('secret_token_123', 'secret_token_123')).toBe(true);
      expect(timingSafeEqual('', '')).toBe(true);
    });

    it('should return false for different strings of same length', () => {
      expect(timingSafeEqual('secret_token_123', 'secret_token_124')).toBe(false);
    });

    it('should return false for strings of different length', () => {
      expect(timingSafeEqual('short', 'longer_string')).toBe(false);
    });
  });

  describe('isAuthorizedAdmin', () => {
    const mockEnv: Partial<Env> = {
      ADMIN_TELEGRAM_IDS: '12345678, 98765432, 55555'
    };

    it('should authorize numeric IDs present in the allowlist', () => {
      expect(isAuthorizedAdmin(12345678, mockEnv as Env)).toBe(true);
      expect(isAuthorizedAdmin(98765432, mockEnv as Env)).toBe(true);
      expect(isAuthorizedAdmin(55555, mockEnv as Env)).toBe(true);
    });

    it('should reject unauthorized IDs', () => {
      expect(isAuthorizedAdmin(99999999, mockEnv as Env)).toBe(false);
      expect(isAuthorizedAdmin(undefined, mockEnv as Env)).toBe(false);
      expect(isAuthorizedAdmin(0, mockEnv as Env)).toBe(false);
    });
  });

  describe('verifyTelegramWebhook', () => {
    const mockEnv: Partial<Env> = {
      TELEGRAM_WEBHOOK_SECRET: 'my_webhook_secret_key'
    };

    it('should verify requests with valid X-Telegram-Bot-Api-Secret-Token', () => {
      const request = new Request('https://example.com/api/telegram/webhook', {
        headers: {
          'X-Telegram-Bot-Api-Secret-Token': 'my_webhook_secret_key'
        }
      });
      expect(verifyTelegramWebhook(request, mockEnv as Env)).toBe(true);
    });

    it('should reject requests with invalid or missing secret token', () => {
      const invalidRequest = new Request('https://example.com/api/telegram/webhook', {
        headers: {
          'X-Telegram-Bot-Api-Secret-Token': 'wrong_secret'
        }
      });
      expect(verifyTelegramWebhook(invalidRequest, mockEnv as Env)).toBe(false);

      const missingRequest = new Request('https://example.com/api/telegram/webhook');
      expect(verifyTelegramWebhook(missingRequest, mockEnv as Env)).toBe(false);
    });
  });

  describe('verifyAdminApiAuth', () => {
    const mockEnv: Partial<Env> = {
      ADMIN_API_SECRET: 'admin_super_secret_token'
    };

    it('should authenticate with valid Bearer token', () => {
      const request = new Request('https://example.com/api/admin/prices/publish', {
        headers: {
          'Authorization': 'Bearer admin_super_secret_token'
        }
      });
      expect(verifyAdminApiAuth(request, mockEnv as Env)).toBe(true);
    });

    it('should authenticate with valid X-Admin-Secret header', () => {
      const request = new Request('https://example.com/api/admin/prices/publish', {
        headers: {
          'X-Admin-Secret': 'admin_super_secret_token'
        }
      });
      expect(verifyAdminApiAuth(request, mockEnv as Env)).toBe(true);
    });

    it('should reject invalid or missing admin secrets', () => {
      const request = new Request('https://example.com/api/admin/prices/publish', {
        headers: {
          'Authorization': 'Bearer wrong_token'
        }
      });
      expect(verifyAdminApiAuth(request, mockEnv as Env)).toBe(false);
    });
  });
});
