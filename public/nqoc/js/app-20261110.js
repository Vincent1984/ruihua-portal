/* 原生 JS，IIFE 包裹，不污染 window。交互一律「data-* 属性 + 扫描器接管」，扫描器可重复执行（换页后重扫）。 */
(function () {
  'use strict';
  document.documentElement.classList.add('js');
  var reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  var $$ = function (sel, root) { return Array.prototype.slice.call((root || document).querySelectorAll(sel)); };
  var once = function (el, key) { if (el.dataset[key]) return false; el.dataset[key] = '1'; return true; };

  var toastTimer;
  function toast(msg) {
    var el = document.querySelector('[data-toast]');
    if (!el) return;
    el.textContent = msg; el.hidden = false;
    clearTimeout(toastTimer);
    toastTimer = setTimeout(function () { el.hidden = true; }, 4000);
  }

  /* 导航：当前栏目加 aria-current；移动菜单沿用现有页面的下拉式（切换 hidden） */
  function initNav() {
    $$('a[data-nav-key]').forEach(function (a) {
      if (a.classList.contains('act')) a.setAttribute('aria-current', 'page'); else a.removeAttribute('aria-current');
    });
    var menu = document.getElementById('nqocMobileMenu');
    var btn = document.querySelector('[data-menu-toggle]');
    if (!menu || !btn) return;
    var set = function (open) { menu.classList.toggle('hidden', !open); btn.setAttribute('aria-expanded', String(open)); btn.setAttribute('aria-label', open ? '关闭菜单' : '打开菜单'); };
    set(false);                                   // 换页后收起
    if (!once(menu, 'bound')) return;
    btn.addEventListener('click', function () { set(menu.classList.contains('hidden')); });
    menu.addEventListener('click', function (e) { if (e.target.closest('a')) set(false); });
    document.addEventListener('keydown', function (e) { if (e.key === 'Escape' && !menu.classList.contains('hidden')) { set(false); btn.focus(); } });
  }

  /* 首页 Hero 轮播：自动播放 6 秒一张；悬停、聚焦时停；减少动态效果时不自动播放 */
  function initCarousel(box) {
    if (!once(box, 'bound')) return;
    var slides = $$('[data-slide]', box), dots = $$('[data-carousel-dot]', box);
    if (slides.length < 2) return;
    var cur = 0, timer = null, paused = reduce, hold = false;
    function show(i) {
      cur = (i + slides.length) % slides.length;
      slides.forEach(function (s, n) { var on = n === cur; s.classList.toggle('is-active', on); s.inert = !on; s.setAttribute('aria-hidden', String(!on)); });
      dots.forEach(function (d, n) { d.setAttribute('aria-current', String(n === cur)); });
    }
    function stop() { clearInterval(timer); timer = null; }
    function play() { stop(); if (!paused && !hold && box.isConnected) timer = setInterval(function () { if (!box.isConnected) return stop(); show(cur + 1); }, 6000); }
    var go = function (i) { show(i); play(); };
    var prev = box.querySelector('[data-carousel-prev]'), next = box.querySelector('[data-carousel-next]');
    if (prev) prev.addEventListener('click', function () { go(cur - 1); });
    if (next) next.addEventListener('click', function () { go(cur + 1); });
    dots.forEach(function (d, n) { d.addEventListener('click', function () { go(n); }); });
    box.addEventListener('mouseenter', function () { hold = true; stop(); });
    box.addEventListener('mouseleave', function () { hold = false; play(); });
    box.addEventListener('focusin', function () { hold = true; stop(); });
    box.addEventListener('focusout', function () { hold = false; play(); });
    box.addEventListener('keydown', function (e) { if (e.key === 'ArrowLeft') go(cur - 1); else if (e.key === 'ArrowRight') go(cur + 1); });
    var x0 = null;                                 // 触屏左右滑动
    box.addEventListener('touchstart', function (e) { x0 = e.touches[0].clientX; }, { passive: true });
    box.addEventListener('touchend', function (e) { if (x0 === null) return; var dx = e.changedTouches[0].clientX - x0; x0 = null; if (Math.abs(dx) > 48) go(cur + (dx < 0 ? 1 : -1)); }, { passive: true });
    document.addEventListener('visibilitychange', function () { if (document.hidden) stop(); else play(); });
    show(0); play();
  }

  /* 首页粒子背景与滚动入场：参数、类名与现有 main.js 相同 */
  function initParticles(el) {
    if (!once(el, 'bound') || reduce || typeof window.particlesJS !== 'function') return;
    window.particlesJS(el.id, {
      particles: { number: { value: 60, density: { enable: true, value_area: 800 } }, color: { value: '#7c4dff' }, shape: { type: 'circle' },
        opacity: { value: 0.5, random: false }, size: { value: 3, random: true },
        line_linked: { enable: true, distance: 150, color: '#7c4dff', opacity: 0.2, width: 1 },
        move: { enable: true, speed: 2, direction: 'none', random: false, straight: false, out_mode: 'out', bounce: false } },
      interactivity: { detect_on: 'canvas', events: { onhover: { enable: true, mode: 'grab' }, onclick: { enable: true, mode: 'push' }, resize: true },
        modes: { grab: { distance: 140, line_linked: { opacity: 0.8 } }, push: { particles_nb: 4 } } },
      retina_detect: true
    });
  }
  var reveal = 'IntersectionObserver' in window && !reduce ? new IntersectionObserver(function (entries) {
    entries.forEach(function (en) {
      if (!en.isIntersecting) return;
      en.target.classList.add('opacity-100', 'translate-y-0'); en.target.classList.remove('opacity-0', 'translate-y-10');
      reveal.unobserve(en.target);
    });
  }, { threshold: 0.1, rootMargin: '0px 0px -50px 0px' }) : null;
  function initReveal(el) {
    if (!reveal || !once(el, 'bound')) return;
    el.classList.add('opacity-0', 'translate-y-10', 'transition-all', 'duration-700', 'ease-out');
    reveal.observe(el);
  }

  /* 页内目录：点击时实时量页头高度再滚动；滚动时高亮「标题已越过页头下沿」的最后一节 */
  function initToc(toc) {
    if (!once(toc, 'bound')) return;
    var links = $$('a[href^="#"]', toc);
    var heads = links.map(function (a) { return document.getElementById(a.getAttribute('href').slice(1)); });
    var offset = function () { var nav = document.querySelector('[data-site-nav]'); return (nav ? nav.getBoundingClientRect().height : 0) + 20; };
    var mark = function (i) { links.forEach(function (a, n) { a.classList.toggle('is-active', n === i); }); };
    links.forEach(function (a, i) {
      a.addEventListener('click', function (e) {
        var h = heads[i]; if (!h) return;
        e.preventDefault();
        window.scrollTo({ top: h.getBoundingClientRect().top + window.scrollY - offset(), behavior: reduce ? 'auto' : 'smooth' });
        mark(i);
      });
    });
    var ticking = false;
    var onScroll = function () {
      if (ticking || !toc.isConnected) return;
      ticking = true;
      requestAnimationFrame(function () {
        ticking = false;
        var line = offset() + 4, cur = 0;
        heads.forEach(function (h, i) { if (h && h.getBoundingClientRect().top <= line) cur = i; });
        if (window.innerHeight + window.scrollY >= document.documentElement.scrollHeight - 2) cur = heads.length - 1;
        mark(cur);
      });
    };
    window.addEventListener('scroll', onScroll, { passive: true });
    onScroll();
  }

  /* 播放器：点击封面后才创建 <video>，不预加载 */
  function initPlayer(box) {
    if (!once(box, 'bound')) return;
    var btn = box.querySelector('[data-player-play]');
    if (!btn) return;
    btn.addEventListener('click', function () {
      var src = box.dataset.src;
      if (!src) { toast('本期视频暂不可播放，请稍后重试。'); return; }
      var v = document.createElement('video');
      v.src = src; v.controls = true; v.playsInline = true; v.preload = 'metadata';
      var img = box.querySelector('img'); if (img) v.poster = img.currentSrc || img.src;
      box.textContent = ''; box.appendChild(v);
      var p = v.play(); if (p && p.catch) p.catch(function () {});
    });
  }

  /* 浮层：<dialog>，点遮罩或关闭按钮关闭，关闭后回焦 */
  function initDialog(dlg) {
    if (!once(dlg, 'bound')) return;
    dlg.addEventListener('click', function (e) { if (e.target === dlg || e.target.closest('[data-dialog-close]')) dlg.close(); });
  }
  function initReportOpen(btn) {
    if (!once(btn, 'bound')) return;
    btn.addEventListener('click', function (e) {
      var dlg = document.getElementById('report-dialog');
      if (!dlg || !dlg.showModal) return;        // 不支持时按链接进入报告详情页
      e.preventDefault();
      dlg.querySelector('[data-report-name]').textContent = btn.dataset.reportName || dlg.dataset.defaultName || '领取报告';
      var sub = dlg.querySelector('[data-report-subtitle]'), subText = btn.dataset.reportSlug ? (btn.dataset.reportSubtitle || '') : (dlg.dataset.defaultSubtitle || '');
      sub.textContent = subText; sub.hidden = !subText;
      dlg.querySelector('[data-report-slug]').value = btn.dataset.reportSlug || dlg.dataset.defaultSlug || '';
      // 左侧封面：优先用触发按钮所属报告的封面，回落到最新报告封面；都没有则收起左栏
      var coverImg = dlg.querySelector('[data-report-cover-img]');
      var coverSrc = btn.dataset.reportCover || dlg.dataset.defaultCover || '';
      if (coverImg && coverSrc) {
        coverImg.src = coverSrc;
        coverImg.alt = btn.dataset.reportCoverAlt || dlg.dataset.defaultCoverAlt || '';
      }
      dlg.classList.toggle('has-cover', !!coverSrc);
      var st = dlg.querySelector('[data-form-status]'); if (st) { st.hidden = true; st.classList.remove('is-error'); }
      dlg.showModal();
      dlg.addEventListener('close', function back() { dlg.removeEventListener('close', back); btn.focus(); });
    });
  }

  /* 领取报告表单：姓名、手机号码、公司名称、职位、接收报告邮箱。失焦校验，错误文案说怎么改，提交时防重复 */
  var reportRules = {
    phone: function (v) { var d = v.replace(/[\s-]/g, ''); if (!/^\d*$/.test(d)) return '手机号只能是数字'; if (d.length !== 11) return '现在是 ' + d.length + ' 位，手机号需要 11 位'; return /^1[3-9]/.test(d) ? '' : '手机号应以 13–19 开头'; },
    email: function (v) { return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v) ? '' : '邮箱格式不对，例如 name@company.com'; }
  };
  function initReportForm(form) {
    if (!once(form, 'bound')) return;
    function check(input) {
      var v = input.value.trim(), msg = '';
      if (!v) msg = '这一项需要填写'; else if (reportRules[input.name]) msg = reportRules[input.name](v);
      var err = document.getElementById(input.getAttribute('aria-describedby'));
      input.setAttribute('aria-invalid', String(!!msg));
      if (err) { err.textContent = msg; err.hidden = !msg; }
      return !msg;
    }
    var inputs = $$('input[required]', form);
    inputs.forEach(function (i) { i.addEventListener('blur', function () { check(i); }); });
    form.addEventListener('submit', function (e) {
      e.preventDefault();
      if (form.website && form.website.value) return;            // 蜜罐
      var bad = inputs.filter(function (i) { return !check(i); });
      if (bad.length) { bad[0].focus(); return; }
      var btn = form.querySelector('[type="submit"]'), st = form.querySelector('[data-form-status]');
      btn.classList.add('is-loading'); btn.disabled = true;
      if (st) { st.hidden = true; st.classList.remove('is-error'); }
      function show(msg, isError) {
        btn.classList.remove('is-loading'); btn.disabled = false;
        if (!st) return;
        st.textContent = msg; st.hidden = false;
        st.classList.toggle('is-error', !!isError);
      }
      var data = {}; new FormData(form).forEach(function (v, k) { if (k !== 'website') data[k] = String(v).trim(); });
      data.sourcePage = location.pathname;                       // 从哪个页面提交，后台「报告领取记录」里显示
      fetch('/api/nqoc/reports/apply', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(data) })
        .then(function (r) { return r.json().catch(function () { return {}; }).then(function (body) { return { ok: r.ok, body: body || {} }; }); })
        .then(function (res) {
          var url = res.body.reportUrl;
          // 领取成功且拿到站内报告地址：关闭弹窗、清空表单，在当前标签页直接打开报告
          if (res.ok && typeof url === 'string' && url.indexOf('/api/nqoc/') === 0) {
            form.reset();
            var dlg = form.closest('dialog');
            if (dlg && dlg.open) dlg.close();
            location.href = url;
            return;
          }
          // 信息已提交，但报告文件还没准备好：关闭表单，用弹窗告知
          if (res.ok && (url === null || url === undefined || url === '')) {
            btn.classList.remove('is-loading'); btn.disabled = false;
            form.reset();
            var formDlg = form.closest('dialog');
            if (formDlg && formDlg.open) formDlg.close();
            var doneDlg = document.getElementById('report-result-dialog');
            if (doneDlg && doneDlg.showModal) {
              var doneMsg = doneDlg.querySelector('[data-result-message]');
              if (doneMsg) doneMsg.textContent = '信息已提交，报告文件还在准备中。完成后我们会第一时间发送到您填写的邮箱。';
              doneDlg.showModal();
            } else {
              show('信息已提交。报告文件还在准备中。', false);   // 极旧浏览器兜底
            }
            return;
          }
          // 其它任何情况都按失败处理：保留已填内容，不打开任何东西
          show(res.body.error || '提交失败，请稍后重试或联系项目组。', true);
        })
        .catch(function () { show('提交失败，请稍后重试或联系项目组。', true); });
    });
  }

  function scan() {
    initNav();
    $$('[data-carousel]').forEach(initCarousel);
    $$('[data-particles]').forEach(initParticles);
    $$('.animate-on-scroll').forEach(initReveal);
    $$('[data-toc]').forEach(initToc);
    $$('[data-player]').forEach(initPlayer);
    $$('[data-dialog]').forEach(initDialog);
    $$('[data-report-open]').forEach(initReportOpen);
    $$('[data-report-form]').forEach(initReportForm);
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', scan); else scan();
  document.addEventListener('preview:pagechange', scan);   // 单文件预览换页后重扫
})();
