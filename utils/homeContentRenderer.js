/**
 * 首页内容服务端渲染器
 * 为 JS 动态内容提供 SSR 后备
 */

// 客户名称数据（与前端 rh2026.js 的 LW_HOME 保持一致）
const CLIENT_LOGOS = [
  '海尔智家', '伊利集团', 'TCL 实业', '中国银行', '招商银行', '万物云',
  '华住集团', '中兴通讯', '找钢网', '游族网络', '创梦天地', '茶颜悦色',
  '鸣鸣很忙', '慧算账', '联想开天', '鑫方盛集团'
];



// 场景标签数据
const SCENARIO_CHIPS = [
  { keyword: 'cost', icon: '💰', text: '降本增效' },
  { keyword: 'process', icon: '⚙️', text: '流程优化' },
  { keyword: 'customer', icon: '🤝', text: '客户体验' },
  { keyword: 'data', icon: '📊', text: '数据决策' },
  { keyword: 'innovation', icon: '💡', text: '业务创新' }
];


/**
 * 渲染客户名称 HTML（与前端 JS 渲染结构一致，供无 JS 爬虫读取）
 * @returns {string} HTML 字符串
 */
function renderClientLogos() {
  const one = CLIENT_LOGOS.map(name => `
    <span class="lw-chip"><span class="dot"></span>${name}</span>
  `).join('');
  return one + `<span class="lw-dup" style="display:contents">${one}</span>`;
}

/**
 * 渲染场景标签 HTML
 * @returns {string} HTML 字符串
 */
function renderScenarioChips() {
  return SCENARIO_CHIPS.map(chip => `
    <span class="chip" data-keyword="${chip.keyword}">
      <span class="chip-icon">${chip.icon}</span>
      <span class="chip-text">${chip.text}</span>
    </span>
  `).join('');
}

module.exports = {
  renderClientLogos,
  renderScenarioChips,
  CLIENT_LOGOS,
  SCENARIO_CHIPS
};
