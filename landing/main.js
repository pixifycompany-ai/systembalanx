/* ===================== BALANX — Landing JS ===================== */
(() => {
  'use strict';

  // ano no rodapé
  const y = document.getElementById('year');
  if (y) y.textContent = new Date().getFullYear();

  // ---- nav: sombra ao rolar ----
  const nav = document.getElementById('nav');
  const onScroll = () => nav && nav.classList.toggle('scrolled', window.scrollY > 12);
  onScroll();
  window.addEventListener('scroll', onScroll, { passive: true });

  // ---- menu mobile ----
  const burger = document.getElementById('burger');
  const menu = document.getElementById('mobilemenu');
  if (burger && menu) {
    const toggle = (open) => {
      const willOpen = open ?? menu.hasAttribute('hidden');
      if (willOpen) menu.removeAttribute('hidden'); else menu.setAttribute('hidden', '');
      burger.setAttribute('aria-expanded', String(willOpen));
    };
    burger.addEventListener('click', () => toggle());
    menu.querySelectorAll('a').forEach((a) => a.addEventListener('click', () => toggle(false)));
  }

  // ---- reveal no scroll ----
  const reveals = document.querySelectorAll('.reveal');
  if ('IntersectionObserver' in window) {
    const io = new IntersectionObserver((entries) => {
      entries.forEach((e) => {
        if (e.isIntersecting) {
          const d = Number(e.target.dataset.delay || 0);
          setTimeout(() => e.target.classList.add('is-visible'), d);
          io.unobserve(e.target);
        }
      });
    }, { threshold: 0.14, rootMargin: '0px 0px -8% 0px' });
    reveals.forEach((el) => io.observe(el));
  } else {
    reveals.forEach((el) => el.classList.add('is-visible'));
  }

  // ---- animações decorativas: só enquanto visíveis (economiza CPU/GPU no celular) ----
  const animados = document.querySelectorAll('.hero__stage');
  if ('IntersectionObserver' in window) {
    const ao = new IntersectionObserver((entries) => {
      entries.forEach((e) => e.target.classList.toggle('anim-on', e.isIntersecting));
    }, { rootMargin: '80px 0px' });
    animados.forEach((el) => ao.observe(el));
  } else {
    animados.forEach((el) => el.classList.add('anim-on'));
  }


  // ---- mega-menu "Produtos" ----
  const prodBtn = document.getElementById('prodBtn');
  const mega = document.getElementById('megamenu');
  if (prodBtn && mega) {
    const setMega = (open) => {
      mega.hidden = !open;
      prodBtn.setAttribute('aria-expanded', String(open));
    };
    prodBtn.addEventListener('click', (e) => { e.stopPropagation(); setMega(mega.hidden); });
    mega.querySelectorAll('a').forEach((a) => a.addEventListener('click', () => setMega(false)));
    document.addEventListener('click', (e) => { if (!mega.hidden && !mega.contains(e.target)) setMega(false); });
    document.addEventListener('keydown', (e) => { if (e.key === 'Escape' && !mega.hidden) { setMega(false); prodBtn.focus(); } });
  }

  // ---- "Um dia normal": conversa por situação ----
  const R = (n) => `<b>R$ ${n}</b>`;
  const CENAS = [
    [['u', 'Bom dia, IARA. O que tenho hoje?'],
     ['i', `Hoje entram ${R('3.200,00')} (Café Aurora e Estúdio Brisa) e sai ${R('720,00')} da contabilidade. Seu saldo fecha o dia em ${R('18.940,00')}.`],
     ['i', 'Às 10h você tem reunião com a Café Aurora. Quer que eu deixe o contrato dela aberto?']],
    [['u', 'Cobra 1.500 do Estúdio Brisa dia 25 no Pix'],
     ['i', 'Preparei a cobrança. Ela vai no WhatsApp do cliente e, se atrasar, eu reenvio todo dia.'],
     ['card', '<small>Cobrança · Estúdio Brisa · Pix</small><div class="money money--xl" style="font-size:34px"><small>R$</small>1.500<small>,00</small></div><small style="margin-bottom:12px">Vence 25/11 · lembrete 3 dias antes</small><span class="btn btn--dark">Confirmar</span>']],
    [['audio', '0:04'],
     ['u', '“Paguei 86 de almoço com cliente no cartão da empresa”'],
     ['i', `Lancei ${R('86,00')} em <b>Alimentação</b>, no cartão da empresa. Vai para a fatura de dezembro.`]],
    [['u', 'Vai dar pra pagar as contas até o fim do mês?'],
     ['i', `Sim. Você fecha novembro com ${R('12.380,40')} e o menor saldo é ${R('4.120,00')}, no dia 28.`],
     ['i', `Mesmo se nenhum cliente pagar até lá, ainda sobra ${R('1.900,00')}.`]],
    [['u', 'Quem está me devendo?'],
     ['i', `Falta receber ${R('9.174,80')} em novembro: ${R('8.426,30')} no prazo e ${R('748,50')} em atraso.`],
     ['i', 'Em atraso: Clínica Lírio (R$ 498,50, 6 dias) e Oficina Prisma (R$ 250,00, 2 dias). Os dois recebem lembrete todo dia no WhatsApp.']],
    [['u', 'Quanto posso retirar de lucro esse mês?'],
     ['i', `O lucro de novembro está em ${R('9.420,00')}.`],
     ['i', `Guardando um mês de despesas no caixa, dá para retirar ${R('5.000,00')} com folga. Quer que eu lance a distribuição?`]],
  ];
  const chatEl = document.getElementById('dayChat');
  const sits = document.querySelectorAll('.sit');
  const reduceMo = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  let cenaTimer = [];
  const bolha = (tipo, html) => {
    const el = document.createElement('div');
    if (tipo === 'card') { el.className = 'msg-card'; el.innerHTML = html; }
    else if (tipo === 'audio') {
      el.className = 'msg msg--user msg--audio';
      el.innerHTML = '<svg class="ico ico--sm"><use href="#i-voz"/></svg><span class="wave">' +
        [.4, .8, .5, 1, .6, .9, .35, .7, .5, .8, .45, .65].map((h) => `<i style="--h:${h}"></i>`).join('') + `</span><small>${html}</small>`;
    } else { el.className = `msg msg--${tipo === 'u' ? 'user' : 'iara'}`; el.innerHTML = html; }
    return el;
  };
  const tocarCena = (i) => {
    if (!chatEl) return;
    cenaTimer.forEach(clearTimeout); cenaTimer = [];
    chatEl.innerHTML = '';
    const passos = CENAS[i] || [];
    if (reduceMo) { passos.forEach(([t, h]) => chatEl.appendChild(bolha(t, h))); return; }
    let t = 150;
    passos.forEach(([tipo, html]) => {
      if (tipo === 'i' || tipo === 'card') {
        cenaTimer.push(setTimeout(() => {
          const d = document.createElement('div'); d.className = 'msg msg--iara msg--typing'; d.dataset.typing = '1';
          d.innerHTML = '<span></span><span></span><span></span>'; chatEl.appendChild(d);
        }, t));
        t += 750;
      }
      cenaTimer.push(setTimeout(() => {
        chatEl.querySelectorAll('[data-typing]').forEach((n) => n.remove());
        chatEl.appendChild(bolha(tipo, html));
      }, t));
      t += tipo === 'u' || tipo === 'audio' ? 550 : 650;
    });
  };
  sits.forEach((b) => b.addEventListener('click', () => {
    sits.forEach((x) => { const on = x === b; x.classList.toggle('is-active', on); x.setAttribute('aria-selected', String(on)); });
    tocarCena(Number(b.dataset.sit));
  }));
  if (chatEl) {
    if ('IntersectionObserver' in window) {
      const co = new IntersectionObserver((es) => { if (es.some((e) => e.isIntersecting)) { tocarCena(0); co.disconnect(); } }, { threshold: .3 });
      co.observe(chatEl);
    } else tocarCena(0);
  }

  // ---- "E o resto": chips com descrição ----
  const MAIS = [
    ['Multiusuário', 'Convide sócios, equipe e contador. Cada pessoa entra com o próprio login e você controla o que ela vê.'],
    ['Importar com IA', 'Mande o extrato, a planilha antiga ou o PDF do banco: a IA lê, sugere categoria e você só confere antes de salvar.'],
    ['Conferir com o banco', 'Compare o extrato do banco com o que está lançado e dê baixa no que já entrou ou saiu, sem caçar linha por linha.'],
    ['Relatórios e DRE', 'DRE por competência, despesas por categoria, top clientes e comparativo entre meses — os mesmos números que a IARA usa.'],
    ['Metas', 'Defina a meta de faturamento do mês e acompanhe quanto falta, no painel e nas respostas da IARA.'],
    ['Atalho do iPhone', 'Toque duas vezes atrás do iPhone, fale com a IARA e ouça a resposta. O que mudar algo espera sua confirmação no app.'],
    ['Tema escuro', 'Claro de dia, escuro à noite, ou seguindo o celular. No computador e no celular, com a mesma conta.'],
    ['Segurança', 'Cada conta vê só os próprios dados, com isolamento por usuário e criptografia em trânsito. Você decide quem acessa.'],
  ];
  const moreBox = document.getElementById('moreBox');
  const moreBtns = document.querySelectorAll('[data-more]');
  moreBtns.forEach((b) => b.addEventListener('click', () => {
    const [t, d] = MAIS[Number(b.dataset.more)] || [];
    if (!t || !moreBox) return;
    moreBtns.forEach((x) => x.classList.toggle('is-active', x === b));
    moreBox.innerHTML = '';
    const bt = document.createElement('b'); bt.textContent = t;
    const p = document.createElement('p'); p.textContent = d;
    moreBox.append(bt, p);
  }));

  // ---- toggle de preço (mensal / anual) ----
  const opts = document.querySelectorAll('.toggle__opt');
  const priceNum = document.getElementById('priceNum');
  const pricePer = document.getElementById('pricePer');
  const priceHint = document.getElementById('priceHint');
  const cta = document.getElementById('ctaAssinar');
  const APP = 'https://app.balanx.com.br/criar-conta';
  const PLANOS = {
    anual: { num: '19,90', per: '/mês · cobrado anual', hint: '12× de R$ 19,90 — economize 33% no anual', cta: 'Assinar plano anual', href: `${APP}?plano=anual` },
    mensal: { num: '29,90', per: '/mês', hint: 'Flexível — cancele quando quiser', cta: 'Assinar plano mensal', href: `${APP}?plano=mensal` },
  };
  const setCycle = (cycle) => {
    const p = PLANOS[cycle]; if (!p) return;
    if (priceNum) priceNum.textContent = p.num;
    if (pricePer) pricePer.textContent = p.per;
    if (priceHint) priceHint.textContent = p.hint;
    if (cta) { cta.textContent = p.cta; cta.href = p.href; }
    opts.forEach((o) => {
      const on = o.dataset.cycle === cycle;
      o.classList.toggle('is-active', on);
      o.setAttribute('aria-selected', String(on));
    });
  };
  opts.forEach((o) => o.addEventListener('click', () => setCycle(o.dataset.cycle)));
})();

