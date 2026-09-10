/**
 * 样式诊断工具
 * 在浏览器控制台中运行此脚本，对比首页和 Demo 的样式差异
 */

(function() {
  console.log('🎨 FAQ 样式诊断工具');
  console.log('='.repeat(60));

  // 检查 FAQ 区域是否存在
  const faqSection = document.querySelector('.tl-sec.tl-faq');
  if (!faqSection) {
    console.error('❌ 未找到 FAQ 区域！');
    return;
  }
  console.log('✅ FAQ 区域存在');
  console.log('');

  // 1. 检查 CSS 变量
  console.log('📋 1. CSS 变量值');
  console.log('-'.repeat(60));
  const root = getComputedStyle(document.documentElement);
  const vars = {
    '--tl-card': root.getPropertyValue('--tl-card').trim(),
    '--tl-line': root.getPropertyValue('--tl-line').trim(),
    '--d-text': root.getPropertyValue('--d-text').trim(),
    '--d-sub': root.getPropertyValue('--d-sub').trim(),
    '--d-weak': root.getPropertyValue('--d-weak').trim(),
    '--purple': root.getPropertyValue('--purple').trim(),
    '--p-300': root.getPropertyValue('--p-300').trim(),
    '--ease': root.getPropertyValue('--ease').trim(),
    '--serif': root.getPropertyValue('--serif').trim(),
    '--sans': root.getPropertyValue('--sans').trim(),
    '--mono': root.getPropertyValue('--mono').trim(),
  };

  Object.entries(vars).forEach(([key, value]) => {
    const status = value ? '✅' : '❌';
    console.log(`${status} ${key}: ${value || '(未定义)'}`);
  });
  console.log('');

  // 2. 检查 FAQ Section 样式
  console.log('📋 2. FAQ Section 样式');
  console.log('-'.repeat(60));
  const sectionStyles = getComputedStyle(faqSection);
  console.log('背景颜色:', sectionStyles.backgroundColor);
  console.log('内边距:', sectionStyles.padding);
  console.log('外边距:', sectionStyles.margin);
  console.log('最大宽度:', sectionStyles.maxWidth);
  console.log('');

  // 3. 检查标题样式
  console.log('📋 3. FAQ 标题样式');
  console.log('-'.repeat(60));
  const h2 = faqSection.querySelector('h2');
  if (h2) {
    const h2Styles = getComputedStyle(h2);
    console.log('字体家族:', h2Styles.fontFamily);
    console.log('字体大小:', h2Styles.fontSize);
    console.log('字体粗细:', h2Styles.fontWeight);
    console.log('行高:', h2Styles.lineHeight);
    console.log('颜色:', h2Styles.color);
    console.log('外边距:', h2Styles.margin);
  } else {
    console.log('❌ 未找到标题元素');
  }
  console.log('');

  // 4. 检查副标题样式
  console.log('📋 4. FAQ 副标题样式');
  console.log('-'.repeat(60));
  const ld2 = faqSection.querySelector('.ld2');
  if (ld2) {
    const ld2Styles = getComputedStyle(ld2);
    console.log('字体大小:', ld2Styles.fontSize);
    console.log('行高:', ld2Styles.lineHeight);
    console.log('颜色:', ld2Styles.color);
    console.log('外边距:', ld2Styles.margin);
  } else {
    console.log('❌ 未找到副标题元素');
  }
  console.log('');

  // 5. 检查 FAQ 卡片样式
  console.log('📋 5. FAQ 卡片样式');
  console.log('-'.repeat(60));
  const faqItem = faqSection.querySelector('.faq-item');
  if (faqItem) {
    const itemStyles = getComputedStyle(faqItem);
    console.log('背景颜色:', itemStyles.backgroundColor);
    console.log('边框:', itemStyles.border);
    console.log('圆角:', itemStyles.borderRadius);
    console.log('内边距:', itemStyles.padding);
    console.log('外边距:', itemStyles.marginBottom);
    console.log('阴影:', itemStyles.boxShadow);
    console.log('过渡:', itemStyles.transition);
  } else {
    console.log('❌ 未找到 FAQ 卡片');
  }
  console.log('');

  // 6. 检查 FAQ summary 样式
  console.log('📋 6. FAQ Summary 样式');
  console.log('-'.repeat(60));
  const summary = faqSection.querySelector('.faq-item summary');
  if (summary) {
    const summaryStyles = getComputedStyle(summary);
    console.log('字体大小:', summaryStyles.fontSize);
    console.log('字体粗细:', summaryStyles.fontWeight);
    console.log('颜色:', summaryStyles.color);
    console.log('内边距:', summaryStyles.padding);
    console.log('display:', summaryStyles.display);
    console.log('justify-content:', summaryStyles.justifyContent);
    console.log('gap:', summaryStyles.gap);
  } else {
    console.log('❌ 未找到 summary 元素');
  }
  console.log('');

  // 7. 检查图标样式
  console.log('📋 7. FAQ 图标样式');
  console.log('-'.repeat(60));
  const icon = faqSection.querySelector('.faq-item summary .ic');
  if (icon) {
    const iconStyles = getComputedStyle(icon);
    console.log('颜色:', iconStyles.color);
    console.log('字体家族:', iconStyles.fontFamily);
    console.log('过渡:', iconStyles.transition);
  } else {
    console.log('❌ 未找到图标元素');
  }
  console.log('');

  // 8. 检查答案样式
  console.log('📋 8. FAQ 答案样式');
  console.log('-'.repeat(60));
  const answer = faqSection.querySelector('.faq-item .a');
  if (answer) {
    const answerStyles = getComputedStyle(answer);
    console.log('字体大小:', answerStyles.fontSize);
    console.log('颜色:', answerStyles.color);
    console.log('行高:', answerStyles.lineHeight);
    console.log('内边距:', answerStyles.padding);
    console.log('最大宽度:', answerStyles.maxWidth);
  } else {
    console.log('❌ 未找到答案元素');
  }
  console.log('');

  // 9. 测试 Hover 样式（模拟）
  console.log('📋 9. Hover 样式检查');
  console.log('-'.repeat(60));
  console.log('⚠️  请手动 hover 到 FAQ 卡片上，观察以下变化：');
  console.log('  1. 背景颜色是否变为淡紫色？');
  console.log('  2. 标题文字是否变为白色？');
  console.log('  3. 是否有紫色光晕阴影？');
  console.log('  4. 卡片是否向上浮动 3px？');
  console.log('');

  // 10. 检查 CSS 文件加载
  console.log('📋 10. CSS 文件加载检查');
  console.log('-'.repeat(60));
  const stylesheets = Array.from(document.styleSheets);
  const rhCSS = stylesheets.find(s => s.href && s.href.includes('rh2026.css'));
  if (rhCSS) {
    console.log('✅ rh2026.css 已加载');
    console.log('   URL:', rhCSS.href);
  } else {
    console.log('❌ rh2026.css 未加载');
  }
  console.log('');

  // 11. 检查 JavaScript 错误
  console.log('📋 11. JavaScript 检查');
  console.log('-'.repeat(60));
  console.log('请查看 Console 标签是否有红色错误信息');
  console.log('');

  // 12. 生成对比命令
  console.log('📋 12. 下一步诊断');
  console.log('-'.repeat(60));
  console.log('复制以下代码到 Demo 页面的控制台，对比结果：');
  console.log('');
  console.log('(async () => {');
  console.log('  const script = await fetch("file:///Users/nic/Documents/GitHub/ruihua-portal/tools/style-diagnostic.js");');
  console.log('  eval(await script.text());');
  console.log('})();');
  console.log('');
  console.log('✅ 诊断完成！');
})();
