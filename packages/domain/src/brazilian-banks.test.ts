import { describe, expect, it } from 'vitest';
import {
  CUSTOM_BANK_OPTION_ID,
  findBrazilianBankByName,
  resolveBankCatalogName,
} from './brazilian-banks';

describe('resolveBankCatalogName', () => {
  it('resolve banco do catálogo', () => {
    expect(resolveBankCatalogName({ catalogId: 'nubank' })).toBe('Nubank');
    expect(resolveBankCatalogName({ catalogId: 'itau' })).toBe('Itaú');
  });

  it('aceita nome customizado', () => {
    expect(
      resolveBankCatalogName({ catalogId: CUSTOM_BANK_OPTION_ID, customName: '  Meu Banco  ' }),
    ).toBe('Meu Banco');
  });

  it('rejeita custom sem nome', () => {
    expect(() => resolveBankCatalogName({ catalogId: CUSTOM_BANK_OPTION_ID })).toThrow(
      /nome do banco/i,
    );
  });
});

describe('findBrazilianBankByName', () => {
  it('casa nome e alias', () => {
    expect(findBrazilianBankByName('Nubank')?.id).toBe('nubank');
    expect(findBrazilianBankByName('Banco Inter')?.id).toBe('inter');
    expect(findBrazilianBankByName('Itau')?.id).toBe('itau');
  });
});
