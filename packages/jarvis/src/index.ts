import { formatBrlFromCents, resolveEntities, type ResolveContext } from '@tim/domain';
import { z } from 'zod';

export const jarvisIntentSchema = z.discriminatedUnion('type', [
  z.object({
    type: z.literal('create_expense'),
    amountCents: z.number().int().positive(),
    categoryHint: z.string().optional(),
    costCenterHint: z.string().optional(),
    accountHint: z.string().optional(),
    description: z.string().optional(),
    occurredOn: z.string().optional(),
  }),
  z.object({
    type: z.literal('create_income'),
    amountCents: z.number().int().positive(),
    categoryHint: z.string().optional(),
    costCenterHint: z.string().optional(),
    accountHint: z.string().optional(),
    description: z.string().optional(),
    occurredOn: z.string().optional(),
  }),
  z.object({
    type: z.literal('ask_clarification'),
    question: z.string(),
    options: z.array(z.object({ id: z.string(), label: z.string() })).optional(),
  }),
  z.object({
    type: z.literal('summary'),
    period: z.enum(['month', 'week']).default('month'),
  }),
  z.object({
    type: z.literal('unknown'),
    message: z.string(),
  }),
]);

export type JarvisIntent = z.infer<typeof jarvisIntentSchema>;

const amountRegex = /(\d{1,3}(?:\.\d{3})*(?:,\d{2})?|\d+(?:,\d{2})?)\s*(?:reais|real|r\$)?/i;

function parseAmountCents(text: string): number | null {
  const match = text.match(amountRegex);
  if (!match?.[1]) return null;
  const raw = match[1].replace(/\./g, '').replace(',', '.');
  const value = Number(raw);
  if (Number.isNaN(value)) return null;
  return Math.round(value * 100);
}

/** Heuristic intent parser for offline/demo; LLM can replace in production. */
export function parseJarvisUtterance(text: string): JarvisIntent {
  const lower = text.toLowerCase();
  const amountCents = parseAmountCents(text);

  if (
    (lower.includes('despesa') || lower.includes('gastei') || lower.includes('paguei')) &&
    amountCents
  ) {
    const categoryHint = extractAfter(lower, ['de ', 'em ', 'no ', 'na ']);
    const costCenterHint = extractCostCenterHint(lower);
    return {
      type: 'create_expense',
      amountCents,
      categoryHint: categoryHint ?? undefined,
      costCenterHint: costCenterHint ?? undefined,
      description: text,
    };
  }

  if (
    (lower.includes('receita') ||
      lower.includes('recebi') ||
      lower.includes('salário') ||
      lower.includes('salario')) &&
    amountCents
  ) {
    return {
      type: 'create_income',
      amountCents,
      description: text,
      costCenterHint: extractCostCenterHint(lower) ?? undefined,
    };
  }

  if (lower.includes('resumo') || lower.includes('quanto gastei') || lower.includes('gastos')) {
    return { type: 'summary', period: 'month' };
  }

  return {
    type: 'unknown',
    message: 'Não entendi. Exemplos: "adicione despesa de 100 reais de supermercado no PF".',
  };
}

function extractAfter(text: string, markers: string[]): string | null {
  for (const marker of markers) {
    const idx = text.lastIndexOf(marker);
    if (idx >= 0) {
      const slice = text
        .slice(idx + marker.length)
        .replace(/\b(reais|real|r\$|no|na|pf|pj)\b/gi, '')
        .trim();
      if (slice.length > 1) return slice.split(/\s+/).slice(0, 3).join(' ');
    }
  }
  return null;
}

function extractCostCenterHint(text: string): string | null {
  if (/\bpf\b|pessoa fisica|pessoa física/.test(text)) return 'Pessoa Física';
  if (/\bpj\b|empresa/.test(text)) {
    const m = text.match(/empresa\s+([a-z0-9]+)/i);
    return m?.[1] ? `Empresa ${m[1]}` : 'Empresa';
  }
  return null;
}

export function buildJarvisSystemPrompt(context: ResolveContext): string {
  return [
    'Você é o Jarvis do Time is Money, assistente financeiro em PT-BR.',
    'Nunca invente categorias, contas ou centros de custo.',
    'Centros:',
    ...context.costCenters.map((c) => `- ${c.name} (${c.id})`),
    'Categorias:',
    ...context.categories.map((c) => `- ${c.name} [${c.type}] aliases=${c.aliases.join('|')}`),
    'Contas:',
    ...context.accounts.map((a) => `- ${a.name} (${a.id}) centro=${a.costCenterId}`),
    'Se ambíguo, peça clarificação com opções.',
  ].join('\n');
}

export function resolveIntentAgainstContext(
  intent: JarvisIntent,
  context: ResolveContext,
  defaults: { costCenterId?: string; accountId?: string },
): {
  ready: boolean;
  costCenterId?: string;
  categoryId?: string;
  accountId?: string;
  clarification?: Extract<JarvisIntent, { type: 'ask_clarification' }>;
  reply: string;
} {
  if (intent.type !== 'create_expense' && intent.type !== 'create_income') {
    return {
      ready: false,
      reply:
        intent.type === 'summary'
          ? 'Vou buscar o resumo do período.'
          : intent.type === 'ask_clarification'
            ? intent.question
            : intent.message,
    };
  }

  const resolved = resolveEntities(
    {
      costCenter: intent.costCenterHint,
      category: intent.categoryHint,
      account: intent.accountHint,
    },
    context,
  );

  if (resolved.ambiguities.length > 0) {
    const first = resolved.ambiguities[0]!;
    return {
      ready: false,
      clarification: {
        type: 'ask_clarification',
        question: `Qual ${first.field}?`,
        options: first.options.map((o) => ({ id: o.id, label: o.name })),
      },
      reply: `Qual ${first.field}? ${first.options.map((o) => o.name).join(' ou ')}?`,
    };
  }

  const costCenterId = resolved.costCenterId ?? defaults.costCenterId;
  const accountId = resolved.accountId ?? defaults.accountId;
  const categoryId = resolved.categoryId;

  if (!costCenterId || !accountId || !categoryId) {
    return {
      ready: false,
      reply: 'Preciso de centro de custo, categoria e conta. Pode detalhar?',
    };
  }

  return {
    ready: true,
    costCenterId,
    categoryId,
    accountId,
    reply: `Pronto — ${intent.type === 'create_expense' ? 'despesa' : 'receita'} de ${formatBrlFromCents(intent.amountCents)} registrada.`,
  };
}

export const jarvisTools = [
  {
    type: 'function' as const,
    function: {
      name: 'create_expense',
      description: 'Cria uma despesa no household',
      parameters: {
        type: 'object',
        properties: {
          amountCents: { type: 'number' },
          categoryId: { type: 'string' },
          costCenterId: { type: 'string' },
          accountId: { type: 'string' },
          description: { type: 'string' },
          occurredOn: { type: 'string' },
        },
        required: ['amountCents', 'categoryId', 'costCenterId', 'accountId'],
      },
    },
  },
];