/* ===================== IARA — chat de pré-venda ===================== */
(() => {
  'use strict';
  const SB = 'https://hvwuuxvsoyovkvedifco.supabase.co';
  const KEY = 'sb_publishable_UiXet8EwrEK9ZdSOExLncw_8GUgON7-';
  const FN = `${SB}/functions/v1/iara-lp`;
  const AUTH = { apikey: KEY, Authorization: `Bearer ${KEY}` };

  const fab = document.getElementById('iaraFab');
  const panel = document.getElementById('iaraPanel');
  const closeBtn = document.getElementById('iaraClose');
  const msgsEl = document.getElementById('iaraMsgs');
  const form = document.getElementById('iaraForm');
  const input = document.getElementById('iaraInput');
  const mic = document.getElementById('iaraMic');
  if (!fab || !panel) return;

  const history = [];
  let opened = false;
  let busy = false;

  const scroll = () => { msgsEl.scrollTop = msgsEl.scrollHeight; };
  const addMsg = (role, text) => {
    const el = document.createElement('div');
    el.className = `iara-msg iara-msg--${role === 'user' ? 'user' : 'bot'}`;
    el.textContent = text;
    msgsEl.appendChild(el);
    scroll();
    return el;
  };

  const openPanel = () => {
    panel.hidden = false;
    fab.classList.add('open');
    opened = true;
    if (!msgsEl.childElementCount) {
      addMsg('bot', 'Oi! Sou a IARA 👋 Posso te explicar o que o BALANX faz, preços, como começar… Pergunte por texto ou toque no microfone.');
    }
    setTimeout(() => input.focus(), 100);
  };
  const closePanel = () => { panel.hidden = true; fab.classList.remove('open'); opened = false; };
  fab.addEventListener('click', () => (opened ? closePanel() : openPanel()));
  closeBtn.addEventListener('click', closePanel);

  const ask = async ({ text, blob }) => {
    if (busy) return;
    busy = true;
    if (text) { addMsg('user', text); history.push({ role: 'user', content: text }); }
    const typing = addMsg('bot', 'digitando…');
    typing.classList.add('iara-msg--typing');
    try {
      let resp;
      if (blob) {
        const fd = new FormData();
        fd.append('file', blob, 'audio.webm');
        fd.append('messages', JSON.stringify(history));
        resp = await fetch(FN, { method: 'POST', headers: AUTH, body: fd });
      } else {
        resp = await fetch(FN, { method: 'POST', headers: { ...AUTH, 'Content-Type': 'application/json' }, body: JSON.stringify({ messages: history }) });
      }
      const data = await resp.json();
      if (blob && data.transcript) { typing.remove(); addMsg('user', data.transcript); history.push({ role: 'user', content: data.transcript }); }
      if (!resp.ok) throw new Error(data.error || 'Erro');
      typing.remove();
      addMsg('bot', data.reply);
      history.push({ role: 'assistant', content: data.reply });
    } catch (e) {
      typing.remove();
      addMsg('bot', e && e.message ? e.message : 'Ops, não consegui responder agora. Tente de novo em instantes.');
    } finally {
      busy = false;
    }
  };

  // Campo do hero e chips: abrem a IARA já com a pergunta.
  const perguntar = (t) => { if (!t) return; if (!opened) openPanel(); ask({ text: t }); };
  const askForm = document.getElementById('askForm');
  const askInput = document.getElementById('askInput');
  if (askForm && askInput) askForm.addEventListener('submit', (e) => { e.preventDefault(); const t = askInput.value.trim(); askInput.value = ''; perguntar(t); });
  document.querySelectorAll('[data-ask]').forEach((b) => b.addEventListener('click', () => perguntar(b.dataset.ask)));

  form.addEventListener('submit', (e) => {
    e.preventDefault();
    const t = input.value.trim();
    if (!t) return;
    input.value = '';
    ask({ text: t });
  });

  // ---- Áudio (MediaRecorder) ----
  let rec = null, chunks = [];
  const stopRec = () => { try { rec && rec.stop(); } catch (_) {} };
  mic.addEventListener('click', async () => {
    if (rec && rec.state === 'recording') { stopRec(); return; }
    if (!navigator.mediaDevices?.getUserMedia || typeof MediaRecorder === 'undefined') {
      addMsg('bot', 'Seu navegador não permite gravar áudio aqui — pode escrever sua pergunta 🙂'); return;
    }
    let stream;
    try { stream = await navigator.mediaDevices.getUserMedia({ audio: true }); }
    catch (_) { addMsg('bot', 'Preciso da permissão do microfone pra ouvir você. Você também pode escrever.'); return; }
    rec = new MediaRecorder(stream);
    chunks = [];
    rec.ondataavailable = (ev) => { if (ev.data && ev.data.size) chunks.push(ev.data); };
    rec.onstop = () => {
      stream.getTracks().forEach((t) => t.stop());
      mic.classList.remove('rec');
      const blob = new Blob(chunks, { type: rec.mimeType || 'audio/webm' });
      if (blob.size > 0) ask({ blob });
    };
    rec.start();
    mic.classList.add('rec');
  });
})();

/* ===================== Cookie consent ===================== */
(() => {
  'use strict';
  const el = document.getElementById('cookie');
  if (!el) return;
  let ok = null;
  try { ok = localStorage.getItem('balanx_cookie'); } catch (_) {}
  if (!ok) el.hidden = false;
  const set = (v) => { try { localStorage.setItem('balanx_cookie', v); } catch (_) {} el.hidden = true; };
  const yes = document.getElementById('cookieYes');
  const no = document.getElementById('cookieNo');
  yes && yes.addEventListener('click', () => set('all'));
  no && no.addEventListener('click', () => set('essential'));
})();
