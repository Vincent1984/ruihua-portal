// ========== Request Queue & Retry Logic - REMOVED ==========
// Simplified fetch wrapper
async function fetchWithRetry(url, options = {}) {
    return fetch(url, options);
}

// ========== 移动端菜单控制 ==========
function toggleMobileMenu() {
  const menu = document.getElementById('mobileMenu');
  const btn = document.querySelector('button[onclick="toggleMobileMenu()"]');
  
  if (menu) {
    const isHidden = menu.classList.contains('hidden');
    
    if (isHidden) {
      menu.classList.remove('hidden');
      menu.classList.add('flex');
      // 简单的淡入动画
      menu.style.opacity = '0';
      requestAnimationFrame(() => {
        menu.style.transition = 'opacity 0.3s ease';
        menu.style.opacity = '1';
      });
    } else {
      menu.style.opacity = '0';
      setTimeout(() => {
        menu.classList.remove('flex');
        menu.classList.add('hidden');
      }, 300); // 等待过渡结束
    }
  }

  // 图标切换反馈
  if (btn) {
    const icon = btn.querySelector('i');
    if (icon) {
      // 添加旋转动画类
      icon.style.transition = 'transform 0.3s ease';
      
      if (menu && !menu.classList.contains('hidden')) {
        // 展开状态
        icon.classList.remove('fa-bars');
        icon.classList.add('fa-times');
        icon.style.transform = 'rotate(90deg)';
      } else {
        // 收起状态
        icon.classList.remove('fa-times');
        icon.classList.add('fa-bars');
        icon.style.transform = 'rotate(0deg)';
      }
    }
  }
}

// ========== 平滑滚动 ==========
function smoothScroll(element) {
  element.addEventListener('click', function(e) {
    e.preventDefault();
    const targetId = this.getAttribute('href');
    const targetElement = document.querySelector(targetId);
    if (targetElement) {
      window.scrollTo({
        top: targetElement.offsetTop - 80,
        behavior: 'smooth'
      });
    }
  });
}

// ========== FAQ 手风琴 ==========
// 使用事件委托处理所有FAQ点击（包括静态和动态加载的）
document.addEventListener('click', function(e) {
    // 查找最近的 .faq-toggle-btn 元素
    const button = e.target.closest('.faq-toggle-btn');
    if (!button) return;

    // 确保点击的是 FAQ 列表内的按钮
    const faqList = button.closest('#faq-list');
    if (!faqList) return;

    e.preventDefault();
    console.log('FAQ clicked via delegation:', button);

    try {
        const item = button.closest('.faq-item');
        if (!item) return;

        const content = item.querySelector('.faq-content');
        const icon = item.querySelector('.faq-icon');
        if (!content) return;

        // Determine current state
        const isOpen = button.getAttribute('aria-expanded') === 'true' || content.classList.contains('active');

        // Close all others in the same list
        faqList.querySelectorAll('.faq-item').forEach(el => {
            if (el !== item) {
                const btn = el.querySelector('.faq-toggle-btn');
                const c = el.querySelector('.faq-content');
                const i = el.querySelector('.faq-icon');
                if (btn) btn.setAttribute('aria-expanded', 'false');
                if (c) {
                    c.style.maxHeight = '0px';
                    c.style.opacity = '0';
                    c.classList.remove('active');
                }
                if (i) i.classList.remove('rotate');
            }
        });

        // Toggle current
        if (isOpen) {
            button.setAttribute('aria-expanded', 'false');
            content.style.maxHeight = '0px';
            content.style.opacity = '0';
            content.classList.remove('active');
            if (icon) icon.classList.remove('rotate');
        } else {
            button.setAttribute('aria-expanded', 'true');
            content.classList.add('active');
            content.style.opacity = '1';
            // Force height calculation with fallback
            const height = content.scrollHeight > 10 ? content.scrollHeight : 500;
            content.style.maxHeight = height + 'px';
            if (icon) icon.classList.add('rotate');
        }
    } catch (error) {
        console.error('Error in FAQ toggle:', error);
    }
});

// Global category cache
let globalCategoryMap = null;

async function ensureCategoryMap() {
  if (globalCategoryMap) return globalCategoryMap;
  try {
    const res = await fetchWithRetry('/api/categories');
    if (!res.ok) throw new Error('Failed to fetch categories');
    const categories = await res.json();
    globalCategoryMap = {};
    if (Array.isArray(categories)) {
      categories.forEach(cat => {
        globalCategoryMap[cat.code] = cat.name;
      });
    }
    return globalCategoryMap;
  } catch (e) {
    console.error('Error fetching categories:', e);
    return {}; // Return empty object on error
  }
}

// Helper to generate consistent hues for categories
function getCategoryHue(category) {
  if (!category) return 240; // Default Blue

  // Simple hash for consistency
  let hash = 0;
  const str = String(category);
  for (let i = 0; i < str.length; i++) {
    hash = str.charCodeAt(i) + ((hash << 5) - hash);
  }
  
  // 6 Base Hues (0, 60, 120, 180, 240, 300)
  const baseHues = [0, 60, 120, 180, 240, 300];
  const index = Math.abs(hash) % baseHues.length;
  return baseHues[index];
}

