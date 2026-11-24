import { describe, expect, it } from 'vitest';
import { digitarMoeda, mostrarMoeda, valorNumero } from './moeda';

describe('digitar valor como no app do banco', () => {
  it('cada dígito entra pela direita', () => {
    expect(digitarMoeda('3')).toBe(0.03);
    expect(digitarMoeda('34')).toBe(0.34);
    expect(digitarMoeda('3498')).toBe(34.98);
    expect(digitarMoeda('349800')).toBe(3498);
  });
  it('continua digitando em cima do que está formatado', () => {
    expect(digitarMoeda(mostrarMoeda(34.98) + '0')).toBe(349.8);
    expect(digitarMoeda('34,9')).toBe(3.49); // apagou o último dígito de 34,98
  });
  it('mostra com ponto e vírgula', () => {
    expect(mostrarMoeda(3498)).toBe('3.498,00');
    expect(mostrarMoeda(0)).toBe('');
  });
  it('negativo só quando permitido', () => {
    expect(digitarMoeda('12,34-', true)).toBe(-12.34);
    expect(digitarMoeda('-12,34')).toBe(12.34);
  });
  it('entende os formatos que já existem', () => {
    expect(valorNumero('123,45')).toBe(123.45);
    expect(valorNumero('1.234,56')).toBe(1234.56);
    expect(valorNumero('1234.56')).toBe(1234.56);
    expect(valorNumero(7)).toBe(7);
  });
});
