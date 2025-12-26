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
function toggleFaq(dtElement) {
  const item = dtElement.closest('.faq-item');
  const content = item.querySelector('.faq-content');
  const icon = item.querySelector('.faq-icon');
  
  // Close other items
  const allItems = document.querySelectorAll('#faq-list .faq-item');
  allItems.forEach(el => {
    if (el !== item) {
      const c = el.querySelector('.faq-content');
      const i = el.querySelector('.faq-icon');
      if (c) {
        c.style.maxHeight = '0px';
        c.classList.remove('active');
        c.style.opacity = '0';
      }
      if (i) i.classList.remove('rotate');
    }
  });
  
  // Toggle current item
  if (content) {
    if (content.classList.contains('active')) {
      // Close
      content.style.maxHeight = '0px';
      content.style.opacity = '0';
      content.classList.remove('active');
      if (icon) icon.classList.remove('rotate');
    } else {
      // Open
      content.classList.add('active');
      content.style.opacity = '1';
      // Force layout update
      void content.offsetHeight; 
      content.style.maxHeight = content.scrollHeight + 'px';
      if (icon) icon.classList.add('rotate');
    }
  }
}

// Global category cache
let globalCategoryMap = null;

async function ensureCategoryMap() {
  if (globalCategoryMap) return globalCategoryMap;
  try {
    const res = await fetch('/api/categories');
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

// ========== 研究中心内容加载 ==========
async function loadResearchInsights() {
  console.log('开始加载研究中心内容...');
  const container = document.getElementById('insights-container');
  
  if (!container) {
    // console.error('研究中心容器未找到'); // Not an error on pages that don't have it
    return;
  }
  
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
    const response = await fetch('/api/articles?featured=true');
    console.log('文章API响应状态:', response.status);
    
    if (!response.ok) {
      throw new Error(`API响应失败: ${response.status}`);
    }
    
    const articles = await response.json();
    console.log('获取到的文章数据:', articles);
    
    if (!Array.isArray(articles) || articles.length === 0) {
      container.innerHTML = `
        <div class="col-span-full flex flex-col justify-center items-center p-12">
          <p>暂无研究文章</p>
          <button onclick="loadResearchInsights()" class="mt-4 px-4 py-2 bg-blue-500 text-white rounded-md hover:bg-blue-600">
            重试
          </button>
        </div>
      `;
      return;
    }
    
    container.innerHTML = '';
    
    articles.forEach(article => {
      if (!article || !article._id) {
        console.warn('跳过无效文章对象:', article);
        return;
      }
      
      const card = document.createElement('div');
      // 优化后的卡片样式，完全匹配设计图
      card.className = 'bg-white rounded-2xl shadow-md border border-slate-100 overflow-hidden transition-all duration-300 hover:shadow-xl group flex flex-col h-full';
      
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
      
      const link = article.slug ? `/article/${article.slug}.html` : `/article.html?id=${article._id}`;
      
      card.innerHTML = `
        <div class="relative w-full h-48 sm:h-56 overflow-hidden">
          <img src="${cover}" alt="${article.title || '研究文章图片'}" class="w-full h-full object-cover transition-transform duration-700 group-hover:scale-105">
          <!-- 标签悬浮在图片左上角 -->
          <div class="absolute top-4 left-4">
            <span class="bg-white text-slate-900 text-xs font-bold px-3 py-1 rounded-full uppercase tracking-wider shadow-sm">
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
            <a href="${link}" class="inline-flex items-center text-brand-600 hover:text-brand-700 font-bold text-sm transition-colors group-hover:translate-x-1 duration-300">
              阅读文章
              <i class="fas fa-arrow-right ml-2 text-xs"></i>
            </a>
          </div>
        </div>
      `;
      
      container.appendChild(card);
    });
    
    console.log('研究中心内容加载成功');
  } catch (error) {
    console.error('加载研究文章失败:', error);
    // 显示静态卡片作为备用，保留原有的HTML结构和样式
    container.innerHTML = ''; // 清空容器，让静态卡片保持可见
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
  
  try {
    const res = await fetch('/api/faqs?limit=5'); // Only show top 5 on home
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
        
        // Use inline style for max-height to ensure it starts at 0
        // Move padding/margin to inner div to avoid layout issues when collapsed
        // Explicitly set text color and opacity to ensure visibility
        div.innerHTML = `
            <button class="flex justify-between items-center w-full text-left font-bold text-xl text-slate-900 focus:outline-none group transition-colors duration-300 hover:text-brand-600" onclick="toggleFaq(this)">
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
  }
}

// ========== Success Stories Tab Switching ==========
function switchTab(tabIndex) {
  // Update Buttons
  const buttons = document.querySelectorAll('.tab-btn');
  buttons.forEach(btn => {
    btn.classList.remove('active', 'bg-brand-600', 'text-white', 'shadow-lg');
    btn.classList.add('text-slate-400', 'hover:text-white');
  });

  const activeBtn = document.getElementById(`tab-${tabIndex}-btn`);
  if (activeBtn) {
    activeBtn.classList.remove('text-slate-400', 'hover:text-white');
    activeBtn.classList.add('active', 'bg-brand-600', 'text-white', 'shadow-lg');
  }

  // Update Content
  const contents = document.querySelectorAll('.tab-content');
  contents.forEach(content => {
    content.classList.add('hidden', 'opacity-0', 'translate-y-4');
    content.classList.remove('active', 'opacity-100', 'translate-y-0');
  });

  const activeContent = document.getElementById(`tab-${tabIndex}-content`);
  if (activeContent) {
    activeContent.classList.remove('hidden');
    // Small delay to allow display:block to apply before transition
    setTimeout(() => {
      activeContent.classList.remove('opacity-0', 'translate-y-4');
      activeContent.classList.add('active', 'opacity-100', 'translate-y-0');
    }, 10);
  }
}

// 页面加载自动初始化研究中心与FAQ
window.addEventListener('DOMContentLoaded', () => {
  if (document.getElementById('insights-container')) {
    loadResearchInsights();
  }
  if (document.getElementById('faq-list')) {
    loadFaqData();
  }
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
        gap: 20px;
      }
    }
    
    @media (min-width: 769px) and (max-width: 1024px) {
      #insights-container {
        grid-template-columns: repeat(2, 1fr);
      }
    }
    
    /* FAQ样式已通过Tailwind类在loadFaqData函数中直接控制，此处不再重复定义 */
  `;
  
  const styleElement = document.createElement('style');
  styleElement.textContent = insightsStyles;
  document.head.appendChild(styleElement);
}

// ========== 统一的DOM加载完成事件监听器 ==========
window.addEventListener('DOMContentLoaded', () => {
  console.log('页面DOM加载完成，开始初始化...');
  
  // 为所有导航链接添加平滑滚动
  const navLinks = document.querySelectorAll('a[href^="#"]');
  navLinks.forEach(smoothScroll);
  
  // 导航栏滚动阴影
  window.addEventListener('scroll', function() {
    const navbar = document.getElementById('navbar');
    if (navbar) {
      if (window.scrollY > 10) {
        navbar.classList.add('shadow-md');
      } else {
        navbar.classList.remove('shadow-md');
      }
    }
  });
  
  // 加载研究中心内容
  loadResearchInsights();
  
  // 加载FAQ内容
  loadFaqData();
  
  // 设置定时更新研究文章（5分钟更新一次）
  setInterval(loadResearchInsights, 5 * 60 * 1000);
  
  // 当页面从隐藏状态变为显示状态时，刷新数据
  document.addEventListener('visibilitychange', function() {
    if (!document.hidden) {
      console.log('页面恢复显示，刷新数据...');
      loadResearchInsights();
    }
  });
  
  console.log('初始化完成，等待数据加载...');
});

// 添加响应式样式
addResponsiveStyles();

// ========== 标题悬停交互 (Custom Tooltip Logic) ==========
function initTitleTooltip() {
  // Create tooltip element if it doesn't exist
  if (!document.getElementById('custom-title-tooltip')) {
    const tooltip = document.createElement('div');
    tooltip.id = 'custom-title-tooltip';
    document.body.appendChild(tooltip);
  }

  const tooltip = document.getElementById('custom-title-tooltip');
  let activeTarget = null;

  // Function to show tooltip
  const showTooltip = (target) => {
    const titleText = target.getAttribute('data-title');
    // Only show if text exists and is actually truncated (or if we just want to show full text always)
    // Checking truncation is tricky with fonts loading, so we'll show if attribute exists.
    // User requirement: "Show full title... ensure visible".
    if (!titleText) return;

    tooltip.textContent = titleText;
    
    // Position calculation
    const rect = target.getBoundingClientRect();
    
    // Calculate position: align with left of title, slightly above or covering
    // Let's position it exactly over the title to simulate "expansion", but slightly adjusted for padding
    // Styles.css has padding 0.5rem 0.75rem.
    // We want the text inside tooltip to align with text inside h3.
    // h3 has no padding, but maybe parent div has padding.
    
    // Simple approach: Position top-left of the element
    let top = rect.top;
    let left = rect.left;

    // Adjust for tooltip padding so text aligns visually? 
    // Or just place it slightly above (-5px) to show it's "popping up"
    top = rect.top - 8; // Slight lift
    left = rect.left - 12; // Slight offset for padding

    // Boundary checks
    // If going off top
    if (top < 10) top = 10;
    // If going off right (width is auto, but max-width 90vw)
    // We can't check tooltip width before it's visible effectively without trickery, 
    // but fixed position + max-width usually handles right edge okay if left is set.
    // Actually, if left + width > window.innerWidth, we need to adjust.
    // Let's just set left/top style.
    
    tooltip.style.top = `${top}px`;
    tooltip.style.left = `${left}px`;
    
    tooltip.classList.add('visible');
    activeTarget = target;
  };

  const hideTooltip = () => {
    tooltip.classList.remove('visible');
    activeTarget = null;
  };

  // Event Delegation
  document.addEventListener('mouseover', (e) => {
    const target = e.target.closest('.research-card-title');
    if (target) {
      // Check if text is actually overflowing?
      // Optimization: Only show if scrollWidth > clientWidth
      // But user said "Show full title", implying always show on hover for consistent interaction.
      // However, showing a tooltip for a short title that is already fully visible might be annoying.
      // Let's check overflow.
      if (target.scrollWidth > target.clientWidth) {
         showTooltip(target);
      }
    } else {
      // If we moved out of a title, hide. 
      // Note: moving into the tooltip itself is impossible because pointer-events: none.
      if (activeTarget) hideTooltip();
    }
  });
  
  // Handle scrolling - hide tooltip to avoid it detaching
  window.addEventListener('scroll', () => {
    if (activeTarget) hideTooltip();
  }, { passive: true });
}

// Initialize tooltip logic
initTitleTooltip();

// ========== Mission & Solution 交互逻辑 ==========
function initMissionInteractions() {
  const missionChallenges = document.getElementById('mission-challenges');
  const missionSolutions = document.getElementById('mission-solutions');

  if (!missionChallenges || !missionSolutions) return;

  const challengeItems = missionChallenges.querySelectorAll('.mission-item');
  const solutionItems = missionSolutions.querySelectorAll('.mission-item');
  const allItems = [...challengeItems, ...solutionItems];

  function handleMouseEnter(e) {
    // 仅在非移动端启用 (宽屏)
    if (window.innerWidth < 768) return;

    const target = e.currentTarget;
    const id = target.getAttribute('data-id');
    
    // 给父容器添加状态类，便于可能的全局样式控制
    missionChallenges.classList.add('mission-list-hovered');
    missionSolutions.classList.add('mission-list-hovered');

    allItems.forEach(item => {
      const itemId = item.getAttribute('data-id');
      if (itemId === id) {
        item.classList.add('active');
        item.classList.remove('dimmed');
      } else {
        item.classList.remove('active');
        item.classList.add('dimmed');
      }
    });
  }

  function handleMouseLeave() {
    missionChallenges.classList.remove('mission-list-hovered');
    missionSolutions.classList.remove('mission-list-hovered');

    allItems.forEach(item => {
      item.classList.remove('active');
      item.classList.remove('dimmed');
    });
  }

  allItems.forEach(item => {
    item.addEventListener('mouseenter', handleMouseEnter);
  });

  // 绑定mouseleave到容器，防止在项目间移动时闪烁
  const missionSection = document.getElementById('mission');
  if (missionSection) {
      missionSection.addEventListener('mouseleave', handleMouseLeave);
  }
}

// 初始化
window.addEventListener('DOMContentLoaded', () => {
    initMissionInteractions();
});

// ========== Social Media Modals (QR Codes) ==========
function initSocialModals() {
    const modals = {
        'wechat-btn': 'wechat-modal',
        'channels-btn': 'channels-modal'
    };

    Object.entries(modals).forEach(([btnId, modalId]) => {
        const btn = document.getElementById(btnId);
        const modal = document.getElementById(modalId);
        
        if (!btn || !modal) return;
        
        const mask = modal.querySelector('.modal-mask');
        const content = modal.querySelector('.modal-content');
        const closeBtn = modal.querySelector('.modal-close');

        // Open Modal
        const openModal = () => {
            modal.classList.remove('hidden');
            modal.classList.add('flex');
            // Small delay for transition
            requestAnimationFrame(() => {
                mask.classList.remove('opacity-0');
                content.classList.remove('opacity-0', 'scale-95');
                content.classList.add('scale-100');
            });
        };

        // Close Modal
        const closeModal = () => {
            mask.classList.add('opacity-0');
            content.classList.remove('scale-100');
            content.classList.add('opacity-0', 'scale-95');
            
            // Wait for transition
            setTimeout(() => {
                modal.classList.remove('flex');
                modal.classList.add('hidden');
            }, 300);
        };

        // Click Event (Desktop & Mobile)
        btn.addEventListener('click', (e) => {
            e.preventDefault();
            e.stopPropagation();
            openModal();
        });

        // Hover Event (Desktop only)
        // User requested: "When mouse hover... show popup"
        // We implement a "Sticky Hover" where entering shows it.
        // But since it has a mask, it acts like a modal. 
        // To avoid annoyance, we might rely on Click mainly, but let's add mouseenter
        // with a check to prevent accidental triggers if the user is just scrolling by.
        // HOWEVER, standard Modal with Mask is best triggered by Click.
        // If we strictly follow "Hover shows Popup", we should probably use a non-modal tooltip.
        // Given the "Mask" and "Close Button" requirement, it IS a modal.
        // Triggering a full modal on hover is bad UX.
        // Compromise: We bind Click. 
        // If strict adherence is needed:
        /*
        btn.addEventListener('mouseenter', () => {
             if (window.innerWidth > 768) openModal();
        });
        */
        // I will stick to Click for robust UX as it fits "Mask/Close" pattern best.
        // If the user insists on Hover trigger for a Modal, I can uncomment the above.

        // Close Events
        closeBtn.addEventListener('click', closeModal);
        mask.addEventListener('click', closeModal);
        
        // Close on Escape key
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape' && !modal.classList.contains('hidden')) {
                closeModal();
            }
        });
    });
}

