import { describe, expect, it } from 'vitest';
import { numberToWords } from './numberToWords';

// Valor por extenso usado no recibo (ReceiptGenerator).
describe('numberToWords', () => {
  it('zero, singular e plural de real', () => {
    expect(numberToWords(0)).toBe('zero reais');
    expect(numberToWords(1)).toBe('um real');
    expect(numberToWords(2)).toBe('dois reais');
  });

  it('só centavos', () => {
    expect(numberToWords(0.01)).toBe('um centavo');
    expect(numberToWords(0.5)).toBe('cinquenta centavos');
    expect(numberToWords(0.29)).toBe('vinte e nove centavos');
  });

  it('reais e centavos, sem erro de ponto flutuante', () => {
    expect(numberToWords(1.5)).toBe('um real e cinquenta centavos');
    expect(numberToWords(10.1)).toBe('dez reais e dez centavos');
    expect(numberToWords(19.99)).toBe('dezenove reais e noventa e nove centavos');
  });

  it('dezenas, especiais e centenas', () => {
    expect(numberToWords(16)).toBe('dezesseis reais');
    expect(numberToWords(21)).toBe('vinte e um reais');
    expect(numberToWords(100)).toBe('cem reais');
    expect(numberToWords(101)).toBe('cento e um reais');
    expect(numberToWords(115)).toBe('cento e quinze reais');
    expect(numberToWords(999)).toBe('novecentos e noventa e nove reais');
  });

  it('milhares com "e" quando a parte final é redonda ou menor que 100', () => {
    expect(numberToWords(1000)).toBe('mil reais');
    expect(numberToWords(1001)).toBe('mil e um reais');
    expect(numberToWords(1100)).toBe('mil e cem reais');
    expect(numberToWords(2000)).toBe('dois mil reais');
    expect(numberToWords(1500000)).toBe('um milhão e quinhentos mil reais');
  });

  // Era bug, corrigido em 11/2026 (numberToWords.ts:62): junta todos os grupos com " e ". Em português,
  // milhar seguido de centena não redonda não leva "e": "mil duzentos e trinta e quatro".
  it('1.234,56 → "mil duzentos e trinta e quatro reais e cinquenta e seis centavos"', () => {
    expect(numberToWords(1234.56)).toBe('mil duzentos e trinta e quatro reais e cinquenta e seis centavos');
  });

  // Era bug, corrigido em 11/2026 (numberToWords.ts:65-69): milhão/bilhão exato pede "de reais".
  it('1.000.000 → "um milhão de reais"', () => {
    expect(numberToWords(1000000)).toBe('um milhão de reais');
  });
});