// ========== 研究中心内容加载 ==========
async function loadResearchInsights() {
  console.log('开始加载研究中心内容...');
  const container = document.getElementById('insights-container');
  
  if (!container) {
    return;
  }
  
  // Save static content for fallback
  const staticContent = container.innerHTML;

  // Ensure we have category names
  await ensureCategoryMap();
  
  container.innerHTML = `
    <div class="col-span-full flex justify-center items-center p-12">
      <div class="text-center">
        <div class="inline-block w-8 h-8 border-4 border-brand-500 border-t-transparent rounded-full animate-spin mb-4"></div>
        <p class="text-slate-600">加载中...</p>
      </div>
    </div>
  `;
  
  try {
    console.log('正在请求API: /api/articles?featured=true');
    // Set a timeout for the fetch to avoid hanging indefinitely
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 5000);

    const response = await fetchWithRetry('/api/articles?featured=true', { signal: controller.signal });
    clearTimeout(timeoutId);

    console.log('文章API响应状态:', response.status);
    
    if (!response.ok) {
      throw new Error(`API响应失败: ${response.status}`);
    }
    
    const articles = await response.json();
    console.log('获取到的文章数据:', articles);
    
    if (!Array.isArray(articles) || articles.length === 0) {
       // If no data, revert to static content (or show empty state if no static content)
       if (staticContent && staticContent.trim().length > 0) {
           console.log('API返回空数组，恢复静态内容');
           container.innerHTML = staticContent;
       } else {
          container.innerHTML = `
            <div class="col-span-full flex flex-col justify-center items-center p-12">
              <p>暂无研究文章</p>
              <button onclick="loadResearchInsights()" class="mt-4 px-4 py-2 bg-blue-500 text-white rounded-md hover:bg-blue-600">
                重试
              </button>
            </div>
          `;
       }
      return;
    }
    
    container.innerHTML = '';
    
    articles.forEach(article => {
      if (!article || !article._id) {
        console.warn('跳过无效文章对象:', article);
        return;
      }
      
      const link = article.slug ? `/article/${article.slug}.html` : `/article.html?id=${article._id}`;
      const card = document.createElement('a');
      card.href = link;
      // 优化后的卡片样式，完全匹配设计图
      card.className = 'bg-white rounded-2xl shadow-md border border-slate-100 overflow-hidden transition-all duration-300 hover:shadow-xl group flex flex-col h-full block cursor-pointer';
      
      const publishDate = article.publishDate ? new Date(article.publishDate).toLocaleDateString('zh-CN', {
        year: 'numeric',
        month: '2-digit',
        day: '2-digit'
      }).replace(/\//g, '-') : '2025-01-01'; // 格式化为 YYYY-MM-DD
      
      const cover = article.coverImage || `https://picsum.photos/seed/${article.slug || article._id}/600/400`;
      
      // Get category name from map or fallback to code
      let categoryName = article.category;
      if (globalCategoryMap && globalCategoryMap[article.category]) {
        categoryName = globalCategoryMap[article.category];
      } else {
         // Fallback for unmapped codes (e.g. if map failed)
         categoryName = (article.category || 'INSIGHT').toUpperCase();
      }

      const hue = getCategoryHue(article.category || categoryName);
      
      card.innerHTML = `
        <div class="relative w-full h-48 sm:h-56 overflow-hidden">
          <img src="${cover}" alt="${article.title || '研究文章图片'}" class="w-full h-full object-cover transition-transform duration-700 group-hover:scale-105">
          <!-- 标签悬浮在图片左上角 -->
          <div class="absolute top-4 left-4 z-20">
            <span class="category-badge" style="--cat-hue: ${hue};">
              ${categoryName}
            </span>
          </div>
        </div>
        
        <div class="p-6 flex flex-col flex-grow">
          <h3 class="research-card-title font-bold text-slate-900 mb-3 group-hover:text-brand-600 transition-colors">
            ${article.title || '无标题'}
          </h3>
          
          <p class="research-card-desc text-slate-500 text-sm mb-6 flex-grow">
            ${article.summary || '暂无摘要'}
          </p>
          
          <div class="flex justify-between items-center pt-4 mt-auto border-t border-slate-50">
            <span class="text-slate-400 text-xs font-medium tracking-wide">${publishDate}</span>
            <span class="inline-flex items-center text-brand-600 hover:text-brand-700 font-bold text-sm transition-colors group-hover:translate-x-1 duration-300">
              阅读文章
              <i class="fas fa-arrow-right ml-2 text-xs"></i>
            </span>
          </div>
        </div>
      `;
      
      container.appendChild(card);
    });
    
    console.log('研究中心内容加载成功');
  } catch (error) {
    console.error('加载研究文章失败:', error);
    // 恢复静态卡片作为备用
    if (staticContent) {
        container.innerHTML = staticContent;
    } else {
        container.innerHTML = '<p class="text-center p-4">加载失败，请刷新重试</p>';
    }
  }
}

// ========== FAQ内容加载 ==========
async function loadFaqData() {
  console.log('开始加载FAQ内容...');
  const container = document.getElementById('faq-list');
  
  if (!container) {
    console.error('FAQ容器未找到');
    return;
  }
  
  // Save static content
  const staticContent = container.innerHTML;

  try {
    // Set a timeout for the fetch
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 5000);

    const res = await fetch('/api/faqs?limit=5', { signal: controller.signal });
    clearTimeout(timeoutId);

    if (!res.ok) throw new Error('Failed to fetch FAQs');
    const faqs = await res.json();
    console.log('FAQ数据:', faqs); // Debug log
    
    if (faqs.length === 0) {
        // Keep static fallback if no data
        return;
    }

    container.innerHTML = '';
    
    faqs.forEach(faq => {
        const div = document.createElement('div');
        div.className = 'faq-item border-b border-slate-100 pb-8 last:border-0 last:pb-0';
        
        // Check for answer content and provide fallback
        const answerText = faq.answer || '暂无详细回答';
        
        div.innerHTML = `
            <button class="faq-toggle-btn flex justify-between items-center w-full text-left font-bold text-xl text-slate-900 focus:outline-none group transition-colors duration-300 hover:text-brand-600" aria-expanded="false">
                <span class="pr-4">${faq.question}</span>
                <i class="fas fa-chevron-down faq-icon text-slate-400 group-hover:text-brand-600 transition-transform duration-300"></i>
            </button>
            <div class="faq-content overflow-hidden transition-all duration-300 ease-in-out" style="max-height: 0px; opacity: 0;">
                <div class="pt-4 text-slate-600 text-sm leading-relaxed" style="color: #475569;">
                    <p>${answerText}</p>
                </div>
            </div>
        `;
        container.appendChild(div);
    });
    
  } catch (error) {
    console.error('Error loading FAQs:', error);
    // If we cleared content (we didn't yet), restore it.
    // Since we only clear content AFTER successful fetch check, we are fine.
    // But if we wanted to show loading state, we would need restoration logic.
    // Here we just silently fail and keep static content.
  }
}

// ========== Success Stories Tab Switching ==========
function switchTab(tabIndex) {
  try {
    console.log(`Switching to tab ${tabIndex}`);
    
    // 1. Update Buttons
    const buttons = document.querySelectorAll('.tab-btn');
    if (!buttons.length) {
      console.warn('No tab buttons found');
      return;
    }

    buttons.forEach(btn => {
      // Reset all buttons to inactive state
      btn.classList.remove('active', 'bg-brand-600', 'text-white', 'shadow-lg');
      btn.classList.add('text-slate-400', 'hover:text-white');
      btn.setAttribute('aria-selected', 'false');
    });

    const activeBtn = document.getElementById(`tab-${tabIndex}-btn`);
    if (activeBtn) {
      // Set active button state
      activeBtn.classList.remove('text-slate-400', 'hover:text-white');
      activeBtn.classList.add('active', 'bg-brand-600', 'text-white', 'shadow-lg');
      activeBtn.setAttribute('aria-selected', 'true');
    } else {
      console.error(`Tab button tab-${tabIndex}-btn not found`);
    }

    // 2. Update Content
    const contents = document.querySelectorAll('.tab-content');
    if (!contents.length) {
      console.warn('No tab content sections found');
      return;
    }

    contents.forEach(content => {
      // Hide all content
      content.classList.add('hidden', 'opacity-0', 'translate-y-4');
      content.classList.remove('active', 'opacity-100', 'translate-y-0');
    });

    const activeContent = document.getElementById(`tab-${tabIndex}-content`);
    if (activeContent) {
      // Show active content with transition
      activeContent.classList.remove('hidden');
      
      // Use requestAnimationFrame for smoother transition handling
      requestAnimationFrame(() => {
        // Double RAF to ensure browser has painted the 'display: block' state
        requestAnimationFrame(() => {
          activeContent.classList.remove('opacity-0', 'translate-y-4');
          activeContent.classList.add('active', 'opacity-100', 'translate-y-0');
        });
      });
    } else {
      console.error(`Tab content tab-${tabIndex}-content not found`);
    }
  } catch (error) {
    console.error('Error in switchTab:', error);
  }
}

