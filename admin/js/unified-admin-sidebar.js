(function (global) {
  const NAV_GROUPS = [
    {
      title: '总览',
      icon: 'bi-speedometer2',
      items: [
        { label: '数据看板', icon: 'bi-speedometer2', href: '/admin/dashboard.html' }
      ]
    },
    {
      title: '内容管理',
      icon: 'bi-house',
      items: [
        { label: 'Banner 管理', icon: 'bi-image', href: '/admin/dashboard.html', section: 'banner' },
        { label: 'FAQ 管理', icon: 'bi-question-circle', href: '/admin/dashboard.html', section: 'faq' },
        { label: '文章管理', icon: 'bi-file-text', href: '/admin/dashboard.html', section: 'article' },
        { label: '专家管理', icon: 'bi-people', href: '/admin/dashboard.html', section: 'authors' },
        { label: '侧边栏配置', icon: 'bi-layout-sidebar', href: '/admin/dashboard.html', section: 'sidebar' },
        { label: '视频管理', icon: 'bi-camera-reels', href: '/admin/video-management.html' }
      ]
    },
    {
      title: '线索与活动',
      icon: 'bi-database',
      items: [
        { label: '预约表单', icon: 'bi-list-check', href: '/admin/dashboard.html', section: 'appointments' },
        { label: '资源下载记录', icon: 'bi-file-earmark-arrow-down', href: '/admin/whitepaper-submissions.html' },
        { label: '诊断评测数据', icon: 'bi-bar-chart-steps', href: '/admin/maturity.html' },
        { label: '经营分析报告', icon: 'bi-graph-up-arrow', href: '/admin/efficiency.html' }
      ]
    },
    {
      title: '活动管理',
      icon: 'bi-calendar2-event',
      items: [
        { label: '报名模板管理', icon: 'bi-ui-checks-grid', href: '/admin/template-management.html' },
        { label: '活动报名管理', icon: 'bi-calendar2-event', href: '/admin/activity-management.html' }
      ]
    },
    {
      title: '系统设置',
      icon: 'bi-gear',
      items: [
        { label: '权限管理', icon: 'bi-shield-lock', href: '/admin/dashboard.html', section: 'permissions' },
        { label: '退出登录', icon: 'bi-box-arrow-right', href: '/admin/index.html', danger: true }
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

  function hasActiveItem(items) {
    return items.some(activeMatch);
  }

  function groupKey(title) {
    return title.toLowerCase().replace(/\s+/g, '_');
  }

  function buildSidebarHtml() {
    const groupsHtml = NAV_GROUPS.map(group => {
      const key = groupKey(group.title);
      const expanded = hasActiveItem(group.items);
      const items = group.items.map(itemHtml).join('');
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
    const sidebar = document.querySelector('.sidebar');
    if (!sidebar) return;
    sidebar.classList.add('u-admin-sidebar');
    sidebar.innerHTML = buildSidebarHtml();
    bindSectionJump(sidebar);
    bindCollapse(sidebar);
    bindGroupCollapse(sidebar);
  }

  function init() {
    if (typeof document === 'undefined') return;
    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', renderSidebar);
    else renderSidebar();
  }

  init();

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = { NAV_GROUPS };
  } else {
    global.__UNIFIED_ADMIN_NAV__ = { NAV_GROUPS };
  }
})(typeof window !== 'undefined' ? window : globalThis);
