(function (global) {
  const ICONS = {
    operations: '<svg class="u-nav-icon" viewBox="0 0 20 20" aria-hidden="true"><path d="M3 5.5A2.5 2.5 0 0 1 5.5 3h9A2.5 2.5 0 0 1 17 5.5v9a2.5 2.5 0 0 1-2.5 2.5h-9A2.5 2.5 0 0 1 3 14.5z"/><path d="M6.5 7.5h7M6.5 10.5h7M6.5 13.5h4"/></svg>',
    nqoc: '<svg class="u-nav-icon" viewBox="0 0 20 20" aria-hidden="true"><path d="m10 2.8 2.2 4.5 5 .7-3.6 3.5.85 4.95L10 14.1l-4.45 2.35.85-4.95L2.8 8l5-.7z"/></svg>',
    settings: '<svg class="u-nav-icon" viewBox="0 0 20 20" aria-hidden="true"><circle cx="10" cy="10" r="2.6"/><path d="M10 2.6v1.7M10 15.7v1.7M17.4 10h-1.7M4.3 10H2.6M15.2 4.8 14 6M6 14l-1.2 1.2M15.2 15.2 14 14M6 6 4.8 4.8"/></svg>'
  };

  const NAV_GROUPS = [
    {
      title: '官网运营',
      icon: ICONS.operations,
      items: [
        { label: '线索管理', href: '/admin/console.html#leads', perm: ['lead:list', 'appointment:list'] },
        { label: '文章管理', href: '/admin/console.html#articles', perm: 'article:list' },
        { label: '案例管理', href: '/admin/console.html#cases', perm: 'case:list' },
        { label: '首页精选案例', href: '/admin/console.html#featured', perm: 'featured-case:list' },
        { label: 'FAQ 管理', href: '/admin/console.html#faq', perm: 'faq:list' },
        { label: '讲师 / 专家团队', href: '/admin/console.html#experts', perm: 'expert:list' }
      ]
    },
    {
      title: '新质组织',
      key: 'nqoc',
      icon: ICONS.nqoc,
      items: [
        { label: '申报数据', href: '/admin/nqoc-awards.html', perm: ['nqoc:list', 'nqoc:manage'] },
        { label: '调研问卷', href: '/admin/nqoc-survey.html', perm: ['nqoc:list', 'nqoc:manage'] },
        { label: '在线投票', href: '/admin/nqoc-debate.html', perm: ['nqoc:list', 'nqoc:manage'] },
        { label: '专家申请', href: '/admin/nqoc-experts.html', perm: ['nqoc:list', 'nqoc:manage'] },
        { label: '白皮书', href: '/admin/nqoc-whitepaper.html', perm: ['nqoc:list', 'nqoc:manage'] }
      ]
    },
    {
      title: '系统全局配置',
      icon: ICONS.settings,
      items: [
        { label: '全局配置', href: '/admin/console.html#settings', perm: 'system:manage' },
        { label: '退出登录', href: '/admin/index.html?logout=1', danger: true }
      ]
    }
  ];

  function currentPath() {
    return (global.location && global.location.pathname) || '';
  }

  function activeMatch(item) {
    const path = currentPath();
    const sec = sessionStorage.getItem('lastSection') || '';
    if (item.section) {
      return path === '/admin/dashboard.html' && sec === item.section;
    }
    if (item.href === '/admin/dashboard.html') {
      return path === '/admin/dashboard.html' && !sec;
    }
    return path === item.href;
  }

  function itemHtml(item) {
    const active = activeMatch(item) ? ' active' : '';
    const danger = item.danger ? ' danger' : '';
    const sec = item.section ? ` data-section="${item.section}"` : '';
    return `<a class="u-sub-menu-item${active}${danger}" href="${item.href}"${sec}>${item.label}</a>`;
  }

  function getCurrentUserPermissions() {
    try {
      const raw = sessionStorage.getItem('user') || localStorage.getItem('adminUser') || '';
      if (!raw) return new Set();
      const user = JSON.parse(raw);
      const perms = Array.isArray(user.permissions) ? user.permissions : [];
      return new Set(perms);
    } catch (e) {
      return new Set();
    }
  }

  function canSeeItem(item, permSet) {
    // Super admins see everything
    if (permSet.has('all')) return true;
    // Danger items (e.g., 退出登录) always visible
    if (item.danger) return true;
    // Items without explicit perm require admin ('all') access
    if (!item.perm) return false;
    const perms = Array.isArray(item.perm) ? item.perm : [item.perm];
    return perms.some(perm => permSet.has(perm));
  }

  function hasActiveItem(items) {
    return items.some(activeMatch);
  }

  function groupKey(group) {
    return group.key || group.title.toLowerCase().replace(/\s+/g, '_');
  }

  function persistedGroups() {
    try {
      return JSON.parse(localStorage.getItem('adminSidebarGroups') || '{}') || {};
    } catch (e) {
      return {};
    }
  }

  function buildSidebarHtml() {
    const permSet = getCurrentUserPermissions();
    const persisted = persistedGroups();
    const groupsHtml = NAV_GROUPS.map(group => {
      const key = groupKey(group);
      const visibleItems = group.items.filter(item => canSeeItem(item, permSet));
      if (visibleItems.length === 0) return '';
      const expanded = persisted[key] !== undefined ? !!persisted[key] : key === 'nqoc' ? false : hasActiveItem(visibleItems);
      const items = visibleItems.map(itemHtml).join('');
      return `<div class="u-nav-group" data-group-key="${key}">
        <button type="button" class="u-nav-header${expanded ? ' expanded' : ''}" aria-expanded="${expanded}" aria-controls="u-nav-items-${key}">
          <span class="u-header-main">${group.icon}<span class="u-header-label">${group.title}</span></span>
          <svg class="u-header-arrow" viewBox="0 0 12 12" aria-hidden="true"><path d="m4 2 4 4-4 4"/></svg>
        </button>
        <div class="u-nav-items${expanded ? ' expanded' : ''}" id="u-nav-items-${key}">${items}</div>
      </div>`;
    }).join('');
    return `<div class="u-sidebar-header"><i class="bi bi-grid-1x2-fill"></i><span>CMS 系统</span><button type="button" class="u-sidebar-collapse-btn" id="uSidebarCollapseBtn"><i class="bi bi-layout-sidebar-inset"></i></button></div><div class="u-sidebar-menu">${groupsHtml}</div>`;
  }

  function bindSectionJump(root) {
    root.querySelectorAll('[data-section]').forEach(a => {
      a.addEventListener('click', () => {
        const sec = a.getAttribute('data-section');
        if (sec) sessionStorage.setItem('lastSection', sec);
      });
    });
  }

  function applyCollapsed(sidebar, collapsed) {
    if (collapsed) sidebar.classList.add('collapsed');
    else sidebar.classList.remove('collapsed');
  }

  function bindCollapse(sidebar) {
    const key = 'adminSidebarCollapsed';
    applyCollapsed(sidebar, localStorage.getItem(key) === '1');
    const btn = sidebar.querySelector('#uSidebarCollapseBtn');
    if (!btn) return;
    btn.addEventListener('click', () => {
      const next = !sidebar.classList.contains('collapsed');
      applyCollapsed(sidebar, next);
      localStorage.setItem(key, next ? '1' : '0');
    });
  }

  function bindGroupCollapse(sidebar) {
    const key = 'adminSidebarGroups';
    let persisted = {};
    try {
      persisted = JSON.parse(localStorage.getItem(key) || '{}') || {};
    } catch (e) {
      persisted = {};
    }
    sidebar.querySelectorAll('.u-nav-group').forEach(group => {
      const gk = group.getAttribute('data-group-key');
      const header = group.querySelector('.u-nav-header');
      const list = group.querySelector('.u-nav-items');
      const hasActive = !!group.querySelector('.u-sub-menu-item.active');
      const shouldExpand = persisted[gk] !== undefined ? !!persisted[gk] : gk === 'nqoc' ? false : hasActive;
      if (shouldExpand) {
        header.classList.add('expanded');
        list.classList.add('expanded');
      } else {
        header.classList.remove('expanded');
        list.classList.remove('expanded');
      }
      header.setAttribute('aria-expanded', String(shouldExpand));
      header.addEventListener('click', () => {
        const next = !list.classList.contains('expanded');
        list.classList.toggle('expanded', next);
        header.classList.toggle('expanded', next);
        header.setAttribute('aria-expanded', String(next));
        persisted[gk] = next;
        localStorage.setItem(key, JSON.stringify(persisted));
      });
    });
  }

  function renderSidebar() {
    const path = currentPath();
    if (!path.startsWith('/admin/') || path === '/admin/index.html') return;
    const sidebar = document.querySelector('.sidebar') || document.querySelector('#unified-sidebar-container');
    if (!sidebar) return;
    sidebar.classList.add('u-admin-sidebar', 'sidebar');
    sidebar.innerHTML = buildSidebarHtml();
    bindSectionJump(sidebar);
    bindCollapse(sidebar);
    bindGroupCollapse(sidebar);
  }

  async function refreshCurrentUserPermissions() {
    if (typeof fetch !== 'function') return;
    try {
      const token = localStorage.getItem('adminToken') || sessionStorage.getItem('adminToken') || '';
      const headers = token ? { Authorization: `Bearer ${token}` } : {};
      const res = await fetch('/api/auth/verify', { headers, credentials: 'same-origin' });
      if (!res.ok) return;
      const data = await res.json();
      if (!data || !data.success || !data.user) return;
      sessionStorage.setItem('user', JSON.stringify(data.user));
      localStorage.setItem('adminUser', JSON.stringify(data.user));
    } catch (e) {
      // Use the cached permissions if the refresh fails.
    }
  }

  function init() {
    if (typeof document === 'undefined') return;
    const start = () => refreshCurrentUserPermissions().finally(renderSidebar);
    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start);
    else start();
  }

  init();

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = { NAV_GROUPS, buildSidebarHtml };
  } else {
    global.__UNIFIED_ADMIN_NAV__ = { NAV_GROUPS };
  }
})(typeof window !== 'undefined' ? window : globalThis);