// Ensure global access
window.switchTab = switchTab;

// Initialize Tabs on Load
document.addEventListener('DOMContentLoaded', () => {
    // Add click listeners programmatically for better reliability
    const tabBtns = document.querySelectorAll('.tab-btn');
    tabBtns.forEach(btn => {
        btn.addEventListener('click', (e) => {
            // Extract index from ID: tab-1-btn -> 1
            const id = btn.id;
            const match = id.match(/tab-(\d+)-btn/);
            if (match && match[1]) {
                switchTab(parseInt(match[1]));
            }
        });
    });
});


// 页面加载自动初始化研究中心与FAQ
window.addEventListener('DOMContentLoaded', () => {
  if (document.getElementById('insights-container')) {
    loadResearchInsights();
  }
  if (document.getElementById('faq-list')) {
    loadFaqData();
  }
  // Init search
  initSearch();
  
  // Mission items interaction
  const missionItems = document.querySelectorAll('.mission-item');
  missionItems.forEach(item => {
      item.addEventListener('click', () => {
          missionItems.forEach(i => {
              if (i === item) {
                  i.classList.add('active');
                  i.classList.remove('dimmed');
              } else {
                  i.classList.add('dimmed');
                  i.classList.remove('active');
              }
          });
      });
  });
});

// ========== 验证码发送 ==========
function sendVerificationCode() {
  const phoneInput = document.getElementById('phone');
  const codeButton = document.getElementById('sendCode');
  
  if (!phoneInput || !codeButton) {
    console.error('找不到手机号输入框或发送按钮');
    return;
  }
  
  const phone = phoneInput.value.trim();
  if (!phone) {
    alert('请输入手机号');
    return;
  }
  
  if (!/^1[3-9]\d{9}$/.test(phone)) {
    alert('请输入有效的手机号');
    return;
  }
  
  codeButton.disabled = true;
  codeButton.textContent = '60s';
  
  let countdown = 60;
  const timer = setInterval(() => {
    countdown--;
    codeButton.textContent = `${countdown}s`;
    
    if (countdown <= 0) {
      clearInterval(timer);
      codeButton.disabled = false;
      codeButton.textContent = '发送验证码';
    }
  }, 1000);
  
  console.log('发送验证码到:', phone);
}

// ========== 响应式样式添加 ==========
function addResponsiveStyles() {
  const insightsStyles = `
    #insights-container {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(300px, 1fr));
      gap: 24px;
    }
    
    @media (max-width: 768px) {
      #insights-container {
        grid-template-columns: 1fr;
      }
    }
  `;
  const styleSheet = document.createElement("style");
  styleSheet.innerText = insightsStyles;
  document.head.appendChild(styleSheet);
}
addResponsiveStyles();

// ========== AI 智能搜索功能 ==========

// 知识库数据
const searchKB = [
    {
        keywords: ['ahcvm', '自有员工', '内部员工', '人效', 'roi'],
        title: 'AHCVM 自有员工价值经营解决方案',
        desc: '针对企业核心职能团队（研发、销售等），通过数字化平台与AI赋能，实现从人效量化到价值跃迁的完整闭环。',
        url: 'solutions.html#own-employees',
        type: '解决方案'
    },
    {
        keywords: ['ohcvm', '外部用工', '外包', '灵活用工', '合规', '风控'],
        title: 'OHCVM 外部用工价值经营解决方案',
        desc: '针对企业外包与灵活用工场景，提供全流程合规风控、成本优化与人才资产化管理服务。',
        url: 'solutions.html#non-own-employees',
        type: '解决方案'
    },
    {
        keywords: ['ai agent', '智能体', 'bot', '机器人', '自动化'],
        title: 'AI Agent 智能体应用',
        desc: '提供实时绩效Agent、工时统计Agent、技能陪练Agent等，重构工作流程，提升组织效能。',
        url: 'index.html#dual-engine',
        type: '技术应用'
    },
    {
        keywords: ['bi', '看板', '数据', '决策', '报表'],
        title: '经营决策看板 (BI)',
        desc: '实时展现人力资本ROI、利润预测与成本分析，让管理决策有据可依，告别经验主义。',
        url: 'index.html#dual-engine',
        type: '技术应用'
    },
    {
        keywords: ['双轮驱动', '方法论', '理论', '模型'],
        title: '管理+技术 双轮驱动模型',
        desc: '瑞华智策核心方法论：通过管理轮（价值创造）与技术轮（数智赋能）的深度咬合，实现企业增长。',
        url: 'index.html#dual-engine',
        type: '核心理念'
    },
    {
        keywords: ['联系', '电话', '地址', '咨询', '预约'],
        title: '联系我们 / 预约专家',
        desc: '预约组织人效体检，或咨询专业顾问。我们提供全周期的陪伴式服务。',
        url: 'productivity.html',
        type: '服务支持'
    }
];

// 初始化搜索功能
function initSearch() {
    const searchInput = document.getElementById('searchInput');
    if (searchInput) {
        searchInput.addEventListener('input', debounce(handleSearchInput, 500));
        searchInput.addEventListener('keydown', (e) => {
            if (e.key === 'Enter') {
                handleSearchInput(e);
            }
        });
    }
    
    // 点击背景关闭
    const backdrop = document.getElementById('searchBackdrop');
    if (backdrop) {
        backdrop.addEventListener('click', toggleSearch);
    }
    
    // ESC关闭
    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape') {
            const modal = document.getElementById('searchModal');
            if (modal && !modal.classList.contains('hidden')) {
                toggleSearch();
            }
        }
    });
}

// 防抖函数
function debounce(func, wait) {
    let timeout;
    return function(...args) {
        clearTimeout(timeout);
        timeout = setTimeout(() => func.apply(this, args), wait);
    };
}

// 切换搜索模态框
function toggleSearch() {
    const modal = document.getElementById('searchModal');
    const backdrop = document.getElementById('searchBackdrop');
    const panel = document.getElementById('searchPanel');
    const input = document.getElementById('searchInput');
    
    if (!modal) return;
    
    if (modal.classList.contains('hidden')) {
        // Show
        modal.classList.remove('hidden');
        // Animation
        setTimeout(() => {
            backdrop.classList.remove('opacity-0');
            panel.classList.remove('opacity-0', 'translate-y-4', 'scale-95');
            panel.classList.add('opacity-100', 'translate-y-0', 'scale-100');
        }, 10);
        // Focus input
        setTimeout(() => {
            input.focus();
            input.value = ''; // Clear previous
            resetSearchState();
        }, 100);
        document.body.style.overflow = 'hidden'; // Lock scroll
    } else {
        // Hide
        backdrop.classList.add('opacity-0');
        panel.classList.add('opacity-0', 'translate-y-4', 'scale-95');
        panel.classList.remove('opacity-100', 'translate-y-0', 'scale-100');
        
        setTimeout(() => {
            modal.classList.add('hidden');
            document.body.style.overflow = ''; // Unlock scroll
        }, 300);
    }
}

// 重置搜索状态
function resetSearchState() {
    document.getElementById('searchSuggestions').classList.remove('hidden');
    document.getElementById('searchLoading').classList.add('hidden');
    document.getElementById('searchResultList').classList.add('hidden');
    document.getElementById('searchNoResults').classList.add('hidden');
}

