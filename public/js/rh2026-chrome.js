/**
 * 2026 版页面「外壳」交互脚本（多页 SSR 专用，不含 SPA hash 路由）
 *
 * 仅负责公共骨架交互：mega 幕布菜单、移动端菜单、AI 顾问抽屉开合、滚动进度条。
 * AI 顾问的检索/问答逻辑在阶段 2A 接入后端接口，这里仅提供开合与占位提示。
 */
(function () {
  'use strict';

  // ===== Mega 幕布菜单（桌面端 hover 展开） =====
  (function () {
    const sheet = document.getElementById('megaSheet');
    const dim = document.getElementById('megaDim');
    const nav = document.getElementById('nav');
    if (!sheet || !nav) return;
    const panes = {};
    sheet.querySelectorAll('.mega-pane').forEach(p => (panes[p.dataset.pane] = p));
    const triggers = [...document.querySelectorAll('.nav-mt')];
    let openKey = null, closeTimer = null;
    function openMenu(key) {
      clearTimeout(closeTimer);
      const pane = panes[key];
      if (!pane || openKey === key) return;
      Object.entries(panes).forEach(([k, p]) => p.classList.toggle('on', k === key));
      sheet.style.height = pane.offsetHeight + 'px';
      sheet.classList.add('open');
      sheet.setAttribute('aria-hidden', 'false');
      dim && dim.classList.add('on');
      triggers.forEach(t => t.classList.toggle('act', t.dataset.menu === key));
      openKey = key;
    }
    function closeNow() {
      clearTimeout(closeTimer);
      sheet.style.height = '0px';
      sheet.classList.remove('open');
      sheet.setAttribute('aria-hidden', 'true');
      dim && dim.classList.remove('on');
      Object.values(panes).forEach(p => p.classList.remove('on'));
      triggers.forEach(t => t.classList.remove('act'));
      openKey = null;
    }
    function scheduleClose() { clearTimeout(closeTimer); closeTimer = setTimeout(closeNow, 140); }
    triggers.forEach(t => {
      t.addEventListener('mouseenter', () => openMenu(t.dataset.menu));
      t.addEventListener('focus', () => openMenu(t.dataset.menu));
    });
    document.querySelectorAll('#navLinks > a:not(.nav-mt)').forEach(a => {
      a.addEventListener('mouseenter', scheduleClose);
    });
    nav.addEventListener('mouseleave', scheduleClose);
    sheet.addEventListener('mouseenter', () => clearTimeout(closeTimer));
    sheet.addEventListener('mouseleave', scheduleClose);
    dim && dim.addEventListener('click', closeNow);
  })();

  // ===== 移动端菜单 =====
  window.toggleMnav = function (force) {
    const on = typeof force === 'boolean' ? force : !document.body.classList.contains('mnav-on');
    document.body.classList.toggle('mnav-on', on);
    const bg = document.getElementById('burger');
    if (bg) bg.setAttribute('aria-label', on ? '关闭菜单' : '打开菜单');
  };
  (function () {
    const m = document.getElementById('mnav');
    if (m) m.addEventListener('click', e => { if (e.target.closest('a')) window.toggleMnav(false); });
  })();

  // ===== AI 顾问抽屉（开合；检索接阶段 2A） =====
  window.openDrawer = function () {
    const d = document.getElementById('drawer');
    if (!d) return;
    d.classList.add('open');
    const body = document.getElementById('dwBody');
    if (body && !body.dataset.greeted) {
      body.dataset.greeted = '1';
      const el = document.createElement('div');
      el.className = 'dm ai';
      el.innerHTML = '<span>你好，我是瑞华 AI 顾问。全站内容检索正在接入中，稍后即可为你解答产品、案例与研究相关问题。</span>';
      body.appendChild(el);
    }
    setTimeout(() => { const i = document.getElementById('dwInput'); i && i.focus(); }, 350);
  };
  window.closeDrawer = function () {
    const d = document.getElementById('drawer');
    if (d) d.classList.remove('open');
  };
  window.send = function () {
    const input = document.getElementById('dwInput');
    const body = document.getElementById('dwBody');
    if (!input || !body || !input.value.trim()) return;
    const q = input.value.trim();
    input.value = '';
    const me = document.createElement('div');
    me.className = 'dm me';
    me.innerHTML = '<span></span>';
    me.querySelector('span').textContent = q;
    body.appendChild(me);
    const ai = document.createElement('div');
    ai.className = 'dm ai';
    ai.innerHTML = '<span>AI 顾问检索能力正在接入中（阶段 2A）。你可以先浏览产品与服务、行业案例与研究中心。</span>';
    body.appendChild(ai);
    body.scrollTop = body.scrollHeight;
  };

  // ===== 滚动进度条 =====
  (function () {
    const bar = document.getElementById('aProg');
    if (!bar) return;
    function onScroll() {
      const h = document.documentElement;
      const max = h.scrollHeight - h.clientHeight;
      bar.style.width = max > 0 ? (h.scrollTop / max * 100) + '%' : '0';
    }
    addEventListener('scroll', onScroll, { passive: true });
    onScroll();
  })();

  // ===== 进场动画：.reveal 元素滚动显现 =====
  (function () {
    const els = document.querySelectorAll('.reveal');
    if (!els.length || !('IntersectionObserver' in window)) {
      els.forEach(e => e.classList.add('in'));
      return;
    }
    const io = new IntersectionObserver(entries => {
      entries.forEach(en => { if (en.isIntersecting) { en.target.classList.add('in'); io.unobserve(en.target); } });
    }, { threshold: 0.12 });
    els.forEach(e => io.observe(e));
  })();
})();
