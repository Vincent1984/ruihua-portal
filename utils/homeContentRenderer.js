function escapeHtml(input) {
    return String(input || '')
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
}

function formatDateZh(dateInput) {
    const date = new Date(dateInput);
    if (Number.isNaN(date.getTime())) return '2025-01-01';
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
}

function getCategoryHue(category) {
    if (!category) return 240;
    let hash = 0;
    const text = String(category);
    for (let i = 0; i < text.length; i += 1) {
        hash = text.charCodeAt(i) + ((hash << 5) - hash);
    }
    const baseHues = [0, 60, 120, 180, 240, 300];
    return baseHues[Math.abs(hash) % baseHues.length];
}

function renderInsightCard(article, categoryMap = {}) {
    const id = article?._id ? String(article._id) : '';
    const link = article?.slug ? `/article/${article.slug}.html` : `/article.html?id=${id}`;
    const title = article?.title || '无标题';
    const summary = article?.summary || '暂无摘要';
    const cover = article?.coverImage || '/images/default-article.jpg';
    const categoryName = categoryMap[article?.category] || (article?.category || 'INSIGHT').toUpperCase();
    const publishDate = formatDateZh(article?.publishDate);
    const hue = getCategoryHue(article?.category || categoryName);

    return `
      <a href="${escapeHtml(link)}" class="bg-white rounded-2xl shadow-md border border-slate-100 overflow-hidden transition-all duration-300 hover:shadow-xl group flex flex-col h-full block cursor-pointer">
        <div class="relative w-full h-48 sm:h-56 overflow-hidden">
          <img src="${escapeHtml(cover)}" alt="${escapeHtml(title)}" class="w-full h-full object-cover transition-transform duration-700 group-hover:scale-105" loading="lazy" decoding="async" data-fallback="/images/default-article.jpg">
          <div class="absolute top-4 left-4 z-20">
            <span class="category-badge" style="--cat-hue: ${hue};">
              ${escapeHtml(categoryName)}
            </span>
          </div>
        </div>
        <div class="p-6 flex flex-col flex-grow">
          <h3 class="research-card-title font-bold text-slate-900 mb-3 group-hover:text-brand-600 transition-colors">
            ${escapeHtml(title)}
          </h3>
          <p class="research-card-desc text-slate-500 text-sm mb-6 flex-grow">
            ${escapeHtml(summary)}
          </p>
          <div class="flex justify-between items-center pt-4 mt-auto border-t border-slate-50">
            <span class="text-slate-400 text-xs font-medium tracking-wide">${escapeHtml(publishDate)}</span>
            <span class="inline-flex items-center text-brand-600 hover:text-brand-700 font-bold text-sm transition-colors group-hover:translate-x-1 duration-300">
              阅读文章
              <i class="fas fa-arrow-right ml-2 text-xs"></i>
            </span>
          </div>
        </div>
      </a>
    `;
}

function renderFaqItem(faq) {
    const question = faq?.question || '暂无问题';
    const answerText = faq?.answer || '暂无详细回答';
    return `
      <div class="faq-item border-b border-slate-100 pb-8 last:border-0 last:pb-0">
        <dt>
          <button class="faq-toggle-btn flex justify-between items-center w-full text-left font-bold text-xl text-slate-900 focus:outline-none group transition-colors duration-300 hover:text-brand-600" aria-expanded="false">
            <span class="pr-4">${escapeHtml(question)}</span>
            <i class="fas fa-chevron-down faq-icon text-slate-400 group-hover:text-brand-600 transition-transform duration-300"></i>
          </button>
        </dt>
        <dd class="faq-content overflow-hidden transition-all duration-300 ease-in-out" style="max-height: 0px; opacity: 0;">
          <div class="pt-4 text-slate-600 text-sm leading-relaxed" style="color: #475569;">
            <p>${escapeHtml(answerText)}</p>
          </div>
        </dd>
      </div>
    `;
}

module.exports = {
    renderInsightCard,
    renderFaqItem,
    getCategoryHue,
    formatDateZh,
    escapeHtml
};