// 填充搜索词
function fillSearch(query) {
    const input = document.getElementById('searchInput');
    input.value = query;
    handleSearchInput({ target: input });
}

// 处理搜索输入
function handleSearchInput(e) {
    const query = e.target.value.trim().toLowerCase();
    
    if (!query) {
        resetSearchState();
        return;
    }
    
    // Show Loading
    document.getElementById('searchSuggestions').classList.add('hidden');
    document.getElementById('searchResultList').classList.add('hidden');
    document.getElementById('searchNoResults').classList.add('hidden');
    document.getElementById('searchLoading').classList.remove('hidden');
    
    // Simulate AI Thinking Delay
    setTimeout(() => {
        performSearch(query);
    }, 800 + Math.random() * 500);
}

// 执行搜索逻辑
function performSearch(query) {
    document.getElementById('searchLoading').classList.add('hidden');
    const resultContainer = document.getElementById('searchResultList');
    
    // Simple Keyword Matching
    const results = searchKB.filter(item => {
        return item.keywords.some(k => query.includes(k)) || 
               item.title.toLowerCase().includes(query) || 
               item.desc.toLowerCase().includes(query);
    });
    
    if (results.length > 0) {
        resultContainer.innerHTML = results.map(item => `
            <a href="${item.url}" onclick="toggleSearch()" class="block bg-white p-4 rounded-xl border border-slate-100 hover:border-brand-300 hover:shadow-md transition-all group">
                <div class="flex justify-between items-start">
                    <div>
                        <span class="inline-block px-2 py-0.5 rounded text-xs font-medium bg-brand-50 text-brand-600 mb-2">${item.type}</span>
                        <h4 class="text-lg font-bold text-slate-800 group-hover:text-brand-600 transition-colors">${item.title}</h4>
                        <p class="text-slate-500 text-sm mt-1 leading-relaxed">${item.desc}</p>
                    </div>
                    <i class="fas fa-chevron-right text-slate-300 group-hover:text-brand-500 mt-2"></i>
                </div>
            </a>
        `).join('');
        
        resultContainer.classList.remove('hidden');
    } else {
        document.getElementById('searchNoResults').classList.remove('hidden');
    }
}

// ========== Mission & Solution Interaction ==========

// Switch Tabs on Mobile
function switchMissionTab(tab) {
    const cardChallenges = document.getElementById('mission-challenges');
    const cardSolutions = document.getElementById('mission-solutions');
    const tabChallenges = document.getElementById('tab-challenges');
    const tabSolutions = document.getElementById('tab-solutions');

    if (!cardChallenges || !cardSolutions) return;

    if (tab === 'challenges') {
        // Show Challenges
        cardChallenges.classList.remove('hidden');
        cardSolutions.classList.add('hidden');
        
        // Update Tab Styles
        if (tabChallenges) tabChallenges.className = 'px-6 py-2.5 rounded-lg text-sm font-bold bg-white text-[#EA5504] shadow-sm transition-all duration-300';
        if (tabSolutions) tabSolutions.className = 'px-6 py-2.5 rounded-lg text-sm font-bold text-slate-500 hover:text-brand-600 transition-all duration-300';
    } else {
        // Show Solutions
        cardChallenges.classList.add('hidden');
        cardSolutions.classList.remove('hidden');
        
        // Update Tab Styles
        if (tabChallenges) tabChallenges.className = 'px-6 py-2.5 rounded-lg text-sm font-bold text-slate-500 hover:text-[#EA5504] transition-all duration-300';
        if (tabSolutions) tabSolutions.className = 'px-6 py-2.5 rounded-lg text-sm font-bold bg-white text-brand-600 shadow-sm transition-all duration-300';
    }
}

// Initialize Mission Interactions
function initMissionInteractions() {
    const cards = document.querySelectorAll('.mission-card');
    const container = document.getElementById('mission-interaction-container');
    
    if (!cards.length || !container) return;

    // Desktop Interaction (Hover)
    if (window.matchMedia('(min-width: 768px)').matches) {
        cards.forEach(card => {
            card.addEventListener('mouseenter', () => {
                const index = card.getAttribute('data-index');
                if (!index) return;

                // Activate this card and its counterpart
                cards.forEach(c => {
                    if (c.getAttribute('data-index') === index) {
                        c.classList.add('active');
                        c.classList.remove('dimmed');
                    } else {
                        c.classList.remove('active');
                        c.classList.add('dimmed');
                    }
                });
            });

            card.addEventListener('mouseleave', () => {
                // Reset all
                cards.forEach(c => {
                    c.classList.remove('active', 'dimmed');
                });
            });
        });
    }

    // Mobile/Touch Interaction (Click/Tap)
    // Using IntersectionObserver for scroll animations instead of click logic for now, 
    // as mobile usually just shows the content stacked.
    
    // Animation on scroll
    const observer = new IntersectionObserver((entries) => {
        entries.forEach((entry, index) => {
            if (entry.isIntersecting) {
                setTimeout(() => {
                    entry.target.classList.add('opacity-100', 'translate-y-0');
                    entry.target.classList.remove('opacity-0', 'translate-y-4');
                }, index * 100);
                observer.unobserve(entry.target);
            }
        });
    }, { threshold: 0.1 });

    cards.forEach(card => {
        // Add initial state for animation
        card.classList.add('transition-all', 'duration-500', 'opacity-0', 'translate-y-4');
        observer.observe(card);
    });
}

// Progressive Loading & Ripple Effect
document.addEventListener('DOMContentLoaded', () => {
    initMissionInteractions();
    
    // 1. Progressive Loading (Legacy - kept for compatibility if needed elsewhere)
    const missionItems = document.querySelectorAll('.mission-item');
    if (missionItems.length > 0) {
        const observer = new IntersectionObserver((entries) => {
            entries.forEach((entry, index) => {
                if (entry.isIntersecting) {
                    // Add staggered delay based on index
                    setTimeout(() => {
                        entry.target.classList.add('visible');
                    }, index * 100); 
                    observer.unobserve(entry.target);
                }
            });
        }, { threshold: 0.1 });

        missionItems.forEach(item => {
            observer.observe(item);
            
            // Add Ripple Effect
            item.addEventListener('click', function(e) {
                const rect = this.getBoundingClientRect();
                const x = e.clientX - rect.left;
                const y = e.clientY - rect.top;
                
                const circle = document.createElement('span');
                circle.classList.add('ripple-effect');
                circle.style.left = `${x}px`;
                circle.style.top = `${y}px`;
                
                this.appendChild(circle);
                
                setTimeout(() => circle.remove(), 600);
            });
        });
    }
});

// ========== Diagnostic Quiz Logic ==========

// Definition of question scores
const qScores = {
    q1: {A:0, B:0, C:0},
    q2: {A:0, B:0, C:0, D:0, E:0, F:0},
    q3: {A:0, B:0, C:0, D:0},
    q4: {A:5, B:10, C:20, D:0},
    q5: {A:5, B:5, C:20, D:0},
    q6: {A:0, B:10, C:20, D:30},
    q7: {A:20, B:10, C:0},
    q8: {A:2, B:2, C:2, D:2, E:5, F:0}, // Multi-select
    q9: {A:0, B:10, C:15, D:20},
    q10: {A:20, B:10, C:0}
};

