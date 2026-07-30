/** Catálogo de bancos BR para seleção no cadastro (sem Open Banking). */
export interface BrazilianBankOption {
  /** Identificador estável do catálogo (não é UUID do tenant). */
  id: string;
  name: string;
  /** Cor de marca aproximada (hex) para avatar/fallback. */
  brandColor: string;
  /** Iniciais no avatar quando o favicon falha. */
  monogram: string;
  /** Domínio público para logo (favicon). */
  domain: string;
  /** Nomes alternativos para casar instituição já salva só com `name`. */
  aliases?: readonly string[];
}

export const BRAZILIAN_BANKS: readonly BrazilianBankOption[] = [
  {
    id: 'nubank',
    name: 'Nubank',
    brandColor: '#820AD1',
    monogram: 'Nu',
    domain: 'nubank.com.br',
  },
  {
    id: 'itau',
    name: 'Itaú',
    brandColor: '#EC7000',
    monogram: 'It',
    domain: 'itau.com.br',
    aliases: ['Itau', 'Banco Itaú', 'Banco Itau'],
  },
  {
    id: 'bradesco',
    name: 'Bradesco',
    brandColor: '#CC092F',
    monogram: 'Br',
    domain: 'bradesco.com.br',
  },
  {
    id: 'bb',
    name: 'Banco do Brasil',
    brandColor: '#FFCC00',
    monogram: 'BB',
    domain: 'bb.com.br',
    aliases: ['BB', 'Banco Brasil'],
  },
  {
    id: 'caixa',
    name: 'Caixa',
    brandColor: '#0070AF',
    monogram: 'CX',
    domain: 'caixa.gov.br',
    aliases: ['Caixa Econômica', 'Caixa Economica', 'CEF'],
  },
  {
    id: 'santander',
    name: 'Santander',
    brandColor: '#EC0000',
    monogram: 'Sa',
    domain: 'santander.com.br',
  },
  {
    id: 'inter',
    name: 'Inter',
    brandColor: '#FF7A00',
    monogram: 'In',
    domain: 'bancointer.com.br',
    aliases: ['Banco Inter'],
  },
  {
    id: 'c6',
    name: 'C6 Bank',
    brandColor: '#1A1A1A',
    monogram: 'C6',
    domain: 'c6bank.com.br',
    aliases: ['C6'],
  },
  {
    id: 'btg',
    name: 'BTG Pactual',
    brandColor: '#1B2B34',
    monogram: 'BT',
    domain: 'btgpactual.com',
    aliases: ['BTG'],
  },
  {
    id: 'xp',
    name: 'XP',
    brandColor: '#000000',
    monogram: 'XP',
    domain: 'xpi.com.br',
    aliases: ['XP Investimentos'],
  },
  {
    id: 'sofisa',
    name: 'Sofisa Direto',
    brandColor: '#0033A0',
    monogram: 'So',
    domain: 'sofisa.com.br',
    aliases: ['Sofisa'],
  },
  {
    id: 'will',
    name: 'Will Bank',
    brandColor: '#00C2A8',
    monogram: 'Wi',
    domain: 'willbank.com.br',
    aliases: ['Will'],
  },
  {
    id: 'picpay',
    name: 'PicPay',
    brandColor: '#21C25E',
    monogram: 'PP',
    domain: 'picpay.com',
  },
  {
    id: 'mercado-pago',
    name: 'Mercado Pago',
    brandColor: '#009EE3',
    monogram: 'MP',
    domain: 'mercadopago.com.br',
  },
  {
    id: 'neon',
    name: 'Neon',
    brandColor: '#00E88F',
    monogram: 'Ne',
    domain: 'neon.com.br',
  },
  {
    id: 'pagbank',
    name: 'PagBank',
    brandColor: '#00A868',
    monogram: 'PB',
    domain: 'pagbank.com.br',
    aliases: ['PagSeguro'],
  },
  {
    id: 'original',
    name: 'Banco Original',
    brandColor: '#00A859',
    monogram: 'Or',
    domain: 'original.com.br',
    aliases: ['Original'],
  },
  {
    id: 'safra',
    name: 'Safra',
    brandColor: '#003366',
    monogram: 'Sf',
    domain: 'safra.com.br',
    aliases: ['Banco Safra'],
  },
  {
    id: 'sicoob',
    name: 'Sicoob',
    brandColor: '#003641',
    monogram: 'Sc',
    domain: 'sicoob.com.br',
  },
  {
    id: 'sicredi',
    name: 'Sicredi',
    brandColor: '#3FAE2A',
    monogram: 'Si',
    domain: 'sicredi.com.br',
  },
] as const;

export const CUSTOM_BANK_OPTION_ID = 'custom' as const;

function normalizeBankName(name: string): string {
  return name.normalize('NFD').replace(/\p{M}/gu, '').trim().toLowerCase();
}

export function findBrazilianBankById(id: string): BrazilianBankOption | undefined {
  return BRAZILIAN_BANKS.find((bank) => bank.id === id);
}

/** Casa instituição salva (só nome) com o catálogo. */
export function findBrazilianBankByName(name: string): BrazilianBankOption | undefined {
  const needle = normalizeBankName(name);
  if (!needle) return undefined;
  return BRAZILIAN_BANKS.find((bank) => {
    if (normalizeBankName(bank.name) === needle) return true;
    return (bank.aliases ?? []).some((alias) => normalizeBankName(alias) === needle);
  });
}

export function resolveBankCatalogName(input: { catalogId: string; customName?: string }): string {
  if (input.catalogId === CUSTOM_BANK_OPTION_ID) {
    const name = input.customName?.trim() ?? '';
    if (!name) throw new Error('Informe o nome do banco');
    return name;
  }
  const bank = findBrazilianBankById(input.catalogId);
  if (!bank) throw new Error('Banco inválido');
  return bank.name;
}

/** Favicon oficial do domínio do banco (64px). */
export function brazilianBankIconUrl(bank: BrazilianBankOption): string {
  return `https://www.google.com/s2/favicons?domain=${encodeURIComponent(bank.domain)}&sz=128`;
}
