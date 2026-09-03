const fs = require('fs');
const path = require('path');
const { NAV_GROUPS, buildSidebarHtml } = require('../admin/js/unified-admin-sidebar.js');

describe('unified admin sidebar', () => {
  test('sidebar layout is locked against legacy page styles', () => {
    const css = fs.readFileSync(path.join(__dirname, '../admin/admin-sidebar.css'), 'utf8');
    expect(css).toMatch(/\.u-admin-sidebar\s*\{[^}]*position:\s*sticky/s);
    expect(css).toMatch(/\.u-admin-sidebar\s*\{[^}]*display:\s*flex/s);
    expect(css).toMatch(/\.u-sidebar-menu\s*\{[^}]*flex:\s*1/s);
    expect(css).toMatch(/scrollbar-width:\s*thin/);
  });

  test('只保留官网运营、新质组织和系统全局配置导航组', () => {
    expect(NAV_GROUPS.map(group => group.title)).toEqual(['官网运营', '新质组织', '系统全局配置']);
    expect(NAV_GROUPS.find(group => group.title === '系统全局配置').items.map(item => item.label)).toEqual(['全局配置', '退出登录']);
  });

  test('nav labels are unique within each group and links are valid', () => {
    NAV_GROUPS.forEach(group => {
      expect(group.title).toBeTruthy();
      expect(group.icon).toMatch(/^<svg class="u-nav-icon"/);
      const labels = group.items.map(item => {
        expect(item.label).toBeTruthy();
        expect(item.href.startsWith('/admin/')).toBe(true);
        return item.label;
      });
      expect(new Set(labels).size).toBe(labels.length);
    });
  });

  test('新质组织默认收起并由标题按钮控制五项', () => {
    global.sessionStorage = { getItem: key => key === 'user' ? JSON.stringify({ permissions: ['all'] }) : '' };
    global.localStorage = { getItem: key => key === 'adminSidebarGroups' ? JSON.stringify({ nqoc: false }) : '' };
    global.location = { pathname: '/admin/console.html' };
    const html = buildSidebarHtml();
    const nqoc = html.match(/<div class="u-nav-group" data-group-key="nqoc">[\s\S]*?<\/div>\s*<\/div>/)[0];

    expect(nqoc).toMatch(/<button[^>]+class="u-nav-header"[^>]+aria-expanded="false"/);
    expect(nqoc).toMatch(/<svg class="u-header-arrow"/);
    expect(nqoc).not.toMatch(/u-nav-items expanded/);
    expect((nqoc.match(/u-sub-menu-item/g) || [])).toHaveLength(5);
  });

  test('admin pages include unified sidebar assets', () => {
    const files = [
      'video-management.html',
      'whitepaper-submissions.html',
      'maturity.html',
      'efficiency.html',
      'activity-management.html',
      'template-management.html'
    ];
    files.forEach(file => {
      const abs = path.join(__dirname, '..', 'admin', file);
      const html = fs.readFileSync(abs, 'utf8');
      expect(html.includes('/admin/admin-sidebar.css')).toBe(true);
      expect(html.includes('/admin/js/unified-admin-sidebar.js')).toBe(true);
    });
  });
});
