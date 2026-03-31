const fs = require('fs');
const path = require('path');
const { NAV_GROUPS } = require('../admin/js/unified-admin-sidebar.js');

describe('unified admin sidebar', () => {
  test('nav labels are unique and links are valid', () => {
    const labels = [];
    NAV_GROUPS.forEach(group => {
      expect(group.title).toBeTruthy();
      group.items.forEach(item => {
        expect(item.label).toBeTruthy();
        expect(item.href.startsWith('/admin/')).toBe(true);
        labels.push(item.label);
      });
    });
    const uniq = new Set(labels);
    expect(uniq.size).toBe(labels.length);
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
