(() => {
    if (window.RuihuaLeadTracking || location.pathname.startsWith('/admin')) return;
    const storageKey = 'rh_lead_visit_v1';
    const nativeFetch = window.fetch.bind(window);
    let saved;
    try { saved = JSON.parse(sessionStorage.getItem(storageKey)); } catch (_) {}
    if (!saved || Date.now() - saved.touched > 30 * 60000 || !/^[a-f0-9]{64}$/.test(saved.id || '')) {
        const bytes = crypto.getRandomValues(new Uint8Array(32));
        saved = { id: Array.from(bytes, byte => byte.toString(16).padStart(2, '0')).join(''), version: 0, events: [],
            landing_page: location.pathname, referrer: document.referrer, tags: {} };
        new URLSearchParams(location.search).forEach((value, key) => {
            if (/^utm_(source|medium|campaign|term|content)$/.test(key)) saved.tags[key] = value.slice(0, 500);
        });
    }
    function store() {
        saved.touched = Date.now();
        try { sessionStorage.setItem(storageKey, JSON.stringify(saved)); } catch (_) {}
    }
    function event(type, label = '', duration = 0) {
        saved.events.push({ id: crypto.randomUUID(), at: new Date().toISOString(), type, path: location.pathname,
            title: document.title.slice(0, 120), label: String(label).slice(0, 120), duration });
        saved.events = saved.events.slice(-200);
        saved.version++;
        store();
    }
    function flush() {
        store();
        const payload = JSON.stringify({ trackingId: saved.id, version: saved.version, events: saved.events });
        return nativeFetch('/api/lead-visits', { method: 'POST', headers: { 'Content-Type': 'application/json' },
            body: payload, keepalive: payload.length < 60000 }).catch(() => {});
    }
    function attribution() {
        return { ...saved.tags, trackingId: saved.id, landing_page: saved.landing_page, referrer: saved.referrer };
    }
    let activeSince = document.hidden ? 0 : Date.now(), activeMs = 0;
    function settle() {
        if (activeSince) activeMs += Date.now() - activeSince;
        activeSince = 0;
    }
    event('page');
    document.addEventListener('visibilitychange', () => {
        if (document.hidden) {
            settle();
            if (activeMs > 0) event('leave', '有效停留', Math.round(activeMs / 1000));
            activeMs = 0;
            void flush();
        } else activeSince = Date.now();
    });
    addEventListener('pagehide', () => {
        settle();
        if (activeMs > 0) event('leave', '页面离开', Math.round(activeMs / 1000));
        activeMs = 0;
        void flush();
    });
    const depths = new Set();
    addEventListener('scroll', () => {
        const height = document.documentElement.scrollHeight;
        if (height <= innerHeight) return;
        const progress = Math.min(100, Math.round((scrollY + innerHeight) / height * 100));
        for (const depth of [25, 50, 75, 100]) {
            if (progress >= depth && !depths.has(depth)) { depths.add(depth); event('scroll', '阅读深度 ' + depth + '%'); }
        }
    }, { passive: true });
    const nativeOpen = window.open;
    window.open = function (url, ...rest) {
        if (typeof url === 'string' && /\.pdf(?:[?#]|$)|\/reports?\/download|\/report-deliveries\//i.test(url)) {
            event('report_open', '打开报告链接');
            void flush();
        }
        return nativeOpen.call(this, url, ...rest);
    };
    const opened = new WeakSet();
    document.addEventListener('focusin', e => {
        const form = e.target.closest('form');
        if (form && !opened.has(form)) { opened.add(form); event('form_open', form.id || '表单'); }
    });
    document.addEventListener('click', e => {
        const node = e.target.closest('a,button,[role="button"]');
        if (!node) return;
        const text = (node.getAttribute('aria-label') || node.textContent || '').trim().slice(0, 80);
        const href = node.getAttribute('href') || '';
        event(node.hasAttribute('download') || /\/reports?\/download|\/report-deliveries\//i.test(href) ? 'report_download' : /\.pdf(?:[?#]|$)/i.test(href) ? 'report_open' : 'click', text);
        if (href && !href.startsWith('#')) void flush();
    }, { capture: true });
    document.addEventListener('submit', e => {
        event('form_submit', e.target.id || '表单');
        void flush();
    }, { capture: true });
    window.fetch = async function (input, init) {
        const url = new URL(typeof input === 'string' || input instanceof URL ? input : input.url, location.href);
        const own = url.origin === location.origin;
        const appointment = own && url.pathname === '/api/appointments/website';
        const formRequest = own && (appointment || /report.*(apply|request)|whitepaper.*(apply|request)/i.test(url.pathname));
        let options = init;
        if (appointment && typeof init?.body === 'string') {
            try {
                event('form_submit', '官网留资');
                options = { ...init, body: JSON.stringify({ ...JSON.parse(init.body), ...attribution() }) };
                void flush();
            } catch (_) {}
        }
        try {
            const response = await nativeFetch(input, options);
            if (formRequest) {
                event(response.ok ? 'form_success' : 'form_error', appointment ? '官网留资' : '报告申请');
                void flush();
            }
            if (own && /chat|agent/i.test(url.pathname) && init?.method?.toUpperCase() === 'POST') {
                event('ai', response.ok ? 'AI 对话' : 'AI 请求失败');
                void flush();
            }
            return response;
        } catch (error) {
            if (formRequest) { event('form_error', '请求失败'); void flush(); }
            throw error;
        }
    };
    window.RuihuaLeadTracking = { event, flush, attribution };
    setInterval(() => { if (!document.hidden) void flush(); }, 15000);
    void flush();
})();
