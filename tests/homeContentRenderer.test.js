const {
  renderClientLogos,
  renderScenarioChips,
  CLIENT_LOGOS,
  SCENARIO_CHIPS
} = require('../utils/homeContentRenderer');

describe('homeContentRenderer', () => {
  test('renderClientLogos 输出全部客户名称并附带重复轨道', () => {
    const html = renderClientLogos();
    CLIENT_LOGOS.forEach(name => {
      expect(html).toContain(name);
    });
    expect(html).toContain('lw-chip');
    expect(html).toContain('lw-dup');
  });

  test('renderScenarioChips 输出场景标签与关键字', () => {
    const html = renderScenarioChips();
    SCENARIO_CHIPS.forEach(chip => {
      expect(html).toContain(`data-keyword="${chip.keyword}"`);
      expect(html).toContain(chip.text);
    });
  });

  test('导出的首页数据为非空数组', () => {
    expect(Array.isArray(CLIENT_LOGOS)).toBe(true);
    expect(CLIENT_LOGOS.length).toBeGreaterThan(0);
    expect(Array.isArray(SCENARIO_CHIPS)).toBe(true);
    expect(SCENARIO_CHIPS.length).toBeGreaterThan(0);
  });
});
