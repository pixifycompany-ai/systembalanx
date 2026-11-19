// Mantém o cabeçalho do dia "preso" no topo enquanto a lista do Fluxo rola.
// `position: sticky` não funciona aqui: html/body/#root e o <main> do layout têm
// overflow-x: hidden, o que os torna contêineres de rolagem que nunca rolam (a
// rolagem é da janela) — então o sticky fica preso a eles e não "gruda".
// Solução local, sem mexer no CSS global: uma faixa `position: fixed` alinhada à
// largura da lista, que mostra uma cópia do cabeçalho do dia que já passou do topo.
// Os cabeçalhos da lista são marcados com `data-dia-header`. A faixa vai num portal no
// <body>: o PullToRefresh do celular usa transform, que prenderia um `fixed` dentro dele.
import { useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';

export function CabecalhoDiaFixo({ alvo }: { alvo: React.RefObject<HTMLElement> }) {
  const faixa = useRef<HTMLDivElement>(null);
  const atual = useRef<Element | null>(null);

  useEffect(() => {
    let raf = 0;
    const atualizar = () => {
      raf = 0;
      const lista = alvo.current, el = faixa.current;
      if (!lista || !el) return;
      const topo = parseFloat(getComputedStyle(el).top) || 0;
      const r = lista.getBoundingClientRect();
      const cabecalhos = Array.from(lista.querySelectorAll('[data-dia-header]'));
      // Último cabeçalho que já subiu além do topo (o dia que está sendo lido).
      let ativo: Element | null = null;
      for (const c of cabecalhos) {
        if (c.getBoundingClientRect().top < topo) ativo = c; else break;
      }
      const altura = ativo ? (ativo as HTMLElement).offsetHeight : 0;
      // Some quando a lista sai de cena (fim dela passando do topo).
      const mostrar = !!ativo && r.bottom > topo + altura + 8;
      if (!mostrar) { el.style.visibility = 'hidden'; return; }
      // O próximo cabeçalho "empurra" a faixa para cima ao chegar.
      const idx = cabecalhos.indexOf(ativo!);
      const prox = cabecalhos[idx + 1];
      const empurra = prox ? Math.min(0, prox.getBoundingClientRect().top - topo - altura) : 0;
      el.style.left = `${r.left}px`;
      el.style.width = `${r.width}px`;
      el.style.transform = `translateY(${empurra}px)`;
      if (atual.current !== ativo) {
        atual.current = ativo;
        el.replaceChildren(ativo!.cloneNode(true));
      }
      el.style.visibility = 'visible';
    };
    const agendar = () => { if (!raf) raf = requestAnimationFrame(atualizar); };
    window.addEventListener('scroll', agendar, { passive: true });
    window.addEventListener('resize', agendar);
    // A lista muda (filtros, novos lançamentos): recalcula e troca a cópia.
    const obs = new MutationObserver(() => { atual.current = null; agendar(); });
    if (alvo.current) obs.observe(alvo.current, { childList: true, subtree: true, characterData: true });
    agendar();
    return () => {
      window.removeEventListener('scroll', agendar);
      window.removeEventListener('resize', agendar);
      obs.disconnect();
      if (raf) cancelAnimationFrame(raf);
    };
  }, [alvo]);

  return createPortal(
    <div
      ref={faixa}
      aria-hidden
      className="pointer-events-none fixed z-20 overflow-hidden bg-surface shadow-[0_6px_14px_-10px_rgba(11,18,38,0.35)]"
      style={{ top: 'env(safe-area-inset-top, 0px)', visibility: 'hidden' }}
    />,
    document.body,
  );
}
