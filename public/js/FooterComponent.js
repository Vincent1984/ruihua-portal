// FooterComponent.js
// 瑞华智策官网 - 公共页脚组件
// 使用原生 JavaScript 模块化，无框架依赖

export class FooterComponent {
    constructor() {
        this.currentYear = new Date().getFullYear();
    }

    // 渲染页脚到指定容器
    // containerSelector: CSS选择器，默认为 '#footer-container'
    render(containerSelector = '#footer-container') {
        const container = document.querySelector(containerSelector);
        if (!container) {
            console.error(`Footer container '${containerSelector}' not found.`);
            return;
        }

        const footerHTML = `
        <footer class="bg-slate-900 pt-16 pb-8 text-white">
            <div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
                <div class="flex flex-col md:flex-row justify-between gap-10 mb-10">
                    <div class="md:max-w-xl text-left">
                        <a href="/" class="inline-block mb-4">
                            <img src="/images/logo.png" alt="瑞华智策" class="footer-logo block h-10 w-auto">
                        </a>
                        <p class="text-slate-400 text-sm mb-4">瑞华智策以「咨询+技术+服务」三位一体的模式，助力企业构建「人力资本价值经营」体系，打造 AI 时代持续增长的韧性组织。</p>
                        <div class="flex items-center gap-2 text-sm text-slate-500"><i class="fas fa-building"></i><span>人瑞人才</span><span class="text-brand-400 font-medium">(6919.HK)</span><span>旗下全资子公司</span></div>
                    </div>
                    <div>
                        <h4 class="font-bold text-white mb-4">联系我们</h4>
                        <ul class="space-y-2 text-sm text-slate-400 mb-4">
                            <li class="flex items-center gap-2"><i class="fas fa-envelope text-brand-400"></i><a href="mailto:rxzj@renruihr.com" class="hover:text-white transition">rxzj@renruihr.com</a></li>
                            <li class="flex items-center gap-2"><i class="fas fa-phone text-brand-400"></i><a href="/productivity/" class="hover:text-white transition">预约专家咨询</a></li>
                            <li class="flex items-center gap-2"><i class="fas fa-location-dot text-brand-400"></i><span>上海 · 北京 · 深圳 · 成都</span></li>
                        </ul>
                        <div class="flex gap-4 relative">
                            <!-- Wechat -->
                            <div class="relative group" id="wechat-container">
                                <button class="w-10 h-10 bg-white/10 rounded-lg flex items-center justify-center hover:bg-brand-600 transition relative z-10" aria-label="关注微信公众号">
                                    <i class="fab fa-weixin"></i>
                                </button>
                                <!-- Hover Popup -->
                                <div class="absolute bottom-full left-1/2 -translate-x-1/2 mb-4 w-64 bg-white rounded-2xl shadow-2xl p-6 opacity-0 invisible transform translate-y-2 transition-all duration-300 z-50 social-popup origin-bottom pointer-events-none group-hover:pointer-events-auto">
                                    <div class="text-center">
                                        <h3 class="text-lg font-bold text-slate-900 mb-1">关注微信公众号</h3>
                                        <p class="text-xs text-slate-500 mb-4">获取最新人力资本洞察</p>
                                        <div class="bg-slate-50 p-2 rounded-xl mb-2">
                                            <img data-src="/images/mpweixin.jpg" alt="微信公众号二维码" class="w-full h-auto rounded-lg lazy-qr">
                                        </div>
                                        <p class="text-xs text-slate-400">扫一扫或搜索"人力资本价值经营"</p>
                                    </div>
                                    <!-- Arrow -->
                                    <div class="absolute -bottom-2 left-1/2 -translate-x-1/2 w-4 h-4 bg-white rotate-45"></div>
                                </div>
                            </div>

                            <!-- Video Channel -->
                            <div class="relative group" id="channels-container">
                                <button class="w-10 h-10 bg-white/10 rounded-lg flex items-center justify-center hover:bg-brand-600 transition relative z-10 overflow-hidden" aria-label="关注视频号">
                                    <img src="/images/channels.png" alt="视频号" class="w-full h-full object-cover">
                                </button>
                                <!-- Hover Popup -->
                                <div class="absolute bottom-full left-1/2 -translate-x-1/2 mb-4 w-64 bg-white rounded-2xl shadow-2xl p-6 opacity-0 invisible transform translate-y-2 transition-all duration-300 z-50 social-popup origin-bottom pointer-events-none group-hover:pointer-events-auto">
                                    <div class="text-center">
                                        <h3 class="text-lg font-bold text-slate-900 mb-1">关注视频号</h3>
                                        <p class="text-xs text-slate-500 mb-4">观看专家深度解读视频</p>
                                        <div class="bg-slate-50 p-2 rounded-xl mb-2">
                                            <img data-src="/images/channels.jpg" alt="视频号二维码" class="w-full h-auto rounded-lg lazy-qr" onerror="this.src='https://placehold.co/400x400?text=QR+Code'">
                                        </div>
                                        <p class="text-xs text-slate-400">扫一扫关注瑞华智策视频号</p>
                                    </div>
                                    <!-- Arrow -->
                                    <div class="absolute -bottom-2 left-1/2 -translate-x-1/2 w-4 h-4 bg-white rotate-45"></div>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
                <div class="pt-6 border-t border-slate-800 flex flex-col md:flex-row justify-between items-center gap-4">
                    <div class="flex flex-col md:flex-row items-center gap-2 md:gap-4 text-sm text-slate-500">
                        <p>© ${this.currentYear} 瑞华智策 Ruihua Intelligent Strategy. All rights reserved.</p>
                        <span class="hidden md:inline text-slate-700">|</span>
                        <a href="https://beian.miit.gov.cn/" target="_blank" class="hover:text-white transition">沪ICP备12042344号-24</a>
                    </div>
                    <div class="flex gap-6 text-sm text-slate-500"><a href="/privacy.html" class="hover:text-white transition">隐私政策</a></div>
                </div>
            </div>
        </footer>
        `;

        container.innerHTML = footerHTML;

        // 初始化百度统计
        this.initBaiduAnalytics();

        // 初始化页脚交互功能 (社交媒体弹窗等)
        // 检查全局函数是否存在，如果存在则调用
        if (typeof window.initSocialPopups === 'function') {
            window.initSocialPopups();
        } else {
            // 如果是在主脚本加载前调用了渲染，可能需要稍后绑定，或者直接在这里实现简易逻辑
            // 为了保持模块独立性，这里尝试动态绑定，或者假设 main.js 会处理
            // 但最佳实践是组件自己管理交互
            this.initInteractions();
        }
    }

