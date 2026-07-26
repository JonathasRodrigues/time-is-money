import { describe, expect, it } from 'vitest';
import { parseJarvisUtterance, resolveIntentAgainstContext } from './index';

describe('jarvis', () => {
  it('parses expense utterance', () => {
    const intent = parseJarvisUtterance(
      'Oi Jarvis, adiciona uma despesa de 100 reais de supermercado no PF',
    );
    expect(intent.type).toBe('create_expense');
    if (intent.type === 'create_expense') {
      expect(intent.amountCents).toBe(10000);
    }
  });

  it('asks clarification when category ambiguous', () => {
    const intent = parseJarvisUtterance('despesa de 50 reais de mercado');
    const result = resolveIntentAgainstContext(
      intent,
      {
        costCenters: [{ id: 'pf', name: 'Pessoa Física' }],
        categories: [
          { id: '1', name: 'Supermercado', type: 'expense', aliases: ['mercado'] },
          { id: '2', name: 'Mercado Livre', type: 'expense', aliases: ['mercado'] },
        ],
        accounts: [{ id: 'a1', name: 'Carteira', costCenterId: 'pf' }],
      },
      { costCenterId: 'pf', accountId: 'a1' },
    );
    expect(result.ready).toBe(false);
    expect(result.clarification?.type).toBe('ask_clarification');
  });
});
