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