// Store user selections: { q1: ['A'], q8: ['A', 'C'] }
let userSelections = {};

// Initialize Diagnostic Quiz
function initDiagnosticQuiz() {
    const quizView = document.getElementById('quiz-view');
    if (!quizView) return;

    // Event Delegation for Options
    quizView.addEventListener('click', function(e) {
        const opt = e.target.closest('.opt');
        if (opt) {
            const q = opt.getAttribute('data-q');
            const val = opt.getAttribute('data-val');
            if (q && val) {
                handleOptionClick(q, val, opt);
            }
        }
    });

    // Event Listener for Submit Button
    const submitBtn = document.getElementById('submit-diagnostic-btn');
    if (submitBtn) {
        submitBtn.addEventListener('click', submitDiagnostic);
    }
}

// Handle Option Click
function handleOptionClick(q, optKey, element) {
    // Multi-select logic for Q8
    if (q === 'q8') {
        // Initialize array if not exists
        if (!userSelections[q]) userSelections[q] = [];
        
        // Special handling for Option F ("None of the above")
        if (optKey === 'F') {
            // If clicking F, clear others
            if (!userSelections[q].includes('F')) {
                userSelections[q] = ['F'];
                // Visual update
                document.querySelectorAll(`#${q} .opt`).forEach(o => o.classList.remove('selected'));
                element.classList.add('selected');
            } else {
                // Deselect F
                userSelections[q] = [];
                element.classList.remove('selected');
            }
        } else {
            // If clicking others, ensure F is removed
            if (userSelections[q].includes('F')) {
                 userSelections[q] = userSelections[q].filter(k => k !== 'F');
                 const fOpt = document.querySelector(`#${q} .opt[data-val="F"]`);
                 if(fOpt) fOpt.classList.remove('selected');
            }
            
            // Toggle current
            if (userSelections[q].includes(optKey)) {
                userSelections[q] = userSelections[q].filter(k => k !== optKey);
                element.classList.remove('selected');
            } else {
                userSelections[q].push(optKey);
                element.classList.add('selected');
            }
        }
    } else {
        // Single choice logic
        userSelections[q] = [optKey];
        document.querySelectorAll(`#${q} .opt`).forEach(o => o.classList.remove('selected'));
        element.classList.add('selected');
    }
}

// Submit Logic
async function submitDiagnostic() {
    const submitBtn = document.getElementById('submit-diagnostic-btn');
    
    // Validate all 10 questions answered
    const requiredQuestions = ['q1', 'q2', 'q3', 'q4', 'q5', 'q6', 'q7', 'q8', 'q9', 'q10'];
    const missing = requiredQuestions.filter(q => !userSelections[q] || userSelections[q].length === 0);
    
    if (missing.length > 0) { 
        alert('请完成所有 10 道题目后再提交'); 
        // Scroll to first missing question
        const firstMissing = document.getElementById(missing[0]);
        if(firstMissing) firstMissing.scrollIntoView({behavior: 'smooth', block: 'center'});
        return; 
    }
    
    // Calculate Score
    let totalScore = 0;
    const maxPossibleScore = 143; // Sum of max scores for all questions
    
    // Sum scores
    for (const [q, opts] of Object.entries(userSelections)) {
        if (qScores[q]) {
            opts.forEach(opt => {
                if (qScores[q][opt] !== undefined) {
                    totalScore += qScores[q][opt];
                }
            });
        }
    }
    
    // Normalize score to 0-100 scale
    const final = Math.round((totalScore / maxPossibleScore) * 100);

    // Prepare result object
    let resultObj = {
        score: final,
        level: "",
        summary: "",
        insight: "",
        currentStatus: "",
        potential: "",
        action: ""
    };

    if (final < 50) {
        resultObj.level = "初步意识阶段";
        resultObj.summary = "人力投入仍被视为纯粹的财务负担，尚未与业务增长逻辑形成数据上的连接。";
        resultObj.insight = "数据烟囱现象严重，人力资本回报（ROHC）缺乏量化核算，管理决策主要依赖经验和主观判断。";
        resultObj.currentStatus = "缺乏跨部门联合分析，预算主要基于历史基数微调，而非基于产出预测。";
        resultObj.potential = "通过 ROHC 框架可识别至少 15% 的效能提升空间，识别出高投入低产出的冗余环节。";
        resultObj.action = "建立人–业–财统一视图，选定单一业务单元算清‘人力投资回报’，建立标杆。";
    } else if (final < 80) {
        resultObj.level = "建设起步阶段";
        resultObj.summary = "您企业已经具备了较好的数据基础，并开始尝试人效对比。目前处于从'定性评估'向'定量经营'转型的关键期。";
        resultObj.insight = "部门间数据壁垒正在打破，部分核心业务线已实现量化管理，但尚未形成全公司的经营闭环。";
        resultObj.currentStatus = "已有基础报表体系，管理层开始关注 ROI，但数据实时性和颗粒度尚不足以支持即时决策。";
        resultObj.potential = "将 ROHC 框架嵌入绩效与薪酬管理，可显著增强组织敏捷性，优化人才配置结构。";
        resultObj.action = "扩展 ROHC 指标应用到更多业务单元，引入系统与数据打通实现动态监控。";
    } else {
        resultObj.level = "体系化升级阶段";
        resultObj.summary = "人力资本已成为驱动业务增长的核心引擎，数据链路全面贯通，具备高度的经营敏捷性。";
        resultObj.insight = "具备实时监控 ROHC 指标的能力，人力投入已实现精细化投产比分析，管理决策具备高度预测性。";
        resultObj.currentStatus = "系统数据已实现‘人-业-财’深度对齐，支持管理层随时进行基于数据的投产调优。";
        resultObj.potential = "具备引入 AI 预测模型的数字化基础，可实现人才流失、招聘及投入产出的智能预测。";
        resultObj.action = "在人力规划中嵌入 AI 工具做持续监控，并将 ROHC 框架提升至资产化经营管理高度。";
    }

    // Set Loading State
    if(submitBtn) {
        submitBtn.disabled = true;
        submitBtn.textContent = '正在分析数据...';
        submitBtn.classList.add('opacity-75', 'cursor-not-allowed');
    }

    try {
        // Send to API
        const response = await fetch('/api/maturity-submission', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                answers: userSelections,
                score: final,
                level: resultObj.level,
                resultDetail: resultObj
            })
        });

        const resData = await response.json();

        if (!response.ok) {
            throw new Error(resData.error || 'Submission failed');
        }

        // Save to localStorage for result page
        localStorage.setItem('quizResult', JSON.stringify(resultObj));
        localStorage.setItem('userSelections', JSON.stringify(userSelections));
        
        // Redirect to result page with absolute path and ID
        window.location.href = `/diagnostic-result.html?id=${resData.id || ''}`;

    } catch (e) {
        console.error('Submission error:', e);
        alert('提交失败，请稍后重试。如果问题持续，请联系客服。');
        // Restore button state
        if(submitBtn) {
            submitBtn.disabled = false;
            submitBtn.textContent = '提交并获取专家诊断报告';
            submitBtn.classList.remove('opacity-75', 'cursor-not-allowed');
        }
    }
}

