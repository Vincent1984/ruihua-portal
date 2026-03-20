// videos.js - 前端视频中心逻辑
// 功能：分类切换、分页加载、渲染视频卡片与Banner

const vc = {
  state: {
    category: 'all',
    page: 1,
    limit: 9,
    totalPages: 1,
    categories: []
  },
  async init() {
    await this.loadCategories();
    this.loadFeaturedVideo(); // Load featured independently
    await this.loadVideos();
    this.bind();
  },
  bind() {
    const grid = document.getElementById('videos-grid');
    const pager = document.getElementById('videos-pager');
    if (pager) {
      pager.addEventListener('click', (e) => {
        const btn = e.target.closest('button[data-page]');
        if (!btn) return;
        const page = parseInt(btn.dataset.page, 10);
        if (!isNaN(page) && page >= 1 && page <= this.state.totalPages) {
          this.state.page = page;
          this.loadVideos();
        }
      });
    }
    // Tab click
    document.addEventListener('click', (e) => {
      const tab = e.target.closest('[data-cat]');
      if (tab && tab.classList.contains('vc-tab')) {
        const cat = tab.dataset.cat;
        this.state.category = cat;
        this.state.page = 1;
        document.querySelectorAll('.vc-tab').forEach(t => t.classList.remove('active'));
        tab.classList.add('active');
        this.loadVideos();
      }
    });
  },
  async loadCategories() {
    try {
      // Step 1: Try to load from localStorage cache first
      const CACHE_KEY = 'ruihua_video_categories_cache';
      const CACHE_TIME_KEY = 'ruihua_video_categories_cache_time';
      const CACHE_DURATION = 5 * 60 * 1000; // 5 minutes

      let cachedCats = null;
      const cachedTime = localStorage.getItem(CACHE_TIME_KEY);
      if (cachedTime && (Date.now() - parseInt(cachedTime)) < CACHE_DURATION) {
        try {
          cachedCats = JSON.parse(localStorage.getItem(CACHE_KEY));
        } catch (e) {}
      }

      if (cachedCats) {
        this.renderCategoryTabs(cachedCats);
        // Async diff validation
        this.validateAndSyncCategories(cachedCats);
      } else {
        // No cache or expired, fetch directly
        const res = await fetch('/api/video-categories/list');
        const json = await res.json();
        const cats = json.data || [];
        localStorage.setItem(CACHE_KEY, JSON.stringify(cats));
        localStorage.setItem(CACHE_TIME_KEY, Date.now().toString());
        this.renderCategoryTabs(cats);
      }
    } catch (e) {
      console.error('加载视频分类失败', e);
    }
  },
  
  async validateAndSyncCategories(cachedCats) {
    try {
      const res = await fetch('/api/video-categories/list');
      const json = await res.json();
      const latestCats = json.data || [];
      const latestStr = JSON.stringify(latestCats);
      const cachedStr = JSON.stringify(cachedCats);
      
      if (latestStr !== cachedStr) {
        console.warn('[Data Sync] 分类数据存在差异，正在自动修正...');
        localStorage.setItem('ruihua_video_categories_cache', latestStr);
        localStorage.setItem('ruihua_video_categories_cache_time', Date.now().toString());
        this.renderCategoryTabs(latestCats);
      }
    } catch (e) {
      console.error('分类数据一致性校验失败', e);
    }
  },

  renderCategoryTabs(cats) {
    const formattedCats = cats.map(c => ({
      code: c._id || c.code,
      name: c.name,
      icon: c.icon
    }));
    const tabs = [{ code: 'all', name: '全部', icon: 'fa-layer-group' }, ...formattedCats];
    
    // 为每个分类分配一个图标（如果 API 没给的话）
    const iconMap = {
      'demo': 'fa-desktop',
      'interview': 'fa-microphone-lines',
      'case': 'fa-briefcase',
      'replay': 'fa-clock-rotate-left'
    };

    this.state.categories = tabs;
    const container = document.getElementById('video-tabs');
    if (!container) return;
    
    // Remember current active tab code to re-apply it
    const activeCode = this.state.category || 'all';

    container.innerHTML = tabs.map((c, i) => `
      <button class="vc-tab tab-btn ${c.code === activeCode ? 'active' : ''}" data-cat="${c.code}" aria-selected="${c.code === activeCode ? 'true' : 'false'}">
        <i class="fas ${c.icon || iconMap[c.code] || 'fa-tag'} text-xs"></i>
        ${c.name}
      </button>
    `).join('');
  },
  async loadFeaturedVideo() {
    const banner = document.getElementById('video-hero');
    if (!banner) return;
    
    const CACHE_KEY = 'ruihua_video_featured_cache';
    const CACHE_TIME_KEY = 'ruihua_video_featured_cache_time';
    const CACHE_DURATION = 5 * 60 * 1000; // 5 minutes
    
    let featuredVideo = null;
    const cachedTime = localStorage.getItem(CACHE_TIME_KEY);
    if (cachedTime && (Date.now() - parseInt(cachedTime)) < CACHE_DURATION) {
      try {
        featuredVideo = JSON.parse(localStorage.getItem(CACHE_KEY));
      } catch (e) {}
    }
    
    if (featuredVideo) {
      this.renderBanner(featuredVideo);
    }
    
    // Fetch latest in background or if no cache
    try {
      const res = await fetch('/api/videos?featured=true&limit=1');
      const data = await res.json();
      const list = Array.isArray(data) ? data : (data.data || []);
      const latestVideo = list.length > 0 ? list[0] : null;
      
      // Update cache and UI if changed or first load
      const latestStr = JSON.stringify(latestVideo);
      const cachedStr = JSON.stringify(featuredVideo);
      
      if (latestStr !== cachedStr) {
        if (latestVideo) {
          localStorage.setItem(CACHE_KEY, latestStr);
          localStorage.setItem(CACHE_TIME_KEY, Date.now().toString());
          this.renderBanner(latestVideo);
        } else {
          localStorage.removeItem(CACHE_KEY);
          banner.style.display = 'none';
        }
      } else if (!latestVideo) {
         banner.style.display = 'none';
      }
    } catch (e) {
      console.error('加载推荐视频失败', e);
      if (!featuredVideo) {
        banner.style.display = 'none';
      }
    }
  },
  async loadVideos() {
    const grid = document.getElementById('videos-grid');
    const pager = document.getElementById('videos-pager');
    if (!grid) return;
    grid.innerHTML = `
      <div class="col-span-full flex justify-center items-center py-16">
        <div class="text-center">
          <div class="inline-block w-8 h-8 border-4 border-brand-500 border-t-transparent rounded-full animate-spin mb-4"></div>
          <p class="text-slate-600">加载中...</p>
        </div>
      </div>
    `;
    try {
      const params = new URLSearchParams();
      params.set('limit', this.state.limit);
      params.set('page', this.state.page);
      if (this.state.category && this.state.category !== 'all') params.set('category', this.state.category);
      const res = await fetch(`/api/videos?${params.toString()}`);
      const data = await res.json();
      const list = Array.isArray(data) ? data : (data.data || []);
      const pagination = Array.isArray(data) ? null : (data.pagination || null);
      if (pagination) {
        this.state.totalPages = pagination.pages || 1;
      } else {
        this.state.totalPages = 1;
      }
      // Render
      if (!list || list.length === 0) {
        grid.innerHTML = `
          <div class="col-span-full text-center py-16 text-slate-500">
            暂无视频内容
          </div>
        `;
        if (pager) pager.innerHTML = '';
        return;
      }
      grid.innerHTML = list.map(v => this.cardHtml(v)).join('');
      if (pager) pager.innerHTML = this.pagerHtml(this.state.page, this.state.totalPages);
    } catch (e) {
      console.error('加载视频失败', e);
      grid.innerHTML = `<div class="col-span-full text-center py-16 text-slate-500">加载失败，请刷新重试</div>`;
      if (pager) pager.innerHTML = '';
    }
  },
  renderBanner(video) {
    const banner = document.getElementById('video-hero');
    if (!banner || !video) return;
    banner.style.display = 'block';
    const cover = video.thumbnail || `https://picsum.photos/seed/${video.slug || video._id || Date.now()}/1200/600`;
    const title = video.title || '精选视频';
    const desc = video.description || '精选视频内容推荐';
    const href = `/video/${video.slug}/`;
    banner.innerHTML = `
      <div class="relative rounded-3xl overflow-hidden bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900">
        <div class="absolute inset-0 opacity-30">
          <img src="${cover}" alt="${title}" class="w-full h-full object-cover blur-sm scale-110">
        </div>
        <div class="relative z-10 max-w-7xl mx-auto px-6 py-16 lg:py-24 grid md:grid-cols-2 gap-8 items-center">
          <div>
            <span class="inline-flex items-center gap-2 py-1.5 px-3 rounded-full bg-white/10 text-brand-200 text-xs font-bold tracking-widest uppercase mb-4">
              Video Center
            </span>
            <h1 class="text-3xl md:text-4xl font-extrabold text-white mb-4">${title}</h1>
            <p class="text-slate-200/90 leading-relaxed mb-6">${desc}</p>
            <div class="flex gap-3">
              <a href="${href}" class="bg-brand-600 hover:bg-brand-700 text-white px-6 py-3 rounded-xl font-bold shadow-lg transition hover:-translate-y-0.5 inline-flex items-center gap-2">
                立即观看 <i class="fas fa-play text-xs"></i>
              </a>
            </div>
          </div>
          <div class="relative group cursor-pointer" onclick="window.location.href='${href}'">
            <div class="aspect-video rounded-2xl overflow-hidden shadow-2xl ring-1 ring-white/10 relative">
              <img src="${cover}" alt="${title}" class="w-full h-full object-cover transition-transform duration-700 group-hover:scale-105">
              <div class="absolute inset-0 flex items-center justify-center bg-black/20 group-hover:bg-black/10 transition-colors">
                <div class="w-16 h-16 rounded-full bg-white/90 flex items-center justify-center shadow-2xl transform group-hover:scale-110 transition-transform">
                  <i class="fas fa-play text-slate-900 text-xl ml-1"></i>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    `;
  },
  cardHtml(v) {
    const cover = v.thumbnail || `https://picsum.photos/seed/${v.slug || v._id}/600/360`;
    const duration = v.duration || '';
    const title = v.title || '';
    const desc = v.description || '';
    const playLink = `/video/${v.slug}/`;
    return `
      <article class="group bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden hover:shadow-xl transition-all duration-300 hover:-translate-y-0.5 flex flex-col h-full cursor-pointer" onclick="window.location.href='${playLink}'">
        <div class="relative aspect-video overflow-hidden">
          <img src="${cover}" alt="${title}" class="w-full h-full object-cover transition-transform duration-700 group-hover:scale-105">
          <div class="absolute inset-0 bg-gradient-to-t from-black/40 to-transparent opacity-0 group-hover:opacity-100 transition-opacity"></div>
          <div class="absolute bottom-3 right-3">
            ${duration ? `<span class="text-xs px-2 py-1 bg-black/70 text-white rounded">${duration}</span>` : ''}
          </div>
          <div class="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
            <div class="w-12 h-12 rounded-full bg-white/90 flex items-center justify-center shadow-lg">
              <i class="fas fa-play text-slate-900"></i>
            </div>
          </div>
        </div>
        <div class="p-5 flex flex-col flex-grow">
          <h3 class="font-bold text-slate-900 mb-2 line-clamp-2 group-hover:text-brand-600 transition-colors">${title}</h3>
          <p class="text-slate-500 text-sm line-clamp-2 mb-4">${desc}</p>
          <div class="mt-auto flex justify-end">
            <span class="text-brand-600 hover:text-brand-700 text-sm font-semibold inline-flex items-center gap-1">
              查看详情 <i class="fas fa-arrow-right text-xs"></i>
            </span>
          </div>
        </div>
      </article>
    `;
  },
  pagerHtml(page, pages) {
    if (pages <= 1) return '';
    const items = [];
    const max = pages;
    const prev = Math.max(1, page - 1);
    const next = Math.min(max, page + 1);
    items.push(`<button class="px-3 py-2 rounded-lg border text-slate-700 hover:bg-slate-50" data-page="${prev}">上一页</button>`);
    for (let p = 1; p <= max; p++) {
      items.push(`<button class="px-3 py-2 rounded-lg ${p === page ? 'bg-brand-600 text-white' : 'border text-slate-700 hover:bg-slate-50'}" data-page="${p}">${p}</button>`);
    }
    items.push(`<button class="px-3 py-2 rounded-lg border text-slate-700 hover:bg-slate-50" data-page="${next}">下一页</button>`);
    return `<div class="flex items-center gap-2">${items.join('')}</div>`;
  }
};

document.addEventListener('DOMContentLoaded', () => vc.init());

