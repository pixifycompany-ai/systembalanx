const unidades = ['', 'um', 'dois', 'três', 'quatro', 'cinco', 'seis', 'sete', 'oito', 'nove'];
const especiais = ['dez', 'onze', 'doze', 'treze', 'quatorze', 'quinze', 'dezesseis', 'dezessete', 'dezoito', 'dezenove'];
const dezenas = ['', '', 'vinte', 'trinta', 'quarenta', 'cinquenta', 'sessenta', 'setenta', 'oitenta', 'noventa'];
const centenas = ['', 'cento', 'duzentos', 'trezentos', 'quatrocentos', 'quinhentos', 'seiscentos', 'setecentos', 'oitocentos', 'novecentos'];

function groupToWords(n: number): string {
  if (n === 0) return '';
  if (n === 100) return 'cem';

  const parts: string[] = [];
  const c = Math.floor(n / 100);
  const d = Math.floor((n % 100) / 10);
  const u = n % 10;

  if (c > 0) parts.push(centenas[c]);

  if (d === 1) {
    parts.push(especiais[u]);
  } else {
    if (d > 1) parts.push(dezenas[d]);
    if (u > 0) parts.push(unidades[u]);
  }

  return parts.join(' e ');
}

export function numberToWords(value: number): string {
  if (value === 0) return 'zero reais';

  const inteiro = Math.floor(Math.abs(value));
  const centavos = Math.round((Math.abs(value) - inteiro) * 100);

  const grupos: { valor: number; singular: string; plural: string }[] = [
    { valor: 1000000000, singular: 'bilhão', plural: 'bilhões' },
    { valor: 1000000, singular: 'milhão', plural: 'milhões' },
    { valor: 1000, singular: 'mil', plural: 'mil' },
    { valor: 1, singular: '', plural: '' },
  ];

  if (inteiro === 0 && centavos > 0) {
    const centavosTexto = groupToWords(centavos);
    return `${centavosTexto} centavo${centavos === 1 ? '' : 's'}`;
  }

  const parts: string[] = [];
  let remaining = inteiro;

  for (const grupo of grupos) {
    const qtd = Math.floor(remaining / grupo.valor);
    if (qtd > 0) {
      const palavras = groupToWords(qtd);
      if (grupo.valor === 1) {
        parts.push(palavras);
      } else {
        const sufixo = qtd === 1 ? grupo.singular : grupo.plural;
        parts.push(qtd === 1 && grupo.valor === 1000 ? sufixo : `${palavras} ${sufixo}`);
      }
      remaining %= grupo.valor;
    }
  }

  let resultado = parts.join(' e ');

  // "reais"
  if (inteiro === 1) {
    resultado += ' real';
  } else {
    resultado += ' reais';
  }

  // centavos
  if (centavos > 0) {
    const centavosTexto = groupToWords(centavos);
    resultado += ` e ${centavosTexto} centavo${centavos === 1 ? '' : 's'}`;
  }

  return resultado;
}