// Initialize when DOM is ready
document.addEventListener('DOMContentLoaded', initDiagnosticQuiz);

// ========== Diagnostic Result Rendering ==========
function renderDiagnosticResult() {
    const resultContainer = document.getElementById('score-value');
    if (!resultContainer) return; // Not on result page

    console.log('Rendering Diagnostic Result...');

    // 1. Get Data
    let result = null;
    try {
        const stored = localStorage.getItem('quizResult');
        if (stored) {
            result = JSON.parse(stored);
        }
    } catch (e) {
        console.error('Failed to parse result:', e);
    }

    // Handle No Data
    if (!result) {
        // Only redirect if we are actually on the result page
        // Check if we are on diagnostic-result.html to avoid loop
        if (window.location.pathname.includes('diagnostic-result.html')) {
             alert('未找到测评结果，请重新进行测评。');
             window.location.href = 'diagnostic.html';
        }
        return;
    }

    // 2. Populate Text Fields
    setText('score-value', result.score);
    setText('level-name', result.level);
    setText('level-summary', result.summary);
    setText('level-insight', result.insight);
    setText('status-desc', result.currentStatus);
    setText('potential-desc', result.potential);

    // 3. Update Gauge
    // r=40, circumference = 2 * PI * 40 ≈ 251.2
    const circle = document.getElementById('score-circle');
    if (circle) {
        const circumference = 251.2;
        const offset = circumference - (result.score / 100) * circumference;
        // Small delay for animation
        setTimeout(() => {
            circle.style.transition = 'stroke-dashoffset 1.5s ease-out';
            circle.style.strokeDashoffset = offset;
            
            // Color based on score - using Brand Colors primarily
            circle.classList.remove('text-brand', 'text-orange-500', 'text-blue-500', 'text-green-500');
            if (result.score < 60) circle.classList.add('text-brand-400');
            else if (result.score < 80) circle.classList.add('text-brand-500');
            else circle.classList.add('text-brand-600');
        }, 100);
    }

    // 4. Generate Dynamic Content for Empty Containers
    generateStatusMetrics(result.score);
    generatePotentialMetrics(result.score);
    generateActionRoadmap(result.level);
}

function setText(id, text) {
    const el = document.getElementById(id);
    if (el) el.textContent = text || '';
}

function generateStatusMetrics(score) {
    const container = document.getElementById('status-metrics');
    if (!container) return;

    // Simulate metrics based on score
    const dataAccuracy = Math.min(100, Math.round(score * 0.8 + 10));
    const processEfficiency = Math.min(100, Math.round(score * 0.7 + 15));
    const talentAlign = Math.min(100, Math.round(score * 0.9));

    container.innerHTML = `
        <div class="space-y-3">
            <div>
                <div class="flex justify-between text-xs font-bold text-slate-500 mb-1">
                    <span>数据准确性</span>
                    <span>${dataAccuracy}%</span>
                </div>
                <div class="w-full bg-slate-100 rounded-full h-2">
                    <div class="bg-brand-600 h-2 rounded-full" style="width: ${dataAccuracy}%"></div>
                </div>
            </div>
            <div>
                <div class="flex justify-between text-xs font-bold text-slate-500 mb-1">
                    <span>流程闭环度</span>
                    <span>${processEfficiency}%</span>
                </div>
                <div class="w-full bg-slate-100 rounded-full h-2">
                    <div class="bg-brand-500 h-2 rounded-full" style="width: ${processEfficiency}%"></div>
                </div>
            </div>
            <div>
                <div class="flex justify-between text-xs font-bold text-slate-500 mb-1">
                    <span>人才-业务对齐度</span>
                    <span>${talentAlign}%</span>
                </div>
                <div class="w-full bg-slate-100 rounded-full h-2">
                    <div class="bg-brand-400 h-2 rounded-full" style="width: ${talentAlign}%"></div>
                </div>
            </div>
        </div>
    `;
}

function generatePotentialMetrics(score) {
    const container = document.getElementById('potential-metrics');
    if (!container) return;
    
    // Inverse relationship: lower score = higher potential for improvement
    const roiPotential = Math.max(10, 100 - score); 
    const costSaving = Math.max(5, (100 - score) * 0.6);
    
    container.innerHTML = `
        <div class="grid grid-cols-2 gap-4">
            <div class="bg-brand-50 rounded-lg p-3 text-center border border-brand-100">
                <div class="text-2xl font-extrabold text-brand-600">+${roiPotential}%</div>
                <div class="text-xs text-brand-800 font-medium">ROHC 提升空间</div>
            </div>
            <div class="bg-slate-50 rounded-lg p-3 text-center border border-slate-200">
                <div class="text-2xl font-extrabold text-slate-600">${Math.round(costSaving)}%</div>
                <div class="text-xs text-slate-800 font-medium">预计成本优化</div>
            </div>
        </div>
    `;
}

