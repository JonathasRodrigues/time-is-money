function formatBrlFromCents(cents: number): string {
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  }).format(cents / 100);
}

export type AttentionSeverity = 'critical' | 'warning' | 'info' | 'positive';

export type AttentionKind =
  'spike' | 'drop' | 'rebound' | 'sustained_rise' | 'vs_average' | 'new_category';

export interface CategoryMonthPoint {
  monthKey: string;
  label: string;
  amountCents: number;
}

export interface AttentionSignal {
  id: string;
  categoryName: string;
  severity: AttentionSeverity;
  kind: AttentionKind;
  title: string;
  detail: string;
  deltaCents: number;
  deltaPct: number | null;
  series: CategoryMonthPoint[];
  score: number;
}

export interface AttentionMonthBucket {
  key: string;
  label: string;
}

const DEFAULT_MIN_ABS_CENTS = 8_000; // R$ 80
const DEFAULT_MIN_PCT = 0.2; // 20%
const REBOUND_TOLERANCE = 0.12;

function pctChange(from: number, to: number): number | null {
  if (from <= 0) return null;
  return (to - from) / from;
}

function severityForIncrease(pct: number | null, absCents: number): AttentionSeverity {
  if ((pct !== null && pct >= 0.5) || absCents >= 50_000) return 'critical';
  if ((pct !== null && pct >= 0.25) || absCents >= 20_000) return 'warning';
  return 'info';
}

function severityForDecrease(pct: number | null, absCents: number): AttentionSeverity {
  if ((pct !== null && Math.abs(pct) >= 0.4) || absCents >= 40_000) return 'positive';
  return 'info';
}

function scoreSignal(severity: AttentionSeverity, absDelta: number, kind: AttentionKind): number {
  const severityWeight =
    severity === 'critical' ? 100 : severity === 'warning' ? 70 : severity === 'positive' ? 40 : 25;
  const kindBoost =
    kind === 'rebound' ? 15 : kind === 'sustained_rise' ? 12 : kind === 'spike' ? 10 : 0;
  return severityWeight + kindBoost + Math.min(40, absDelta / 5_000);
}

/**
 * Detecta pontos de atenção em séries mensais por categoria
 * (picos, quedas, retorno à baseline, alta sustentada, vs média).
 */
