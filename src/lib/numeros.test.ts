import { describe, expect, it } from 'vitest';
import { paraPontoDecimal } from '@/lib/numeros';

describe('paraPontoDecimal (campo de valor do celular)', () => {
  it('vírgula decimal vira ponto', () => {
    expect(paraPontoDecimal('12,5')).toBe('12.5');
    expect(paraPontoDecimal('1500,50')).toBe('1500.50');
  });
  it('ponto de milhar some quando há vírgula', () => {
    expect(paraPontoDecimal('1.500,50')).toBe('1500.50');
    expect(paraPontoDecimal('1.234.567,8')).toBe('1234567.8');
  });
  it('sem vírgula, o último ponto é o decimal (teclado de computador)', () => {
    expect(paraPontoDecimal('12.5')).toBe('12.5');
    expect(paraPontoDecimal('1.500.5')).toBe('1500.5');
  });
  it('vírgula no fim mantém a casa decimal sendo digitada', () => {
    expect(paraPontoDecimal('12,')).toBe('12.');
    expect(Number(paraPontoDecimal('12,'))).toBe(12);
  });
  it('ignora letras e símbolos; menos só no começo', () => {
    expect(paraPontoDecimal('R$ 99,90')).toBe('99.90');
    expect(paraPontoDecimal('-50,00')).toBe('-50.00');
    expect(paraPontoDecimal('5-0')).toBe('50');
  });
});