function generateActionRoadmap(level) {
    const container = document.getElementById('action-roadmap');
    if (!container) return;

    // Detailed Roadmap Data
    const roadmapData = {
        "初步意识阶段": [
            {
                phase: "第一阶段：基础夯实 (1-2个月)",
                title: "数据治理与标准建立",
                summary: "建立统一的人力资源数据字典，打破数据孤岛，确保数据源的准确性与一致性。",
                steps: ["盘点现有HR系统数据字段", "定义核心人效指标（如人均产出、人均成本）口径", "建立月度基础人效报表机制"],
                kpis: ["数据准确率达到 95%", "核心指标定义覆盖率 100%"],
                resources: ["HRIS系统管理员", "业务部门接口人", "Excel/BI工具"],
                risks: ["业务部门配合度低", "历史数据缺失严重"]
            },
            {
                phase: "第二阶段：试点突破 (3-4个月)",
                title: "单一业务线人效试点",
                summary: "选取销售或研发作为试点业务线，建立基础人效看板，进行小范围价值验证。",
                steps: ["选取销售/研发作为试点", "建立基础人效看板", "月度经营分析会复盘"],
                kpis: ["产出人效指标可视化", "发现至少3个管理改进点"],
                resources: ["业务BP", "数据分析师"],
                risks: ["试点业务线抵触", "数据解读偏差"]
            },
            {
                phase: "第三阶段：机制固化 (5-6个月)",
                title: "建立常规化人效运营机制",
                summary: "将试点经验推广至全公司，将人效指标纳入绩效考核，建立定期数据发布机制。",
                steps: ["推广至全公司", "将人效指标纳入绩效考核", "建立定期数据发布机制"],
                kpis: ["人效报表自动化率 > 80%", "管理者数据查看频率提升"],
                resources: ["全面BI平台", "组织发展(OD)专家"],
                risks: ["管理者只看数据不行动"]
            }
        ],
        "建设起步阶段": [
            {
                phase: "第一阶段：体系优化 (1-3个月)",
                title: "ROHC指标体系深度构建",
                summary: "细化各职能部门ROHC指标，建立投入-产出归因模型，优化薪酬总额预算机制。",
                steps: ["细化各职能部门ROHC指标", "建立投入-产出归因模型", "优化薪酬总额预算机制"],
                kpis: ["薪酬包与业绩挂钩机制建立", "人均毛利提升 5%"],
                resources: ["薪酬绩效专家", "财务BP"],
                risks: ["模型过于复杂难以落地"]
            },
            {
                phase: "第二阶段：数智驱动 (4-6个月)",
                title: "业财一体化实时监控",
                summary: "打通HR与财务系统，建立实时人效驾驶舱，实施动态编制管理。",
                steps: ["打通HR与财务系统", "建立实时人效驾驶舱", "实施动态编制管理"],
                kpis: ["数据滞后时间 < 1天", "编制预测准确率 > 90%"],
                resources: ["集成开发资源", "数据中台"],
                risks: ["跨系统数据口径不一致", "关键数据源质量不足"]
            },
            {
                phase: "第三阶段：价值闭环 (7-12个月)",
                title: "人力资本ROI全流程管理",
                summary: "从招聘到离职全生命周期ROI分析，基于ROI的人才配置优化，低效资产剥离。",
                steps: ["全生命周期ROI分析", "基于ROI的人才配置优化", "低效资产剥离"],
                kpis: ["整体ROHC提升 10%", "人才配置效率显著优化"],
                resources: ["外部咨询顾问", "AI预测工具"],
                risks: ["组织变革带来的短期动荡"]
            }
        ],
        "体系化升级阶段": [
            {
                phase: "第一阶段：预测引领 (1-3个月)",
                title: "AI驱动的人才预测模型",
                summary: "建立离职预测模型，构建业务量与人力需求预测算法，人才供给风险预警。",
                steps: ["建立离职预测模型", "构建业务量与人力需求预测算法", "人才供给风险预警"],
                kpis: ["离职预测准确率 > 80%", "需求预测偏差 < 5%"],
                resources: ["数据科学家", "AI算法平台"],
                risks: ["算法黑箱导致信任度低"]
            },
            {
                phase: "第二阶段：生态经营 (4-6个月)",
                title: "泛人力资本生态整合",
                summary: "纳入外包/灵活用工的统一效能管理，构建人才供应链生态，内部人才市场化流转。",
                steps: ["纳入外包/灵活用工统一管理", "构建人才供应链生态", "内部人才市场化流转"],
                kpis: ["外部用工成本优化 15%", "内部活水率 > 20%"],
                resources: ["数字化采购平台", "人才市场运营团队"],
                risks: ["合规风险与数据安全"]
            },
            {
                phase: "第三阶段：组织进化 (7-12个月)",
                title: "自适应敏捷组织构建",
                summary: "去中心化的决策机制，基于任务的动态组队，即时激励与价值分配。",
                steps: ["去中心化的决策机制", "基于任务的动态组队", "即时激励与价值分配"],
                kpis: ["组织响应速度提升 30%", "员工敬业度显著提升"],
                resources: ["敏捷协作工具", "组织变革领导小组"],
                risks: ["文化冲突与管理失控"]
            }
        ]
    };

    const phases = roadmapData[level] || roadmapData["初步意识阶段"];

    container.innerHTML = phases.map((p, i) => `
        <div class="bg-white rounded-xl border border-slate-100 shadow-sm overflow-hidden hover:shadow-md transition-all duration-300 group">
            <!-- Header -->
            <div class="p-6 cursor-pointer flex items-start justify-between bg-white relative z-10" onclick="toggleRoadmapDetail(${i})">
                <div class="flex gap-5">
                    <div class="flex-shrink-0 w-12 h-12 rounded-full bg-brand-50 flex items-center justify-center text-brand-600 font-bold text-lg group-hover:bg-brand-600 group-hover:text-white transition-colors duration-300 shadow-sm">
                        ${i+1}
                    </div>
                    <div>
                        <div class="text-xs font-bold text-brand-600 uppercase tracking-wide mb-1 flex items-center gap-2">
                            <span class="w-2 h-2 rounded-full bg-brand-400"></span>
                            ${p.phase}
                        </div>
                        <h3 class="text-xl font-bold text-slate-900 mb-2 group-hover:text-brand-600 transition-colors">${p.title}</h3>
                        <p class="text-slate-500 text-sm leading-relaxed max-w-2xl">${p.summary}</p>
                    </div>
                </div>
                <button class="w-10 h-10 rounded-full bg-slate-50 flex items-center justify-center text-slate-400 hover:text-brand-600 hover:bg-brand-50 transition-all transform duration-300" id="roadmap-arrow-${i}">
                    <i class="fas fa-chevron-down transition-transform duration-300"></i>
                </button>
            </div>
            
            <!-- Details (Collapsible) -->
            <div id="roadmap-detail-${i}" class="hidden bg-slate-50/80 border-t border-slate-100 backdrop-blur-sm">
                <div class="p-6 pl-[5.5rem] grid md:grid-cols-2 gap-8 animate-fade-in-down">
                    <!-- Steps -->
                    <div class="bg-white p-5 rounded-lg border border-slate-100 shadow-sm">
                        <h4 class="font-bold text-slate-900 text-sm mb-4 flex items-center gap-2 border-b border-slate-50 pb-2">
                            <div class="w-6 h-6 rounded bg-brand-100 flex items-center justify-center text-brand-600 text-xs"><i class="fas fa-list-ul"></i></div>
                            关键行动步骤
                        </h4>
                        <ul class="space-y-3">
                            ${p.steps.map(s => `<li class="flex items-start gap-3 text-sm text-slate-600 group/item hover:text-slate-900 transition-colors"><i class="fas fa-check-circle text-brand-400 mt-0.5 text-xs group-hover/item:text-brand-600"></i>${s}</li>`).join('')}
                        </ul>
                    </div>
                    
                    <div class="space-y-6">
                        <!-- Resources & KPIs -->
                        <div class="grid grid-cols-2 gap-4">
                             <div class="bg-brand-50/50 p-4 rounded-lg border border-brand-100">
                                <h4 class="font-bold text-slate-900 text-xs mb-3 flex items-center gap-2 uppercase tracking-wide">
                                    <i class="fas fa-chart-line text-brand-500"></i> 预期效果 (KPI)
                                </h4>
                                <ul class="space-y-2">
                                     ${p.kpis.map(k => `<li class="text-xs text-slate-700 font-medium flex items-center gap-1.5"><span class="w-1 h-1 bg-brand-400 rounded-full"></span>${k}</li>`).join('')}
                                </ul>
                            </div>
                            
                            <div class="bg-slate-50/50 p-4 rounded-lg border border-slate-100">
                                <h4 class="font-bold text-slate-900 text-xs mb-3 flex items-center gap-2 uppercase tracking-wide">
                                    <i class="fas fa-tools text-slate-500"></i> 资源与工具
                                </h4>
                                <div class="flex flex-wrap gap-2">
                                    ${p.resources.map(r => `<span class="px-2 py-1 bg-white border border-slate-200 rounded text-[10px] font-bold text-slate-600 shadow-sm">${r}</span>`).join('')}
                                </div>
                            </div>
                        </div>

                        <!-- Risks -->
                        <div class="bg-white p-4 rounded-lg border border-slate-200 flex items-start gap-3 shadow-sm">
                            <i class="fas fa-exclamation-triangle text-brand-600 mt-0.5"></i>
                            <div>
                                <h4 class="font-bold text-slate-900 text-xs mb-1 uppercase tracking-wide">潜在风险提示</h4>
                                <div class="text-xs text-slate-600 leading-relaxed">
                                     ${p.risks.join("；")}
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    `).join('');
}

