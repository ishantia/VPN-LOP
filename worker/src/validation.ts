/**
 * Validation Module
 * Validates price lists, checks for duplicate IDs, malformed lines, and bounds.
 */

import { Plan, ParseResult, ValidationResult } from './types';
import { parsePlanLine } from './parser';

const MAX_PLANS_COUNT = 50;
const MAX_TITLE_LENGTH = 100;
const MAX_PLAN_AMOUNT = 1_000_000_000; // 1 Billion Tomans upper bound

export function validatePriceList(
  rawText: string,
  parseResult: ParseResult,
  defaultCurrency = 'TOMAN'
): ValidationResult {
  const errors: string[] = [];

  // Check title
  if (parseResult.title && parseResult.title.length > MAX_TITLE_LENGTH) {
    errors.push(`عنوان لیست بیش از حد طولانی است (حداکثر ${MAX_TITLE_LENGTH} کاراکتر).`);
  }

  // Check plans existence
  if (parseResult.plans.length === 0) {
    errors.push('هیچ پلن معتبری در پیام ارسال‌شده یافت نشد.');
    return { isValid: false, errors };
  }

  // Check plan count limit
  if (parseResult.plans.length > MAX_PLANS_COUNT) {
    errors.push(`تعداد پلن‌ها نمی‌تواند بیش از ${MAX_PLANS_COUNT} باشد.`);
  }

  // Check for malformed lines in raw text
  const lines = rawText
    .split(/\r?\n/)
    .map(l => l.trim())
    .filter(Boolean);

  let startIndex = 0;
  if (lines.length > 0 && !parsePlanLine(lines[0], defaultCurrency)) {
    // First line was title
    startIndex = 1;
  }

  for (let i = startIndex; i < lines.length; i++) {
    const line = lines[i];
    const parsed = parsePlanLine(line, defaultCurrency);
    if (!parsed) {
      errors.push(`خط شماره ${i + 1} نامعتبر است: "${line}". لطفاً فرمت قیمت و خط را بررسی فرمایید.`);
    }
  }

  // Check duplicates and individual plan constraints
  const seenIds = new Set<string>();
  const seenNames = new Set<string>();

  for (let i = 0; i < parseResult.plans.length; i++) {
    const plan = parseResult.plans[i];

    // Check duplicate ID
    if (seenIds.has(plan.id)) {
      errors.push(`پلن تکراری با شناسه مشابه یافت شد: "${plan.name}". هر پلن باید نام یکتا داشته باشد.`);
    }
    seenIds.add(plan.id);

    // Check duplicate Name (case-insensitive)
    const lowerName = plan.name.toLowerCase();
    if (seenNames.has(lowerName)) {
      errors.push(`نام پلن تکراری است: "${plan.name}".`);
    }
    seenNames.add(lowerName);

    // Check amount bounds
    if (plan.amount <= 0) {
      errors.push(`قیمت پلن "${plan.name}" باید بزرگتر از صفر باشد.`);
    } else if (plan.amount > MAX_PLAN_AMOUNT) {
      errors.push(`قیمت پلن "${plan.name}" بیش از حد مجاز است.`);
    }
  }

  return {
    isValid: errors.length === 0,
    errors
  };
}
