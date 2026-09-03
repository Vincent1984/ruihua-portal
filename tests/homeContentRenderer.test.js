const { renderInsightCard, renderFaqItem, formatDateZh } = require('../utils/homeContentRenderer');

describe('homeContentRenderer', () => {
  test('formatDateZh should return yyyy-mm-dd', () => {
    expect(formatDateZh('2026-03-18T08:00:00.000Z')).toMatch(/^2026-\d{2}-\d{2}$/);
  });

  test('renderInsightCard should include article title and link', () => {
    const html = renderInsightCard({
      _id: 'a1',
      slug: 'test-article',
      title: '测试文章',
      summary: '测试摘要',
      category: 'insight',
      coverImage: '/images/test.jpg',
      publishDate: '2026-03-18T08:00:00.000Z'
    }, { insight: '研究洞察' });

    expect(html).toContain('/insights/test-article');
    expect(html).toContain('测试文章');
    expect(html).toContain('研究洞察');
  });

  test('renderFaqItem should render question and answer', () => {
    const html = renderFaqItem({
      question: '什么是HCVM？',
      answer: '这是核心方法论。'
    });

    expect(html).toContain('什么是HCVM？');
    expect(html).toContain('这是核心方法论。');
  });
});
