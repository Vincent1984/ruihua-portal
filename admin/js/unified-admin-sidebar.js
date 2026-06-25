(function (global) {
  const NAV_GROUPS = [
    {
      title: '总览',
      icon: 'bi-speedometer2',
      items: [
        { label: '数据看板', icon: 'bi-speedometer2', href: '/admin/dashboard.html', perm: 'dashboard:view' }
      ]
    },
    {
      title: '内容管理',
      icon: 'bi-house',
      items: [
        { label: 'Banner 管理', icon: 'bi-image', href: '/admin/dashboard.html', section: 'banner', perm: 'banner:manage' },
        { label: 'FAQ 管理', icon: 'bi-question-circle', href: '/admin/dashboard.html', section: 'faq', perm: 'faq:list' },
        { label: '文章管理', icon: 'bi-file-text', href: '/admin/dashboard.html', section: 'article', perm: 'article:list' },
        { label: '专家管理', icon: 'bi-people', href: '/admin/dashboard.html', section: 'authors', perm: 'article:list' },
        { label: '侧边栏配置', icon: 'bi-layout-sidebar', href: '/admin/dashboard.html', section: 'sidebar', perm: 'sidebar:manage' },
        { label: '视频管理', icon: 'bi-camera-reels', href: '/admin/video-management.html', perm: 'video:list' }
      ]
    },
    {
      title: '线索与活动',
      icon: 'bi-database',
      items: [
        { label: '预约表单', icon: 'bi-list-check', href: '/admin/dashboard.html', section: 'appointments', perm: 'appointment:list' },
        { label: '课程咨询', icon: 'bi-mortarboard', href: '/admin/training-applications.html', perm: 'appointment:list' },
        { label: '调研问卷', icon: 'bi-clipboard-data', href: '/admin/survey.html', i18nKey: 'nav.survey', perm: 'appointment:list' },
        { label: '资源下载记录', icon: 'bi-file-earmark-arrow-down', href: '/admin/whitepaper-submissions.html', perm: 'appointment:list' },
        { label: '诊断评测数据', icon: 'bi-bar-chart-steps', href: '/admin/maturity.html', perm: 'appointment:list' },
        { label: '经营分析报告', icon: 'bi-graph-up-arrow', href: '/admin/efficiency.html', perm: 'appointment:list' }
      ]
    },
    {
      title: '新质组织',
      icon: 'bi-stars',
      items: [
        { label: '申报数据', icon: 'bi-trophy', href: '/admin/nqoc-awards.html', perm: ['nqoc:list', 'nqoc:manage'] },
        { label: '调研问卷', icon: 'bi-clipboard-data', href: '/admin/nqoc-survey.html', perm: ['nqoc:list', 'nqoc:manage'] },
        { label: '在线投票', icon: 'bi-bar-chart-steps', href: '/admin/nqoc-debate.html', perm: ['nqoc:list', 'nqoc:manage'] },
        { label: '专家申请', icon: 'bi-person-check', href: '/admin/nqoc-experts.html', perm: ['nqoc:list', 'nqoc:manage'] },
        { label: '白皮书', icon: 'bi-file-earmark-text', href: '/admin/nqoc-whitepaper.html', perm: ['nqoc:list', 'nqoc:manage'] }
      ]
    },
    {
      title: '活动管理',
      icon: 'bi-calendar2-event',
      items: [
        { label: '报名模板管理', icon: 'bi-ui-checks-grid', href: '/admin/template-management.html', perm: 'appointment:list' },
        { label: '活动报名管理', icon: 'bi-calendar2-event', href: '/admin/activity-management.html', perm: 'appointment:list' }
      ]
    },
    {
      title: 'SEO优化',
      icon: 'bi-search',
      items: [
        { label: 'TDK管理', icon: 'bi-search', href: '/admin/dashboard.html', section: 'seo', perm: 'system:manage' }
      ]
    },
    {
      title: '系统设置',
      icon: 'bi-gear',
      items: [
        { label: '权限管理', icon: 'bi-shield-lock', href: '/admin/dashboard.html', section: 'permissions', perm: 'all' },
        { label: '退出登录', icon: 'bi-box-arrow-right', href: '/admin/index.html?logout=1', danger: true }
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

  function groupKey(title) {
    return title.toLowerCase().replace(/\s+/g, '_');
  }

  function buildSidebarHtml() {
    const permSet = getCurrentUserPermissions();
    const groupsHtml = NAV_GROUPS.map(group => {
      const key = groupKey(group.title);
      const visibleItems = group.items.filter(item => canSeeItem(item, permSet));
      if (visibleItems.length === 0) return '';
      const expanded = hasActiveItem(visibleItems);
      const items = visibleItems.map(itemHtml).join('');
      return `<div class="u-nav-group" data-group-key="${key}">
        <button type="button" class="u-nav-header${expanded ? ' expanded' : ''}">
          <span class="u-header-main"><i class="bi ${group.icon || 'bi-folder'}"></i><span class="u-header-label">${group.title}</span></span>
          <i class="bi bi-chevron-right u-header-arrow"></i>
        </button>
        <div class="u-nav-items${expanded ? ' expanded' : ''}">${items}</div>
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
      const shouldExpand = persisted[gk] !== undefined ? !!persisted[gk] : hasActive;
      if (shouldExpand) {
        header.classList.add('expanded');
        list.classList.add('expanded');
      } else {
        header.classList.remove('expanded');
        list.classList.remove('expanded');
      }
      header.addEventListener('click', () => {
        const next = !list.classList.contains('expanded');
        list.classList.toggle('expanded', next);
        header.classList.toggle('expanded', next);
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
    module.exports = { NAV_GROUPS };
  } else {
    global.__UNIFIED_ADMIN_NAV__ = { NAV_GROUPS };
  }
})(typeof window !== 'undefined' ? window : globalThis);
