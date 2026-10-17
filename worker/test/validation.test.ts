import { describe, it, expect } from 'vitest';
import { validatePriceList } from '../src/validation';
import { parsePriceList } from '../src/parser';

describe('Validation Module', () => {
  it('should validate a clean, correct price list', () => {
    const raw = `Special Plans\n10GB → 99K\n20GB → 169K\n30GB → 229K`;
    const parsed = parsePriceList(raw);
    const result = validatePriceList(raw, parsed);

    expect(result.isValid).toBe(true);
    expect(result.errors).toHaveLength(0);
  });

  it('should reject empty message', () => {
    const raw = ``;
    const parsed = parsePriceList(raw);
    const result = validatePriceList(raw, parsed);

    expect(result.isValid).toBe(false);
    expect(result.errors.length).toBeGreaterThan(0);
  });

  it('should detect duplicate plan names/identifiers', () => {
    const raw = `Special Plans\n10GB → 99K\n10GB → 120K`;
    const parsed = parsePriceList(raw);
    const result = validatePriceList(raw, parsed);

    expect(result.isValid).toBe(false);
    expect(result.errors.some(e => e.includes('تکراری'))).toBe(true);
  });

  it('should catch malformed lines mixed with valid lines', () => {
    const raw = `Special Plans\n10GB → 99K\nThis is an invalid malformed line\n20GB → 169K`;
    const parsed = parsePriceList(raw);
    const result = validatePriceList(raw, parsed);

    expect(result.isValid).toBe(false);
    expect(result.errors.some(e => e.includes('خط شماره 3 نامعتبر است'))).toBe(true);
  });

  it('should reject zero and negative prices', () => {
    const parsed = {
      title: 'Plans',
      plans: [
        { id: '10gb', name: '10GB', amount: 0, displayPrice: '0 تومان' }
      ],
      rawLinesCount: 1,
      parsedLinesCount: 1
    };
    const result = validatePriceList('10GB → 0', parsed);

    expect(result.isValid).toBe(false);
    expect(result.errors.some(e => e.includes('باید بزرگتر از صفر باشد'))).toBe(true);
  });

  it('should reject overly long title', () => {
    const longTitle = 'A'.repeat(120);
    const raw = `${longTitle}\n10GB → 99K`;
    const parsed = parsePriceList(raw);
    const result = validatePriceList(raw, parsed);

    expect(result.isValid).toBe(false);
    expect(result.errors.some(e => e.includes('عنوان لیست بیش از حد طولانی است'))).toBe(true);
  });
});