    initBaiduAnalytics() {
        try {
            // 在开发环境或本地预览下不加载统计脚本
            const isDev = location.hostname === 'localhost' || location.hostname === '127.0.0.1';
            if (isDev) return;
            window._hmt = window._hmt || [];
            const hm = document.createElement("script");
            hm.src = "https://hm.baidu.com/hm.js?3302f271fa7fe8d2ddc6176b39359827";
            hm.referrerPolicy = "no-referrer-when-downgrade";
            hm.onload = () => console.log('Baidu Analytics loaded');
            hm.onerror = (e) => console.warn('Baidu Analytics blocked or failed', e);
            const s = document.getElementsByTagName("script")[0];
            s.parentNode.insertBefore(hm, s);
        } catch (e) {
            console.warn('initBaiduAnalytics error', e);
        }
    }

    initInteractions() {
        // 复用 main.js 中的 initSocialPopups 逻辑
        // 这里为了组件独立性，重新实现核心逻辑
        
        const containers = [
            document.getElementById('wechat-container'),
            document.getElementById('channels-container')
        ];

        if (!containers[0] || !containers[1]) return;

        const isMobile = () => window.innerWidth < 768 || 'ontouchstart' in window;

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

            const showPopup = () => {
                loadQrImage(container);
                clearTimeout(timer);
                popup.classList.remove('invisible', 'opacity-0', 'translate-y-2');
                popup.classList.add('visible', 'opacity-100', 'translate-y-0');
            };

            const hidePopup = () => {
                timer = setTimeout(() => {
                    popup.classList.remove('visible', 'opacity-100', 'translate-y-0');
                    popup.classList.add('opacity-0', 'translate-y-2');
                    setTimeout(() => {
                        if (popup.classList.contains('opacity-0')) {
                            popup.classList.add('invisible');
                        }
                    }, 300); 
                }, 200);
            };

            if (!isMobile()) {
                container.addEventListener('mouseenter', showPopup);
                container.addEventListener('mouseleave', hidePopup);
                const btn = container.querySelector('button');
                if (btn) {
                    btn.addEventListener('focus', showPopup);
                    btn.addEventListener('blur', hidePopup);
                }
            } else {
                const btn = container.querySelector('button');
                if (btn) {
                    btn.addEventListener('click', (e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        containers.forEach(c => {
                            if (c !== container) {
                                const p = c.querySelector('.social-popup');
                                if (p) {
                                    p.classList.remove('visible', 'opacity-100', 'translate-y-0');
                                    p.classList.add('invisible', 'opacity-0', 'translate-y-2');
                                }
                            }
                        });
                        if (popup.classList.contains('opacity-100')) {
                            hidePopup();
                        } else {
                            showPopup();
                        }
                    });
                }
                document.addEventListener('click', (e) => {
                    if (!container.contains(e.target)) {
                        hidePopup();
                    }
                });
            }
        });
    }
}
