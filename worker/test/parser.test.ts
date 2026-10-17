import { describe, it, expect } from 'vitest';
import {
  normalizeDigits,
  parsePriceAmount,
  parsePlanLine,
  parsePriceList,
  formatDisplayPrice
} from '../src/parser';

describe('Price Parser Module', () => {
  describe('normalizeDigits', () => {
    it('should convert Persian digits to ASCII', () => {
      expect(normalizeDigits('۰۱۲۳۴۵۶۷۸۹')).toBe('0123456789');
      expect(normalizeDigits('۱۰GB')).toBe('10GB');
      expect(normalizeDigits('۹۹K')).toBe('99K');
    });

    it('should convert Arabic digits to ASCII', () => {
      expect(normalizeDigits('٠١٢٣٤٥٦٧٨٩')).toBe('0123456789');
    });

    it('should leave ASCII digits and characters untouched', () => {
      expect(normalizeDigits('10GB -> 99K')).toBe('10GB -> 99K');
    });
  });

  describe('parsePriceAmount', () => {
    it('should parse standard numeric amounts', () => {
      expect(parsePriceAmount('99000')).toBe(99000);
      expect(parsePriceAmount('169000')).toBe(169000);
    });

    it('should parse amounts with commas and spaces', () => {
      expect(parsePriceAmount('99,000')).toBe(99000);
      expect(parsePriceAmount('169 000')).toBe(169000);
      expect(parsePriceAmount('229_000')).toBe(229000);
    });

    it('should parse K multiplier correctly', () => {
      expect(parsePriceAmount('99K')).toBe(99000);
      expect(parsePriceAmount('99k')).toBe(99000);
      expect(parsePriceAmount('150 K')).toBe(150000);
      expect(parsePriceAmount('229.5K')).toBe(229500);
      expect(parsePriceAmount('649K')).toBe(649000);
    });

    it('should parse Persian digits and "هزار" keyword', () => {
      expect(parsePriceAmount('۹۹ هزار')).toBe(99000);
      expect(parsePriceAmount('۹۹,۰۰۰')).toBe(99000);
      expect(parsePriceAmount('۹۹k')).toBe(99000);
    });

    it('should ignore currency suffix words', () => {
      expect(parsePriceAmount('99,000 تومان')).toBe(99000);
      expect(parsePriceAmount('99K Toman')).toBe(99000);
    });

    it('should return null for invalid price values', () => {
      expect(parsePriceAmount('')).toBeNull();
      expect(parsePriceAmount('free')).toBeNull();
      expect(parsePriceAmount('abc')).toBeNull();
      expect(parsePriceAmount('-50000')).toBeNull();
    });
  });

  describe('parsePlanLine', () => {
    it('should parse arrows: →, ->, =>', () => {
      const plan1 = parsePlanLine('10GB → 99K');
      expect(plan1).not.toBeNull();
      expect(plan1?.name).toBe('10GB');
      expect(plan1?.amount).toBe(99000);

      const plan2 = parsePlanLine('20GB -> 169K');
      expect(plan2).not.toBeNull();
      expect(plan2?.name).toBe('20GB');
      expect(plan2?.amount).toBe(169000);

      const plan3 = parsePlanLine('30GB => 229K');
      expect(plan3).not.toBeNull();
      expect(plan3?.name).toBe('30GB');
      expect(plan3?.amount).toBe(229000);
    });

    it('should parse dashes: —, –, -', () => {
      const plan1 = parsePlanLine('10 GB - 99K');
      expect(plan1).not.toBeNull();
      expect(plan1?.name).toBe('10 GB');
      expect(plan1?.amount).toBe(99000);

      const plan2 = parsePlanLine('50GB — 349,000');
      expect(plan2).not.toBeNull();
      expect(plan2?.name).toBe('50GB');
      expect(plan2?.amount).toBe(349000);
    });

    it('should parse colons and equals: :, =', () => {
      const plan1 = parsePlanLine('10GB: 99000');
      expect(plan1).not.toBeNull();
      expect(plan1?.name).toBe('10GB');
      expect(plan1?.amount).toBe(99000);

      const plan2 = parsePlanLine('10GB = 99,000');
      expect(plan2).not.toBeNull();
      expect(plan2?.name).toBe('10GB');
      expect(plan2?.amount).toBe(99000);
    });

    it('should return null for non-plan lines', () => {
      expect(parsePlanLine('Special Plans')).toBeNull();
      expect(parsePlanLine('')).toBeNull();
      expect(parsePlanLine('Just some random text')).toBeNull();
    });
  });

  describe('parsePriceList', () => {
    it('should parse complete text with title and plans', () => {
      const text = `Special Plans\n\n10GB → 99K\n20GB → 169K\n30GB → 229K\n50GB → 349K\n100GB → 649K`;
      const result = parsePriceList(text);

      expect(result.title).toBe('Special Plans');
      expect(result.plans).toHaveLength(5);
      expect(result.plans[0].name).toBe('10GB');
      expect(result.plans[0].amount).toBe(99000);
      expect(result.plans[4].name).toBe('100GB');
      expect(result.plans[4].amount).toBe(649000);
    });

    it('should use default title when first line is a plan', () => {
      const text = `10GB → 99K\n20GB → 169K`;
      const result = parsePriceList(text, 'Default Title');

      expect(result.title).toBe('Default Title');
      expect(result.plans).toHaveLength(2);
      expect(result.plans[0].name).toBe('10GB');
    });

    it('should handle Persian text with mixed separators and digits', () => {
      const text = `پلن‌های طلایی\n۱۰ گیگابایت : ۹۹ هزار\n۲۰ گیگابایت - ۱۶۹,۰۰۰\n۳۰ گیگابایت -> ۲۲۹K`;
      const result = parsePriceList(text);

      expect(result.title).toBe('پلن‌های طلایی');
      expect(result.plans).toHaveLength(3);
      expect(result.plans[0].amount).toBe(99000);
      expect(result.plans[1].amount).toBe(169000);
      expect(result.plans[2].amount).toBe(229000);
    });
  });

  describe('formatDisplayPrice', () => {
    it('should format amounts in Tomans', () => {
      expect(formatDisplayPrice(99000, 'TOMAN')).toBe('99,000 تومان');
    });

    it('should format other currencies', () => {
      expect(formatDisplayPrice(50, 'USD')).toBe('50 USD');
    });
  });
});
