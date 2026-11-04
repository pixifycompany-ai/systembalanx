import { useSyncExternalStore } from 'react';

/**
 * "Olhinho" dos apps de banco: valores escondidos por padrão, só aparecem ao clicar.
 *
 * A máscara age só no texto da tela, não no formatCurrency: o mesmo formatador monta
 * mensagens de WhatsApp, e-mails e PDFs, que precisam sair sempre com o valor real.
 * Não é persistido de propósito: recarregar ou sair volta a esconder.
 */
let oculto = true;
const ouvintes = new Set<() => void>();

const VALOR = new RegExp(
  [
    // R$ 1.234,56 · -R$ 10,00 · R$ 1.2K · R$12k · R$ 5 mil
    '(?:[-−+]\\s?)?R\\$\\s*[-−]?\\s*\\d(?:[\\d.,]*\\d)?(?:\\s?(?:[KkMB]|mil)\\b)?',
    // 1.234,56 sem o R$ (quando o R$ fica em outro nó de texto); não pega 12,50%
    '(^|[^\\d.,/])\\d{1,3}(?:\\.\\d{3})*,\\d{2}(?![\\d%]|\\s%)',
    // Eixo dos gráficos: 12k
    '\\b\\d+(?:[.,]\\d+)?[kK]\\b',
  ].join('|'),
  'g',
);

export function mascararTexto(texto: string): string {
  return texto.replace(VALOR, (m, antes?: string) =>
    m.includes('R$') ? 'R$ ••••' : `${antes ?? ''}••••`,
  );
}

const IGNORAR = new Set(['SCRIPT', 'STYLE', 'NOSCRIPT', 'TEXTAREA']);
const mascarados = new WeakMap<Text, { original: string; mascara: string }>();

function mascararNo(no: Text) {
  const atual = no.nodeValue;
  if (!atual || !/\d/.test(atual) || IGNORAR.has(no.parentElement?.tagName ?? '')) return;
  const mascara = mascararTexto(atual);
  if (mascara === atual) return;
  mascarados.set(no, { original: atual, mascara });
  no.nodeValue = mascara;
}

function percorrer(raiz: Node, fn: (no: Text) => void) {
  const walker = document.createTreeWalker(raiz, NodeFilter.SHOW_TEXT);
  while (walker.nextNode()) fn(walker.currentNode as Text);
}

function restaurarNo(no: Text) {
  const m = mascarados.get(no);
  // Se o React já trocou o texto, o que está na tela é mais novo que o original guardado.
  if (m && no.nodeValue === m.mascara) no.nodeValue = m.original;
  mascarados.delete(no);
}

// MutationObserver roda antes da pintura: o valor novo nunca chega a aparecer na tela.
const observador = typeof MutationObserver === 'undefined' ? null : new MutationObserver((registros) => {
  for (const r of registros) {
    if (r.type === 'characterData') mascararNo(r.target as Text);
    r.addedNodes.forEach((n) => {
      if (n.nodeType === Node.TEXT_NODE) mascararNo(n as Text);
      else if (n.nodeType === Node.ELEMENT_NODE) percorrer(n, mascararNo);
    });
  }
});

let ativo = false; // AppLayout na tela
let aplicada = false;

function aplicar(deveMascarar: boolean) {
  if (deveMascarar === aplicada) return;
  aplicada = deveMascarar;
  if (deveMascarar) {
    percorrer(document.body, mascararNo);
    observador?.observe(document.body, { subtree: true, childList: true, characterData: true });
  } else {
    observador?.disconnect();
    percorrer(document.body, restaurarNo);
  }
}

function definir(valor: boolean) {
  if (valor === oculto) return;
  oculto = valor;
  aplicar(ativo && oculto);
  ouvintes.forEach((fn) => fn());
}

export const alternarValores = () => definir(!oculto);
export const ocultarValores = () => definir(true);

export function useValoresOcultos() {
  return useSyncExternalStore(
    (fn) => { ouvintes.add(fn); return () => { ouvintes.delete(fn); }; },
    () => oculto,
  );
}

/** Liga a máscara enquanto o app logado está na tela. Devolve a função que desliga. */
export function ligarMascara() {
  ativo = true;
  aplicar(oculto);
  // O relatório impresso sai da tela: imprimir precisa do valor real.
  const antesImprimir = () => aplicar(false);
  const depoisImprimir = () => aplicar(ativo && oculto);
  window.addEventListener('beforeprint', antesImprimir);
  window.addEventListener('afterprint', depoisImprimir);
  return () => {
    ativo = false;
    aplicar(false);
    window.removeEventListener('beforeprint', antesImprimir);
    window.removeEventListener('afterprint', depoisImprimir);
  };
}
