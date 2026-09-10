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

  // ---- efeito de digitação no hero ----
  const typed = document.getElementById('typed');
  const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  if (typed && !reduce) {
    const words = ['no controle', 'previsível', 'sem susto', 'com IA'];
    let wi = 0, ci = 0, deleting = false;
    const tick = () => {
      const word = words[wi];
      ci += deleting ? -1 : 1;
      typed.textContent = word.slice(0, ci);
      let delay = deleting ? 45 : 90;
      if (!deleting && ci === word.length) { delay = 1500; deleting = true; }
      else if (deleting && ci === 0) { deleting = false; wi = (wi + 1) % words.length; delay = 380; }
      setTimeout(tick, delay);
    };
    setTimeout(tick, 900);
  }

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