// Toggle Detail Function
window.toggleRoadmapDetail = function(index) {
    const detail = document.getElementById(`roadmap-detail-${index}`);
    const arrowIcon = document.querySelector(`#roadmap-arrow-${index} i`);
    const arrowBtn = document.getElementById(`roadmap-arrow-${index}`);
    
    if (detail.classList.contains('hidden')) {
        // Open
        detail.classList.remove('hidden');
        arrowIcon.style.transform = 'rotate(180deg)';
        arrowBtn.classList.add('bg-brand-50', 'text-brand-600');
        arrowBtn.classList.remove('bg-slate-50', 'text-slate-400');
    } else {
        // Close
        detail.classList.add('hidden');
        arrowIcon.style.transform = 'rotate(0deg)';
        arrowBtn.classList.remove('bg-brand-50', 'text-brand-600');
        arrowBtn.classList.add('bg-slate-50', 'text-slate-400');
    }
};

// Share Report Function
function shareReport() {
    if (navigator.share) {
        navigator.share({
            title: '瑞华智策 - 人力资本价值经营诊断',
            text: '我刚刚完成了企业人效成熟度诊断，推荐你也来测测！',
            url: window.location.href,
        })
        .then(() => console.log('Successful share'))
        .catch((error) => console.log('Error sharing', error));
    } else {
        // Fallback: Copy to clipboard
        const dummy = document.createElement('input');
        document.body.appendChild(dummy);
        dummy.value = window.location.href;
        dummy.select();
        document.execCommand('copy');
        document.body.removeChild(dummy);
        alert('链接已复制到剪贴板，快去分享给同事吧！');
    }
}

// Hook into DOMContentLoaded
document.addEventListener('DOMContentLoaded', () => {
    renderDiagnosticResult();
});

// Form Handling
async function handleFormSubmit(event) {
    event.preventDefault();
    
    const form = event.target;
    const btn = form.querySelector('button[type="submit"]');
    const originalText = btn.innerHTML; // Use innerHTML to preserve any existing icons/styles
    
    // Collect Form Data
    const formData = new FormData(form);
    const userInfo = Object.fromEntries(formData.entries());
    
    // Validation
    let hasError = false;
    const phoneRegex = /^1[3-9]\d{9}$/;
    
    // Phone validation
    const phoneInput = form.querySelector('input[name="phone"]');
    if (!phoneRegex.test(userInfo.phone)) {
        showInputError(phoneInput, '请输入正确的11位手机号');
        hasError = true;
    } else {
        clearInputError(phoneInput);
    }

    // Company validation
    const companyInput = form.querySelector('input[name="company"]');
    if (!userInfo.company || userInfo.company.trim().length < 2) {
        showInputError(companyInput, '请填写公司全称');
        hasError = true;
    } else {
        clearInputError(companyInput);
    }

    if (hasError) return;

    // Retrieve Quiz Data from LocalStorage
    let quizResult = null;
    let userSelections = null;
    try {
        const storedResult = localStorage.getItem('quizResult');
        const storedSelections = localStorage.getItem('userSelections');
        if (storedResult) quizResult = JSON.parse(storedResult);
        if (storedSelections) userSelections = JSON.parse(storedSelections);
    } catch (e) {
        console.error('Failed to retrieve quiz data:', e);
    }

    // Ensure we have minimal data
    if (!quizResult) {
        alert('无法获取您的测评结果，请重新进行测评。');
        return;
    }

    btn.disabled = true;
    btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> 提交中...';
    
    try {
        const response = await fetch('/api/maturity-submission', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                name: userInfo.name,
                phone: userInfo.phone,
                company: userInfo.company,
                answers: userSelections || {},
                score: quizResult.score,
                level: quizResult.level,
                resultDetail: quizResult
            })
        });

        const resData = await response.json();

        if (response.ok && resData.success) {
            // Show Success Modal
            const modal = document.getElementById('successModal');
            const backdrop = document.getElementById('modalBackdrop');
            const panel = document.getElementById('modalPanel');
            
            if (modal) {
                modal.classList.remove('hidden');
                // Animate in
                setTimeout(() => {
                    backdrop.classList.remove('opacity-0');
                    panel.classList.remove('opacity-0', 'scale-95');
                    panel.classList.add('opacity-100', 'scale-100');
                }, 10);
            }
            form.reset();
            // Clear localStorage? Maybe not, user might want to see result again.
            // localStorage.removeItem('quizResult');
            // localStorage.removeItem('userSelections');
        } else {
            throw new Error(resData.error || '提交失败');
        }
    } catch (error) {
        console.error('Submission error:', error);
        alert('提交失败，请稍后重试: ' + error.message);
    } finally {
        btn.disabled = false;
        btn.innerHTML = originalText;
    }
}

function showInputError(input, message) {
    input.classList.add('border-red-500', 'ring-red-100');
    input.classList.remove('border-slate-200', 'focus:border-brand-500');
    
    let errorMsg = input.parentNode.querySelector('.error-msg');
    if (!errorMsg) {
        errorMsg = document.createElement('p');
        errorMsg.className = 'error-msg text-red-500 text-xs mt-1 animate-fade-in';
        input.parentNode.appendChild(errorMsg);
    }
    errorMsg.textContent = message;
}

function clearInputError(input) {
    input.classList.remove('border-red-500', 'ring-red-100');
    input.classList.add('border-slate-200');
    
    const errorMsg = input.parentNode.querySelector('.error-msg');
    if (errorMsg) {
        errorMsg.remove();
    }
}

// Real-time validation
document.addEventListener('input', (e) => {
    if (e.target.name === 'phone') {
        const phoneRegex = /^1[3-9]\d{9}$/;
        if (e.target.value.length === 11) {
            if (!phoneRegex.test(e.target.value)) {
                showInputError(e.target, '手机号格式不正确');
            } else {
                clearInputError(e.target);
            }
        } else if (e.target.value.length > 11) {
            e.target.value = e.target.value.slice(0, 11);
        }
    }
    
    if (e.target.name === 'company') {
        if (e.target.value.trim().length >= 2) {
            clearInputError(e.target);
        }
    }
});

function closeModal() {
    const modal = document.getElementById('successModal');
    const backdrop = document.getElementById('modalBackdrop');
    const panel = document.getElementById('modalPanel');
    
    if (modal) {
        backdrop.classList.add('opacity-0');
        panel.classList.add('opacity-0', 'scale-95');
        panel.classList.remove('opacity-100', 'scale-100');
        
        setTimeout(() => {
             modal.classList.add('hidden');
        }, 300);
    }
}
