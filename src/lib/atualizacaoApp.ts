// Mantém o app sempre na versão publicada — principalmente o app instalado na tela
// inicial do iPhone (PWA), que o iOS deixa "congelado" na memória e só retoma, sem
// baixar de novo, até a pessoa fechar o app de vez.
//
// Como sabe que saiu versão nova: o index.html (sem cache) aponta para o bundle
// /assets/index-<hash>.js; se o hash publicado for diferente do que está rodando, há versão nova.
// - Ao voltar para o app (ficou visível de novo): recarrega na hora — a pessoa acabou de abrir
//   (se houver um modal aberto ou campo em edição, só avisa, para não perder o que foi digitado).
// - Com o app aberto: confere a cada 5 min e mostra um aviso com "Atualizar" (não interrompe).
import { toast } from 'sonner';

const INTERVALO = 5 * 60 * 1000;
const BUNDLE = /\/assets\/index-[\w-]+\.js/;

function bundleAtual(): string | null {
  const s = document.querySelector<HTMLScriptElement>('script[type="module"][src*="/assets/index-"]');
  return s?.src.match(BUNDLE)?.[0] ?? null;
}

async function bundlePublicado(): Promise<string | null> {
  try {
    const r = await fetch(`/index.html?v=${Date.now()}`, { cache: 'no-store', headers: { 'Cache-Control': 'no-cache' } });
    if (!r.ok) return null;
    return (await r.text()).match(BUNDLE)?.[0] ?? null;
  } catch {
    return null; // sem internet: tenta de novo depois
  }
}

/** Tem algo em andamento na tela (modal aberto ou campo sendo digitado)? Aí não recarrega sozinho. */
function emUso(): boolean {
  if (document.querySelector('[role="dialog"], [role="alertdialog"]')) return true;
  const el = document.activeElement as HTMLElement | null;
  return !!el && (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA' || el.tagName === 'SELECT' || el.isContentEditable);
}

export function iniciarAtualizacaoAutomatica() {
  if (import.meta.env.DEV) return; // no dev o Vite já recarrega sozinho
  const atual = bundleAtual();
  if (!atual) return;

  let avisou = false;
  let conferindo = false;
  let ultima = Date.now();

  const conferir = async (aoVoltar: boolean) => {
    if (conferindo) return;
    conferindo = true;
    ultima = Date.now();
    try {
      const publicado = await bundlePublicado();
      if (!publicado || publicado === atual) return;
      if (aoVoltar && !emUso()) { window.location.reload(); return; }
      if (avisou) return;
      avisou = true;
      toast('Nova versão do BALANX', {
        description: 'Toque em Atualizar para carregar as melhorias.',
        duration: Infinity,
        action: { label: 'Atualizar', onClick: () => window.location.reload() },
      });
    } finally {
      conferindo = false;
    }
  };

  // Voltou para o app (PWA retomado, aba de novo em foco): confere e recarrega se mudou.
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible' && Date.now() - ultima > 30_000) void conferir(true);
  });
  window.addEventListener('pageshow', (e) => { if ((e as PageTransitionEvent).persisted) void conferir(true); });
  // Com o app aberto.
  window.setInterval(() => { if (document.visibilityState === 'visible') void conferir(false); }, INTERVALO);
}