// Init Social Modals
window.addEventListener('DOMContentLoaded', () => {
    initSocialModals();
});

// ========== Social Media Hover Popups (Replaced Modals) ==========
function initSocialPopups() {
    // Select containers
    const containers = [
        document.getElementById('wechat-container'),
        document.getElementById('channels-container')
    ];

    if (!containers[0] || !containers[1]) return;

    // Mobile Check
    const isMobile = () => window.innerWidth < 768 || 'ontouchstart' in window;

    // Image Preloader & Lazy Load Trigger
    const loadQrImage = (container) => {
        const img = container.querySelector('.lazy-qr');
        if (img && img.dataset.src && !img.src.includes(img.dataset.src)) {
            img.src = img.dataset.src;
        }
    };

    containers.forEach(container => {
        const popup = container.querySelector('.social-popup');
        let timer = null;

        if (!popup) return;

        // Function to show
        const showPopup = () => {
            loadQrImage(container); // Load image on first interaction
            clearTimeout(timer);
            
            // Visual transition
            popup.classList.remove('invisible', 'opacity-0', 'translate-y-2');
            popup.classList.add('visible', 'opacity-100', 'translate-y-0');
        };

        // Function to hide
        const hidePopup = () => {
            timer = setTimeout(() => {
                popup.classList.remove('visible', 'opacity-100', 'translate-y-0');
                popup.classList.add('opacity-0', 'translate-y-2');
                // Wait for transition to finish before hiding completely (for pointer events)
                setTimeout(() => {
                    if (popup.classList.contains('opacity-0')) {
                        popup.classList.add('invisible');
                    }
                }, 300); 
            }, 200); // 200ms debounce before hiding to allow moving mouse to popup
        };

        // Desktop Hover Events
        if (!isMobile()) {
            container.addEventListener('mouseenter', showPopup);
            container.addEventListener('mouseleave', hidePopup);
            
            // Focus management for accessibility
            const btn = container.querySelector('button');
            btn.addEventListener('focus', showPopup);
            btn.addEventListener('blur', hidePopup);
        } else {
            // Mobile: Click to toggle
            const btn = container.querySelector('button');
            btn.addEventListener('click', (e) => {
                e.preventDefault();
                e.stopPropagation();
                
                // Close others
                containers.forEach(c => {
                    if (c !== container) {
                        const p = c.querySelector('.social-popup');
                        p.classList.remove('visible', 'opacity-100', 'translate-y-0');
                        p.classList.add('invisible', 'opacity-0', 'translate-y-2');
                    }
                });

                // Toggle current
                if (popup.classList.contains('opacity-100')) {
                    hidePopup();
                } else {
                    showPopup();
                }
            });

            // Close when clicking outside
            document.addEventListener('click', (e) => {
                if (!container.contains(e.target)) {
                    hidePopup();
                }
            });
        }
    });
}

// Re-initialize (Replace old modal init)
window.addEventListener('DOMContentLoaded', () => {
    // Ensure we don't run double init if possible, but the old one won't find elements anyway
    initSocialPopups();
});
