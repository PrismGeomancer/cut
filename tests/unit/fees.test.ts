import { describe, it, expect } from 'vitest';
import { parseSol, cashbackLamports, lamportsToSolString, solToLamports } from '../../src/lib/fees';

describe('fees (integer lamports)', () => {
  it('parses decimal SOL strings exactly', () => {
    expect(parseSol('0.05')).toBe(50_000_000);
    expect(parseSol('1')).toBe(1_000_000_000);
    expect(parseSol('2.123456789')).toBe(2_123_456_789);
    expect(parseSol('0.1')).toBe(100_000_000); // no 0.1 float drift
  });
  it('rejects bad input', () => {
    for (const v of ['', '-1', '1e3', '0.0000000001', 'abc', '1.2.3', ' ']) expect(parseSol(v)).toBeNull();
  });
  it('floors 3.5% and caps it', () => {
    const cap = solToLamports(0.5);
    expect(cashbackLamports(1_000_000_000, 350, cap)).toBe(35_000_000);
    expect(cashbackLamports(123_456_789, 350, cap)).toBe(4_320_987); // floor(4320987.615)
    expect(cashbackLamports(100 * 1e9, 350, cap)).toBe(cap);
    expect(cashbackLamports(0, 350, cap)).toBe(0);
    expect(cashbackLamports(1, 350, cap)).toBe(0);
  });
  it('formats lamports back to SOL without trailing zeros', () => {
    expect(lamportsToSolString(50_000_000)).toBe('0.05');
    expect(lamportsToSolString(1_000_000_000)).toBe('1');
    expect(lamportsToSolString(1)).toBe('0.000000001');
  });
});
