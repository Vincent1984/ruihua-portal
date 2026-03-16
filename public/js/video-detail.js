// video-detail.js - 视频详情页逻辑
// 功能：加载视频数据、渲染详情、渲染相关推荐

const vd = {
  state: {
    video: null,
    related: []
  },
  async init() {
    const slug = this.getSlug();
    if (!slug) {
      window.location.href = '/videos/';
      return;
    }
    await this.loadVideo(slug);
    this.bind();
  },
  getSlug() {
    // 处理 /video/:slug/ 这种路径
    const path = window.location.pathname;
    const parts = path.split('/').filter(p => p);
    if (parts.includes('video')) {
      const idx = parts.indexOf('video');
      return parts[idx + 1];
    }
    // 兼容 URL 参数模式
    const params = new URLSearchParams(window.location.search);
    return params.get('slug');
  },
  async loadVideo(slug) {
    try {
      const res = await fetch(`/api/videos/detail/query?slug=${slug}`);
      if (!res.ok) throw new Error('Video not found');
      const data = await res.json();
      this.state.video = data;
      this.render();
      this.loadRelated(data.category, data._id);
    } catch (e) {
      console.error('加载视频详情失败', e);
      document.body.innerHTML = '<div class="flex flex-col items-center justify-center min-h-screen text-slate-500"><h1 class="text-2xl font-bold mb-4">视频未找到</h1><a href="/videos/" class="text-brand-600 hover:underline">返回视频中心</a></div>';
    }
  },
  async loadRelated(category, currentId) {
    try {
      const res = await fetch(`/api/videos?category=${category}&limit=4`);
      const data = await res.json();
      const list = Array.isArray(data) ? data : (data.data || []);
      this.state.related = list.filter(v => v._id !== currentId);
      this.renderRelated();
    } catch (e) {
      console.error('加载推荐视频失败', e);
    }
  },
  render() {
    const v = this.state.video;
    if (!v) return;

    // Breadcrumb and Title
    document.title = `${v.title} - 视频中心 - 瑞华智策`;
    document.getElementById('breadcrumb-title').textContent = v.title;
    document.getElementById('video-title').textContent = v.title;
    document.getElementById('video-date').textContent = new Date(v.publishDate).toLocaleDateString('zh-CN');
    document.getElementById('video-views').textContent = (v.views || 0).toLocaleString();
    document.getElementById('video-duration').textContent = v.duration || '00:00';
    document.getElementById('video-content').innerHTML = v.content || v.description || '暂无详细介绍';

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
      const poster = v.thumbnail || `https://picsum.photos/seed/${v.slug}/1200/600`;
      playerContainer.innerHTML = `
        <div class="relative w-full h-full group cursor-pointer" onclick="window.open('${v.videoUrl}', '_blank')">
          <img src="${poster}" alt="${v.title}" class="w-full h-full object-cover">
          <div class="absolute inset-0 bg-black/40 flex items-center justify-center group-hover:bg-black/20 transition-all">
            <div class="w-16 h-16 rounded-full bg-white/90 flex items-center justify-center shadow-2xl transform group-hover:scale-110 transition-transform">
              <i class="fas fa-play text-slate-900 text-xl ml-1"></i>
            </div>
          </div>
          <div class="absolute bottom-6 left-6 right-6">
            <p class="text-white text-sm font-medium opacity-0 group-hover:opacity-100 transition-opacity">点击在外部播放器中打开视频 <i class="fas fa-external-link-alt ml-1"></i></p>
          </div>
        </div>
      `;
    }

    // Speaker Info
    const speakerSection = document.getElementById('speaker-section');
    if (v.speakerName) {
      speakerSection.classList.remove('hidden');
      speakerSection.classList.add('flex');
      document.getElementById('speaker-avatar').src = v.speakerAvatar || '/images/vincent.png';
      document.getElementById('speaker-avatar').alt = v.speakerName;
      document.getElementById('speaker-name').textContent = v.speakerName;
      document.getElementById('speaker-title').textContent = v.speakerTitle || '特邀嘉宾';
      document.getElementById('speaker-desc').textContent = v.speakerDesc || `本次视频由 ${v.speakerName} 担任讲师/分享嘉宾，深入解析行业洞见。`;
    }
  },
  renderRelated() {
    const container = document.getElementById('related-videos');
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

document.addEventListener('DOMContentLoaded', () => vd.init());
