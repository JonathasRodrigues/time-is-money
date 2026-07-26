import { describe, expect, it } from 'vitest';
import { analyzeCategoryAttention } from './attention';

describe('analyzeCategoryAttention', () => {
  const months = [
    { key: '2026-01', label: 'jan' },
    { key: '2026-02', label: 'fev' },
    { key: '2026-03', label: 'mar' },
  ];

  it('detects supermarket spike and rebound (1000 → 1500 → 1000)', () => {
    const signals = analyzeCategoryAttention({
      months,
      seriesByCategory: {
        Supermercado: [100_000, 150_000, 100_000],
      },
      minAbsCents: 1_000,
      minPct: 0.2,
    });

    expect(signals).toHaveLength(1);
    expect(signals[0]?.kind).toBe('rebound');
    expect(signals[0]?.categoryName).toBe('Supermercado');
    expect(signals[0]?.detail).toMatch(/1\.500/);
    expect(signals[0]?.detail).toMatch(/voltou/);
  });

  it('detects current month spike', () => {
    const signals = analyzeCategoryAttention({
      months,
      seriesByCategory: {
        Lazer: [40_000, 42_000, 70_000],
      },
      minAbsCents: 5_000,
      minPct: 0.2,
    });

    expect(signals.some((s) => s.kind === 'spike' || s.kind === 'sustained_rise')).toBe(true);
  });

  it('detects relevant drop', () => {
    const signals = analyzeCategoryAttention({
      months,
      seriesByCategory: {
        Transporte: [50_000, 48_000, 20_000],
      },
      minAbsCents: 5_000,
      minPct: 0.2,
    });

    expect(signals.some((s) => s.kind === 'drop')).toBe(true);
  });
});
