/**
 * Type definitions for Dynamic Pricing Worker & Telegram Bot
 */

export interface Plan {
  id: string;
  name: string;
  amount: number;
  displayPrice: string;
  description?: string;
  features?: string[];
  featured?: boolean;
  badge?: string;
}

export interface PricingData {
  title: string;
  currency: string;
  updatedAt: string;
  plans: Plan[];
  version?: number;
}

export interface PendingUpdate {
  adminId: number;
  title: string;
  plans: Plan[];
  createdAt: number;
  expiresAt: number;
}

export interface Env {
  PRICING_KV: KVNamespace;
  DEFAULT_TITLE?: string;
  DEFAULT_CURRENCY?: string;
  CORS_ORIGIN?: string;
  TELEGRAM_BOT_TOKEN?: string;
  TELEGRAM_WEBHOOK_SECRET?: string;
  ADMIN_TELEGRAM_IDS?: string;
  ADMIN_API_SECRET?: string;
}

export interface ParseResult {
  title?: string;
  plans: Plan[];
  rawLinesCount: number;
  parsedLinesCount: number;
}

export interface ValidationResult {
  isValid: boolean;
  errors: string[];
}

export interface TelegramUser {
  id: number;
  is_bot: boolean;
  first_name: string;
  last_name?: string;
  username?: string;
}

export interface TelegramChat {
  id: number;
  type: string;
  title?: string;
  username?: string;
}

export interface TelegramMessage {
  message_id: number;
  from?: TelegramUser;
  chat: TelegramChat;
  date: number;
  text?: string;
}

export interface TelegramCallbackQuery {
  id: string;
  from: TelegramUser;
  message?: TelegramMessage;
  data?: string;
}

export interface TelegramUpdate {
  update_id: number;
  message?: TelegramMessage;
  callback_query?: TelegramCallbackQuery;
}
