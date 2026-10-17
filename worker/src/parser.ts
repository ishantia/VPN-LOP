/**
 * Price List Parser
 * Parses plain-text price lists with varied formats, separators, Persian/English digits, and units.
 */

import { Plan, ParseResult } from './types';

/**
 * Convert Persian and Arabic digits to standard ASCII digits
 */
export function normalizeDigits(input: string): string {
  const persianDigits = ['۰', '۱', '۲', '۳', '۴', '۵', '۶', '۷', '۸', '۹'];
  const arabicDigits = ['٠', '١', '٢', '٣', '٤', '٥', '٦', '٧', '٨', '٩'];

  let result = input;
  for (let i = 0; i < 10; i++) {
    result = result.replaceAll(persianDigits[i], String(i));
    result = result.replaceAll(arabicDigits[i], String(i));
  }
  return result;
}

/**
 * Format integer amount to display price (e.g. 99000 -> "99,000 تومان")
 */
export function formatDisplayPrice(amount: number, currency = 'TOMAN'): string {
  const formatted = amount.toLocaleString('en-US');
  if (currency.toUpperCase() === 'TOMAN') {
    return `${formatted} تومان`;
  }
  return `${formatted} ${currency}`;
}

/**
 * Generate a clean, lowercase URL-safe slug for plan ID
 */
export function slugifyPlanName(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^\w\u0600-\u06FF]+/g, '_')
    .replace(/^_+|_+$/g, '');
}

/**
 * Parse an individual price value string (e.g. "99K", "99,000", "99000", "۹۹ هزار", "150 k")
 */
export function parsePriceAmount(priceStr: string): number | null {
  if (!priceStr) return null;

  let str = normalizeDigits(priceStr.trim());

  // Check for 'k' or 'هزار' multiplier
  let hasKMultiplier = false;
  if (/k\b/i.test(str) || /هزار/.test(str)) {
    hasKMultiplier = true;
    str = str.replace(/k\b/gi, '').replace(/هزار/g, '');
  }

  // Remove commas, spaces, currency words (تومان, toman, etc.)
  str = str.replace(/[,\s_٬]/g, '');
  str = str.replace(/تومان|toman|irt|rls|ریال/gi, '');

  if (!str) return null;

  const num = Number(str);
  if (isNaN(num) || !Number.isFinite(num)) {
    return null;
  }

  const finalAmount = hasKMultiplier ? Math.round(num * 1000) : Math.round(num);
  return finalAmount >= 0 ? finalAmount : null;
}

/**
 * Try to parse a single line into a Plan
 * Supports:
 * - 10GB → 99K
 * - 10 GB - 99K
 * - 10GB: 99000
 * - 10GB = 99,000
 * - 10GB -> 99K
 * - 10GB => 99K
 * - 10 گیگ — ۹۹ هزار
 */
export function parsePlanLine(line: string, defaultCurrency = 'TOMAN'): Plan | null {
  const trimmed = line.trim();
  if (!trimmed) return null;

  // Split on supported separators:
  // Arrows: →, ⟶, ➜, ->, =>
  // Dashes: —, –, -
  // Symbols: :, =, |
  const separatorRegex = /\s*(?:→|⟶|➜|->|=>|—|–|-|:|=|\|)\s*/;
  const parts = trimmed.split(separatorRegex);

  if (parts.length < 2) {
    // Attempt fallback split: last space followed by a valid price expression (e.g. "10GB 99K")
    const match = trimmed.match(/^(.*?)\s+((?:\d[\d,.]*\s*[kK]?|\d+\s*هزار).*)$/);
    if (match) {
      const planName = match[1].trim();
      const priceStr = match[2].trim();
      const amount = parsePriceAmount(priceStr);
      if (amount !== null && planName) {
        return {
          id: slugifyPlanName(planName),
          name: planName,
          amount,
          displayPrice: formatDisplayPrice(amount, defaultCurrency)
        };
      }
    }
    return null;
  }

  const planName = parts[0].trim();
  const pricePart = parts.slice(1).join(' ').trim();

  if (!planName || !pricePart) return null;

  const amount = parsePriceAmount(pricePart);
  if (amount === null) return null;

  return {
    id: slugifyPlanName(planName),
    name: planName,
    amount,
    displayPrice: formatDisplayPrice(amount, defaultCurrency)
  };
}

/**
 * Parse an entire multi-line price list
 */
export function parsePriceList(
  text: string,
  defaultTitle = 'Special Plans',
  defaultCurrency = 'TOMAN'
): ParseResult {
  if (!text || typeof text !== 'string') {
    return { title: defaultTitle, plans: [], rawLinesCount: 0, parsedLinesCount: 0 };
  }

  const lines = text
    .split(/\r?\n/)
    .map(l => l.trim())
    .filter(Boolean);

  if (lines.length === 0) {
    return { title: defaultTitle, plans: [], rawLinesCount: 0, parsedLinesCount: 0 };
  }

  let title = defaultTitle;
  let startIndex = 0;

  // Test if first line is a title or a plan line
  const firstLinePlan = parsePlanLine(lines[0], defaultCurrency);
  if (!firstLinePlan) {
    // First line is considered the title
    title = lines[0];
    startIndex = 1;
  }

  const plans: Plan[] = [];
  let parsedLinesCount = 0;

  for (let i = startIndex; i < lines.length; i++) {
    const plan = parsePlanLine(lines[i], defaultCurrency);
    if (plan) {
      plans.push(plan);
      parsedLinesCount++;
    }
  }

  return {
    title,
    plans,
    rawLinesCount: lines.length - startIndex,
    parsedLinesCount
  };
}