export function analyzeCategoryAttention(input: {
  months: AttentionMonthBucket[];
  seriesByCategory: Record<string, number[]>;
  minAbsCents?: number;
  minPct?: number;
}): AttentionSignal[] {
  const minAbs = input.minAbsCents ?? DEFAULT_MIN_ABS_CENTS;
  const minPct = input.minPct ?? DEFAULT_MIN_PCT;
  const { months, seriesByCategory } = input;
  if (months.length < 2) return [];

  const signals: AttentionSignal[] = [];

  for (const [categoryName, amounts] of Object.entries(seriesByCategory)) {
    if (amounts.length !== months.length) continue;

    const series: CategoryMonthPoint[] = months.map((month, index) => ({
      monthKey: month.key,
      label: month.label,
      amountCents: amounts[index] ?? 0,
    }));

    const last = amounts.length - 1;
    const curr = amounts[last] ?? 0;
    const prev = amounts[last - 1] ?? 0;
    const before = last >= 2 ? (amounts[last - 2] ?? 0) : null;

    // Pico no mês anterior + retorno próximo da baseline (ex.: 1000 → 1500 → 1000)
    if (before !== null && before > 0 && prev > 0) {
      const spikePct = pctChange(before, prev);
      const backPct = pctChange(before, curr);
      const spiked = spikePct !== null && spikePct >= minPct && prev - before >= minAbs;
      const rebounded =
        backPct !== null &&
        Math.abs(backPct) <= REBOUND_TOLERANCE &&
        Math.abs(curr - before) <= Math.max(minAbs, before * REBOUND_TOLERANCE);

      if (spiked && rebounded) {
        const delta = prev - before;
        const severity = severityForIncrease(spikePct, delta);
        signals.push({
          id: `${categoryName}-rebound-${months[last]?.key ?? last}`,
          categoryName,
          severity,
          kind: 'rebound',
          title: `${categoryName}: pico e retorno`,
          detail: `${months[last - 1]?.label ?? 'mês anterior'} subiu para ${formatBrlFromCents(prev)} (+${Math.round((spikePct ?? 0) * 100)}% vs ${months[last - 2]?.label}), e ${months[last]?.label} voltou a ${formatBrlFromCents(curr)} — perto da baseline de ${formatBrlFromCents(before)}.`,
          deltaCents: delta,
          deltaPct: spikePct,
          series,
          score: scoreSignal(severity, delta, 'rebound'),
        });
      }
    }

    // Alta no mês corrente vs anterior
    if (prev > 0 && curr - prev >= minAbs) {
      const pct = pctChange(prev, curr);
      if (pct !== null && pct >= minPct) {
        const alreadyRebound = signals.some(
          (s) => s.categoryName === categoryName && s.kind === 'rebound',
        );
        if (!alreadyRebound) {
          const severity = severityForIncrease(pct, curr - prev);
          signals.push({
            id: `${categoryName}-spike-${months[last]?.key ?? last}`,
            categoryName,
            severity,
            kind: 'spike',
            title: `${categoryName}: alta relevante`,
            detail: `${formatBrlFromCents(prev)} (${months[last - 1]?.label}) → ${formatBrlFromCents(curr)} (${months[last]?.label}), +${Math.round(pct * 100)}% (${formatBrlFromCents(curr - prev)} a mais).`,
            deltaCents: curr - prev,
            deltaPct: pct,
            series,
            score: scoreSignal(severity, curr - prev, 'spike'),
          });
        }
      }
    }

    // Queda relevante
    if (prev > 0 && prev - curr >= minAbs) {
      const pct = pctChange(prev, curr);
      if (pct !== null && pct <= -minPct) {
        const alreadyRebound = signals.some(
          (s) => s.categoryName === categoryName && s.kind === 'rebound',
        );
        if (!alreadyRebound) {
          const severity = severityForDecrease(pct, prev - curr);
          signals.push({
            id: `${categoryName}-drop-${months[last]?.key ?? last}`,
            categoryName,
            severity,
            kind: 'drop',
            title: `${categoryName}: queda relevante`,
            detail: `${formatBrlFromCents(prev)} (${months[last - 1]?.label}) → ${formatBrlFromCents(curr)} (${months[last]?.label}), ${Math.round(pct * 100)}% (${formatBrlFromCents(prev - curr)} a menos).`,
            deltaCents: curr - prev,
            deltaPct: pct,
            series,
            score: scoreSignal(severity, prev - curr, 'drop'),
          });
        }
      }
    }

    // Alta sustentada em 3 meses
    if (amounts.length >= 3) {
      const a = amounts[last - 2] ?? 0;
      const b = amounts[last - 1] ?? 0;
      const c = amounts[last] ?? 0;
      if (a > 0 && b > a && c > b && c - a >= minAbs) {
        const pct = pctChange(a, c);
        if (pct !== null && pct >= minPct) {
          signals.push({
            id: `${categoryName}-sustained-${months[last]?.key ?? last}`,
            categoryName,
            severity: severityForIncrease(pct, c - a),
            kind: 'sustained_rise',
            title: `${categoryName}: alta em 3 meses`,
            detail: `${formatBrlFromCents(a)} → ${formatBrlFromCents(b)} → ${formatBrlFromCents(c)}. Acúmulo de +${Math.round(pct * 100)}% no trimestre.`,
            deltaCents: c - a,
            deltaPct: pct,
            series,
            score: scoreSignal(severityForIncrease(pct, c - a), c - a, 'sustained_rise'),
          });
        }
      }
    }

    // Vs média dos 3 meses anteriores ao corrente
    if (amounts.length >= 4) {
      const prior = amounts.slice(last - 3, last);
      const avg = prior.reduce((acc, v) => acc + v, 0) / prior.length;
      if (avg >= minAbs && curr - avg >= minAbs) {
        const pct = pctChange(avg, curr);
        if (pct !== null && pct >= minPct) {
          const hasStronger = signals.some(
            (s) =>
              s.categoryName === categoryName &&
              (s.kind === 'spike' || s.kind === 'rebound' || s.kind === 'sustained_rise'),
          );
          if (!hasStronger) {
            signals.push({
              id: `${categoryName}-avg-${months[last]?.key ?? last}`,
              categoryName,
              severity: severityForIncrease(pct, curr - Math.round(avg)),
              kind: 'vs_average',
              title: `${categoryName}: acima da média`,
              detail: `${formatBrlFromCents(curr)} neste mês vs média de ${formatBrlFromCents(Math.round(avg))} nos 3 anteriores (+${Math.round(pct * 100)}%).`,
              deltaCents: curr - Math.round(avg),
              deltaPct: pct,
              series,
              score: scoreSignal(
                severityForIncrease(pct, curr - Math.round(avg)),
                curr - Math.round(avg),
                'vs_average',
              ),
            });
          }
        }
      }
    }

    // Categoria nova (zero nos 2 anteriores, gasto agora)
    if (amounts.length >= 3 && curr >= minAbs && prev === 0 && (before ?? 0) === 0) {
      signals.push({
        id: `${categoryName}-new-${months[last]?.key ?? last}`,
        categoryName,
        severity: 'info',
        kind: 'new_category',
        title: `${categoryName}: gasto novo`,
        detail: `Sem histórico recente e ${formatBrlFromCents(curr)} em ${months[last]?.label}. Vale validar se é pontual.`,
        deltaCents: curr,
        deltaPct: null,
        series,
        score: scoreSignal('info', curr, 'new_category'),
      });
    }
  }

  // Dedup por categoria: mantém o de maior score
  const bestByCategory = new Map<string, AttentionSignal>();
  for (const signal of signals.sort((a, b) => b.score - a.score)) {
    const existing = bestByCategory.get(signal.categoryName);
    if (!existing || signal.score > existing.score) {
      bestByCategory.set(signal.categoryName, signal);
    }
  }

  return [...bestByCategory.values()].sort((a, b) => b.score - a.score);
}
