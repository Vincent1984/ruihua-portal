// video-detail.js - 视频详情页逻辑
// 功能：加载视频数据、渲染详情、渲染相关推荐

const vd = {
  state: {
    video: null,
    related: [],
    slug: '',
    renderedVideoUrl: null
  },

  getCacheKey() {
    return `rh_video_v1_${this.state.slug}`;
  },

  getRelatedCacheKey() {
    return `rh_video_related_v1_${this.state.slug}`;
  },

  async init() {
    performance.mark('vd_init_start');
    
    this.state.slug = this.getSlug();
    if (!this.state.slug) {
      window.location.href = '/videos/';
      return;
    }

    // 0. 优先使用 SSR 数据 (Highest priority)
    if (window.__VIDEO_DATA__) {
      console.log('[SSR] 使用服务端预渲染数据');
      this.state.video = window.__VIDEO_DATA__;
      
      // 更新本地缓存
      this.saveToCache(this.getCacheKey(), this.state.video);
      
      this.render();
      
      performance.mark('vd_first_paint_ssr');
      performance.measure('FCP_SSR', 'vd_init_start', 'vd_first_paint_ssr');
      const fcpTime = performance.getEntriesByName('FCP_SSR')[0].duration;
      console.log(`[Perf] 首屏SSR加载耗时: ${fcpTime.toFixed(2)}ms`);
      this.reportPerf('FCP_SSR', fcpTime);

      this.loadRelatedDynamic(this.state.video);
      this.loadFaqs();
      this.bind();
      return;
    }

    // 1. 分层加载策略：尝试从本地缓存读取视频元数据（30分钟TTL）实现首屏秒开
    const cachedVideo = this.loadFromCache(this.getCacheKey(), 30 * 60 * 1000);
    if (cachedVideo) {
      console.log('[Cache] 命中本地视频缓存');
      this.state.video = cachedVideo;
      this.render();
      
      performance.mark('vd_first_paint_cache');
      performance.measure('FCP_Cache', 'vd_init_start', 'vd_first_paint_cache');
      const fcpTime = performance.getEntriesByName('FCP_Cache')[0].duration;
      console.log(`[Perf] 首屏缓存加载耗时: ${fcpTime.toFixed(2)}ms`);
      this.reportPerf('FCP_Cache', fcpTime);

      this.loadRelatedDynamic(cachedVideo);
      this.loadFaqs();
      this.fetchAndSyncVideo(this.state.slug, cachedVideo.updatedAt);
    } else {
      this.loadFaqs();
      this.fetchAndSyncVideo(this.state.slug);
    }

    this.bind();
  },

  async loadFaqs() {
    try {
      const faqSection = document.getElementById('faq-section');
      const faqAccordion = document.getElementById('faq-accordion');
      if (!faqSection || !faqAccordion) return;

      // If SSR already rendered video-specific FAQs, don't overwrite
      if (faqSection.getAttribute('data-ssr-rendered') === 'true') {
          return;
      }

      // If client-side has video.faqs, render them instead of global FAQs
      if (this.state.video && this.state.video.faqs && this.state.video.faqs.length > 0) {
          faqAccordion.innerHTML = this.state.video.faqs.map((faq, index) => {
              const isHidden = index >= 3 ? 'hidden video-faq-extra' : '';
              return `
                <div class="border border-slate-200 rounded-xl overflow-hidden bg-white faq-item ${isHidden}">
                  <button class="w-full px-5 py-4 flex items-center justify-between text-left focus:outline-none hover:bg-slate-50 transition-colors" onclick="window.VideoDetail.toggleFaq(this)">
                    <span class="font-bold text-slate-800 text-[15px] pr-4">${faq.question}</span>
                    <i class="fas fa-chevron-down text-slate-400 transition-transform duration-300 transform"></i>
                  </button>
                  <div class="faq-content overflow-hidden transition-all duration-300 ease-in-out max-h-0">
                    <div class="p-5 pt-0 text-slate-600 text-sm leading-relaxed prose prose-sm max-w-none prose-slate border-t border-slate-100 mt-2">
                      ${faq.answer}
                    </div>
                  </div>
                </div>
              `;
          }).join('');
          
          if (this.state.video.faqs.length > 3) {
              faqAccordion.innerHTML += `
                  <div class="mt-4 text-center video-faq-more-container">
                      <button class="text-brand-600 text-sm font-medium hover:text-brand-700" onclick="window.VideoDetail.showAllFaqs(this)">查看更多问答 <i class="fas fa-angle-double-down ml-1"></i></button>
                  </div>
              `;
          }
          faqSection.classList.remove('hidden');
          return;
      }

      // 否则 fallback 请求全局 FAQ
      const res = await this.fetchWithRetry('/api/faqs?status=published&limit=5', {}, 1, 1000);
      const faqs = Array.isArray(res) ? res : (res.data || []);
      
      if (!faqs || faqs.length === 0) return;
      
      // Render Accordion HTML
      faqAccordion.innerHTML = faqs.map((faq, index) => `
        <div class="border border-slate-200 rounded-xl overflow-hidden bg-white faq-item">
          <button class="w-full px-5 py-4 flex items-center justify-between text-left focus:outline-none hover:bg-slate-50 transition-colors" onclick="window.VideoDetail.toggleFaq(this)">
            <span class="font-bold text-slate-800 text-[15px] pr-4">${faq.question}</span>
            <i class="fas fa-chevron-down text-slate-400 transition-transform duration-300 transform"></i>
          </button>
          <div class="faq-content overflow-hidden transition-all duration-300 ease-in-out max-h-0">
            <div class="p-5 pt-0 text-slate-600 text-sm leading-relaxed prose prose-sm max-w-none prose-slate border-t border-slate-100 mt-2">
              ${faq.answer}
            </div>
          </div>
        </div>
      `).join('');
      
      faqSection.classList.remove('hidden');
    } catch (e) {
      console.error('[Error] 加载FAQ失败', e);
    }
  },

  showAllFaqs(btn) {
      document.querySelectorAll('.video-faq-extra').forEach(el => {
          el.classList.remove('hidden');
          // simple fade-in
          el.style.opacity = 0;
          setTimeout(() => { el.style.transition = 'opacity 0.3s'; el.style.opacity = 1; }, 10);
      });
      const container = btn.closest('.video-faq-more-container');
      if (container) container.remove();
  },

  toggleFaq(btn) {
    const currentItem = btn.closest('.faq-item');
    const content = currentItem.querySelector('.faq-content');
    const icon = btn.querySelector('i');
    
    const isExpanded = content.style.maxHeight && content.style.maxHeight !== '0px';
    
    // Close all other FAQs
    document.querySelectorAll('.faq-item').forEach(item => {
      if (item !== currentItem) {
        const otherContent = item.querySelector('.faq-content');
        const otherIcon = item.querySelector('button i');
        if (otherContent) otherContent.style.maxHeight = '0px';
        if (otherIcon) otherIcon.style.transform = 'rotate(0deg)';
      }
    });
    
    // Toggle current
    if (isExpanded) {
      content.style.maxHeight = '0px';
      if (icon) icon.style.transform = 'rotate(0deg)';
    } else {
      // Temporarily set to auto to get the real unconstrained height, then animate
      content.style.maxHeight = 'none';
      const realHeight = content.scrollHeight;
      content.style.maxHeight = '0px'; // Reset for animation
      // Force reflow
      content.offsetHeight;
      content.style.maxHeight = (realHeight + 20) + 'px'; // +20 for padding safety
      if (icon) icon.style.transform = 'rotate(180deg)';
    }
  },

  getSlug() {
    const path = window.location.pathname;
    const parts = path.split('/').filter(p => p);
    if (parts.includes('video')) {
      const idx = parts.indexOf('video');
      return parts[idx + 1];
    }
    const params = new URLSearchParams(window.location.search);
    return params.get('slug');
  },

  loadFromCache(key, ttl) {
    try {
      const itemStr = localStorage.getItem(key);
      if (!itemStr) return null;
      const item = JSON.parse(itemStr);
      if (Date.now() - item.timestamp > ttl) {
        return null; // Expired
      }
      return item.data;
    } catch (e) {
      return null;
    }
  },

  saveToCache(key, data) {
    try {
      localStorage.setItem(key, JSON.stringify({
        timestamp: Date.now(),
        data: data
      }));
    } catch (e) {
      console.warn('Cache save failed', e);
    }
  },

  // 3. 网络请求重试与指数退避
  async fetchWithRetry(url, options = {}, retries = 3, backoff = 1000) {
    try {
      const controller = new AbortController();
      const id = setTimeout(() => controller.abort(), 8000); // 8秒超时
      const res = await fetch(url, { ...options, signal: controller.signal });
      clearTimeout(id);
      
      if (!res.ok) throw new Error(`HTTP error! status: ${res.status}`);
      return await res.json();
    } catch (e) {
      if (retries > 0) {
        console.warn(`[Retry] Request failed: ${e.message}. Retrying in ${backoff}ms... (${retries} left)`);
        await new Promise(r => setTimeout(r, backoff));
        return this.fetchWithRetry(url, options, retries - 1, backoff * 2);
      }
      throw e;
    }
  },

  async fetchAndSyncVideo(slug, localUpdatedAt = null) {
    try {
      performance.mark('vd_fetch_start');
      const data = await this.fetchWithRetry(`/api/videos/detail/query?slug=${slug}`);
      performance.mark('vd_fetch_end');

      // 4. 数据一致性校验：通过 updatedAt 比较，如果没变则不需要重新渲染DOM
      if (localUpdatedAt && data.updatedAt === localUpdatedAt) {
        console.log('[Sync] 服务端数据无变化，继续使用缓存');
        return;
      }

      console.log('[Sync] 获取到最新数据，更新缓存并渲染');
      this.state.video = data;
      this.saveToCache(this.getCacheKey(), data);
      this.render();

      if (!localUpdatedAt) {
         performance.measure('FCP_Network', 'vd_init_start', 'vd_fetch_end');
         const fcpTime = performance.getEntriesByName('FCP_Network')[0].duration;
         console.log(`[Perf] 首屏网络加载耗时: ${fcpTime.toFixed(2)}ms`);
         this.reportPerf('FCP_Network', fcpTime);
         this.loadRelatedDynamic(data);
         this.loadFaqs();
      }

    } catch (e) {
      console.error('[Error] 加载视频详情失败', e);
      this.reportError('VideoFetchFailed', e.message);

      // 5. 错误降级处理
      if (!this.state.video) {
        document.body.innerHTML = `
          <div class="flex flex-col items-center justify-center min-h-screen text-slate-500 bg-slate-50">
            <i class="fas fa-wifi text-5xl mb-4 text-slate-300"></i>
            <h1 class="text-2xl font-bold mb-2 text-slate-700">网络连接或服务异常</h1>
            <p class="mb-6 text-sm text-slate-500">无法加载视频内容，请检查您的网络连接</p>
            <button onclick="location.reload()" class="px-6 py-2.5 bg-brand-600 text-white font-medium rounded-full shadow-lg hover:bg-brand-700 transition transform hover:-translate-y-0.5">刷新重试</button>
          </div>
        `;
      }
    }
  },

  async loadRelatedDynamic(videoData) {
    if (!videoData || !videoData._id) return;
    try {
      const url = `/api/videos/${videoData._id}/related?limit=4`;
      const res = await this.fetchWithRetry(url, {}, 1, 1000); // 推荐内容最多重试1次
      const list = res && res.data ? res.data : [];
      
      this.state.related = list;
      this.renderRelated();
    } catch (e) {
      console.error('[Error] 加载推荐视频失败', e);
      this.reportError('RelatedVideosFetchFailed', e.message);
      this.state.related = [];
      this.renderRelated();
    }
  },

  reportPerf(metric, value) {
      // Placeholder for analytics endpoint
      console.log(`[Analytics] ${metric}: ${value}`);
  },

  reportError(type, msg) {
      console.error(`[Monitor] Error: ${type} - ${msg}`);
      // fetch('/api/monitor/error', { method: 'POST', body: JSON.stringify({ type, msg, url: location.href }) }).catch(()=>{});
  },

  render() {
    const v = this.state.video;
    if (!v) return;

    // Client-side SEO update
    const baseTitle = v.metaTitle ? v.metaTitle : v.title;
    document.title = baseTitle.endsWith('- 瑞华智策') ? baseTitle : `${baseTitle} - 瑞华智策`;
    const upsertMeta = (name, content) => {
      if (!content) return;
      let meta = document.querySelector(`meta[name="${name}"]`);
      if (!meta) {
        meta = document.createElement('meta');
        meta.setAttribute('name', name);
        document.head.appendChild(meta);
      }
      meta.setAttribute('content', content);
    };
    upsertMeta('description', v.metaDescription ? v.metaDescription : (v.description || v.title));
    
    // Check if we need to add keywords
    if (v.seoKeywords && v.seoKeywords.length > 0) {
        upsertMeta('keywords', v.seoKeywords.join(','));
    }
    if (v.geoSummary) {
        upsertMeta('ai-summary', v.geoSummary);
    }

    // Breadcrumb and Title
    document.getElementById('breadcrumb-title').textContent = v.title;
    document.getElementById('video-title').textContent = v.title;
    document.getElementById('video-date').textContent = new Date(v.publishDate).toLocaleDateString('zh-CN');
    document.getElementById('video-views').textContent = (v.views || 0).toLocaleString();
    document.getElementById('video-duration').textContent = v.duration || '00:00';
    
    // Inject GEO Summary if available
    const contentEl = document.getElementById('video-content');
    if (contentEl) {
        let fullContent = '';
        if (v.geoSummary) {
            fullContent += `
                <div class="bg-gradient-to-r from-brand-50 to-purple-50 rounded-xl p-5 mb-6 border border-brand-100 shadow-sm relative">
                    <div class="flex items-center gap-1.5 mb-2">
                        <i class="far fa-lightbulb text-brand-600 text-xs"></i>
                        <h3 class="text-brand-800 font-bold text-xs m-0 leading-none">内容摘要</h3>
                    </div>
                    <p class="text-slate-700 text-xs leading-relaxed m-0">${v.geoSummary}</p>
                </div>
            `;
        }
        fullContent += v.content || v.description || '暂无详细介绍';
        contentEl.innerHTML = fullContent;
    }

    // Tags
    const tagContainer = document.getElementById('video-tags');
    if (v.tags && v.tags.length > 0) {
      tagContainer.innerHTML = v.tags.map(t => `<span class="px-2.5 py-1 bg-brand-50 text-brand-700 text-xs font-semibold rounded-lg">${t}</span>`).join('');
    } else {
      const catMap = {
        'demo': '产品演示',
        'interview': '专家访谈',
        'case': '客户案例',
        'replay': '直播回放'
      };
      tagContainer.innerHTML = `<span class="px-2.5 py-1 bg-brand-50 text-brand-700 text-xs font-semibold rounded-lg">${catMap[v.category] || '精选'}</span>`;
    }

    // Video Player
    const playerContainer = document.getElementById('video-container');
    if (v.embedCode) {
      playerContainer.innerHTML = v.embedCode;
    } else {
      // 避免重复初始化相同视频源的播放器
      if (this.state.renderedVideoUrl === v.videoUrl && this.dp) {
         return; // Url unchanged, player already exists
      }
      this.state.renderedVideoUrl = v.videoUrl;

      const poster = v.thumbnail || `https://picsum.photos/seed/${v.slug}/1200/600`;
      
      // Clear container and create DPlayer mounting point
      playerContainer.innerHTML = `<div id="dplayer-container" class="w-full h-full"></div>`;
      
      // Clean up URL and remove potential duplicate encoding
      // We only encode the pathname part of the URL, not the entire URL string,
      // to avoid breaking query parameters (like signature/auth tokens) or the protocol/host.
      let safeUrl = v.videoUrl;
      try {
          const urlObj = new URL(v.videoUrl);
          // Decode first to prevent double encoding, then encode only the pathname
          const decodedPath = decodeURI(urlObj.pathname);
          urlObj.pathname = encodeURI(decodedPath);
          safeUrl = urlObj.toString();
      } catch (e) {
          // Fallback if URL parsing fails
          safeUrl = encodeURI(v.videoUrl).replace(/%25/g, '%');
      }

      // Determine video type based on URL extension for HLS/FLV support
      let videoType = 'auto';
      if (safeUrl.includes('.m3u8')) videoType = 'hls';
      else if (safeUrl.includes('.flv')) videoType = 'flv';
      else if (safeUrl.includes('.mp4') || safeUrl.includes('.mov')) videoType = 'auto';

      const initPlayer = (retryCount = 0) => {
        if (typeof DPlayer === 'undefined') {
          if (retryCount > 50) { // 5秒超时 (50 * 100ms)
              console.error('[Player] DPlayer 库加载超时');
              playerContainer.innerHTML = `
                <div class="flex flex-col items-center justify-center h-full text-slate-500">
                    <i class="fas fa-video-slash text-4xl mb-3"></i>
                    <p>播放器核心库加载失败，请检查网络</p>
                    <button onclick="location.reload()" class="mt-4 px-4 py-2 bg-brand-600 text-white rounded-lg text-sm hover:bg-brand-700 transition">刷新重试</button>
                </div>
              `;
              return;
          }
          console.warn('DPlayer not loaded yet, retrying...', retryCount);
          setTimeout(() => initPlayer(retryCount + 1), 100);
          return;
        }

        try {
            if (this.dp) {
                this.dp.destroy();
            }

            console.log(`[Player] 初始化视频: ${safeUrl}, 类型: ${videoType}`);
            performance.mark('player_init_start');

            this.dp = new DPlayer({
                container: document.getElementById('dplayer-container'),
                autoplay: false,
                theme: '#2563eb', // brand-600
                loop: false,
                lang: 'zh-cn',
                screenshot: false,
                hotkey: true,
                preload: 'auto',
                volume: 0.7,
                mutex: true,
                video: {
                    // Fix potential URL encoding issues by encoding the URL properly before passing to player
                    url: safeUrl, 
                    pic: poster,
                    type: videoType,
                    crossOrigin: 'anonymous'
                },
                // Optional: Add context menu for branding
                contextmenu: [
                    {
                        text: '瑞华智策视频中心',
                        link: 'https://ruihuaconsulting.com'
                    }
                ]
            });

            // --- 5. 错误处理增强：加载超时机制 ---
            let loadTimeoutId = null;
            let isLoaded = false;
            let videoRetryCount = 0;
            const MAX_RETRIES = 3;

            const startTimeoutCheck = () => {
                if (loadTimeoutId) clearTimeout(loadTimeoutId);
                // 30秒加载超时
                loadTimeoutId = setTimeout(() => {
                    if (!isLoaded) {
                        console.error('[Player] 视频加载超时 (30s)');
                        handleVideoError('加载超时');
                    }
                }, 30000);
            };

            const handleVideoError = (reason) => {
                if (videoRetryCount < MAX_RETRIES) {
                    videoRetryCount++;
                    console.warn(`[Player] ${reason}，正在进行第 ${videoRetryCount} 次重试...`);
                    // 尝试切换到 auto 类型作为 fallback
                    if (videoRetryCount === 2 && videoType !== 'auto') {
                        console.log('[Player] 降级: 尝试使用浏览器原生解码器');
                        this.dp.switchVideo({ url: safeUrl, type: 'auto', pic: poster });
                    } else {
                        this.dp.switchVideo({ url: safeUrl, type: videoType, pic: poster });
                    }
                    startTimeoutCheck();
                    return;
                }

                console.error('[DPlayer Error] 视频最终加载失败', { url: safeUrl, reason });
                if (loadTimeoutId) clearTimeout(loadTimeoutId);
                
                const container = document.getElementById('dplayer-container');
                if (container) {
                    const errorOverlay = document.createElement('div');
                    errorOverlay.className = 'absolute inset-0 bg-black/90 flex flex-col items-center justify-center text-white z-50';
                    errorOverlay.innerHTML = `
                        <i class="fas fa-exclamation-triangle text-5xl text-red-500 mb-4 animate-pulse"></i>
                        <h3 class="text-xl font-bold mb-2">视频加载失败</h3>
                        <p class="text-sm text-slate-400 mb-6">请检查网络连接或稍后重试 (${reason})</p>
                        <div class="flex gap-4">
                            <button onclick="location.reload()" class="px-5 py-2.5 bg-brand-600 rounded-lg text-sm font-medium hover:bg-brand-700 transition shadow-lg">强制刷新页面</button>
                        </div>
                    `;
                    container.appendChild(errorOverlay);
                }
            };

            // 监听视频元数据加载完成（首帧准备好）
            this.dp.on('loadedmetadata', () => {
                isLoaded = true;
                if (loadTimeoutId) clearTimeout(loadTimeoutId);
                performance.mark('player_first_frame');
                performance.measure('Player_First_Frame', 'player_init_start', 'player_first_frame');
                const pTime = performance.getEntriesByName('Player_First_Frame')[0].duration;
                console.log(`[Perf] 视频首帧/元数据加载完成耗时: ${pTime.toFixed(2)}ms`);
                this.reportPerf('Player_First_Frame', pTime);
            });

            // 监听 DPlayer 原生错误
            this.dp.on('error', () => {
                handleVideoError('媒体流解析错误/404/跨域');
            });

            // 开始加载时启动超时监控
            this.dp.on('loadstart', () => {
                startTimeoutCheck();
            });

            // 如果设置了 auto preload，立即启动检查
            if (this.dp.options.preload === 'auto') {
                startTimeoutCheck();
            }

        } catch (err) {
            console.error('[Player] 初始化发生严重异常:', err);
            playerContainer.innerHTML = `
                <div class="flex flex-col items-center justify-center h-full text-slate-500 bg-slate-50">
                    <i class="fas fa-video-slash text-4xl mb-3 text-slate-300"></i>
                    <p class="font-medium">播放器引擎崩溃</p>
                    <p class="text-xs mt-1 text-slate-400">${err.message}</p>
                </div>
            `;
        }
      };

      initPlayer();
    }

    // Speaker Info
    const speakerSection = document.getElementById('speaker-section');
    if (speakerSection) {
      if (v.speakers && v.speakers.length > 0 && v.speakers[0].authorId) {
        const author = v.speakers[0].authorId;
        speakerSection.classList.remove('hidden');
        speakerSection.classList.add('flex');
        document.getElementById('speaker-avatar').src = author.avatar || '/images/vincent.png';
        document.getElementById('speaker-avatar').alt = author.name;
        document.getElementById('speaker-name').textContent = author.name;
        document.getElementById('speaker-title').textContent = author.desc || v.speakers[0].role || '专家讲师';
        
        let detailText = author.detail ? author.detail.replace(/<[^>]*>?/gm, '') : '';
        document.getElementById('speaker-desc').textContent = detailText || `本次视频由 ${author.name} 担任讲师，深入解析行业洞见。`;
      } else if (v.speakerName) {
        speakerSection.classList.remove('hidden');
        speakerSection.classList.add('flex');
        document.getElementById('speaker-avatar').src = v.speakerAvatar || '/images/vincent.png';
        document.getElementById('speaker-avatar').alt = v.speakerName;
        document.getElementById('speaker-name').textContent = v.speakerName;
        document.getElementById('speaker-title').textContent = v.speakerTitle || '特邀嘉宾';
        document.getElementById('speaker-desc').textContent = v.speakerDesc || `本次视频由 ${v.speakerName} 担任讲师/分享嘉宾，深入解析行业洞见。`;
      } else {
        speakerSection.classList.add('hidden');
        speakerSection.classList.remove('flex');
      }
    }

    // Productivity Ad Banner
    const productivityAd = document.getElementById('productivity-ad-banner');
    if (productivityAd) {
      if (v.showProductivityAd === false) {
        productivityAd.classList.add('hidden');
      } else {
        productivityAd.classList.remove('hidden');
      }
    }
  },
  renderRelated() {
    const container = document.getElementById('related-videos');
    if (!container) return;
    
    // If SSR already rendered related videos, don't overwrite
    if (container.getAttribute('data-ssr-rendered') === 'true' && this.state.related.length === 0) {
        return;
    }
    
    if (this.state.related.length === 0) {
      container.innerHTML = '<p class="text-slate-400 text-sm">暂无推荐内容</p>';
      return;
    }
    container.innerHTML = this.state.related.map(v => `
      <a href="/video/${v.slug}/" class="group flex gap-3 items-start p-2 rounded-xl hover:bg-white transition-colors">
        <div class="relative w-24 h-16 rounded-lg overflow-hidden shrink-0 border border-slate-100">
          <img src="${v.thumbnail || `https://picsum.photos/seed/${v.slug}/240/160`}" alt="${v.title}" class="w-full h-full object-cover transition-transform group-hover:scale-110">
          <div class="absolute bottom-1 right-1 px-1 bg-black/60 text-[10px] text-white rounded">${v.duration || '00:00'}</div>
        </div>
        <div class="min-w-0">
          <h4 class="text-sm font-bold text-slate-900 line-clamp-2 leading-snug group-hover:text-brand-600 transition-colors">${v.title}</h4>
          <p class="text-[10px] text-slate-500 mt-1">${new Date(v.publishDate).toLocaleDateString('zh-CN')}</p>
        </div>
      </a>
    `).join('');
  },
  bind() {
    // Form submission
    const form = document.getElementById('lead-form');
    if (form) {
      form.addEventListener('submit', (e) => {
        e.preventDefault();
        alert('提交成功！我们的专家将尽快联系您。');
        form.reset();
      });
    }
  }
};

window.VideoDetail = vd; // Expose to global scope for inline onclick handlers

document.addEventListener('DOMContentLoaded', () => vd.init());
