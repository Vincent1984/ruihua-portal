
document.addEventListener('DOMContentLoaded', () => {
    // 1. 成功案例 Tab 切换 (Success Stories Tabs)
    const tabBtns = document.querySelectorAll('.tab-btn');
    const tabContents = document.querySelectorAll('.tab-content');

    // 如果页面上有 Tab 按钮，初始化切换逻辑
    if (tabBtns.length > 0) {
        tabBtns.forEach(btn => {
            btn.addEventListener('click', () => {
                // 移除所有按钮的 active 状态
                tabBtns.forEach(b => {
                    b.classList.remove('active', 'bg-brand-600', 'text-white', 'shadow-lg');
                    b.classList.add('text-slate-400', 'hover:text-white');
                    b.setAttribute('aria-selected', 'false');
                });

                // 激活当前按钮
                btn.classList.add('active', 'bg-brand-600', 'text-white', 'shadow-lg');
                btn.classList.remove('text-slate-400', 'hover:text-white');
                btn.setAttribute('aria-selected', 'true');

                // 隐藏所有内容
                tabContents.forEach(content => {
                    content.classList.add('hidden', 'opacity-0', 'translate-y-4');
                    content.classList.remove('active', 'opacity-100', 'translate-y-0');
                });

                // 显示目标内容
                const targetId = btn.getAttribute('aria-controls');
                const targetContent = document.getElementById(targetId);
                if (targetContent) {
                    targetContent.classList.remove('hidden');
                    // 强制重绘以触发动画
                    void targetContent.offsetWidth;
                    targetContent.classList.add('active', 'opacity-100', 'translate-y-0');
                    targetContent.classList.remove('opacity-0', 'translate-y-4');
                }
            });
        });
    }

    // 2. 底部悬浮 CTA (Sticky CTA)
    const cta = document.getElementById('sticky-cta');
    if (cta) {
        window.addEventListener('scroll', () => {
            if (window.scrollY > 500) {
                cta.classList.add('visible');
            } else {
                cta.classList.remove('visible');
            }
        });
    }

    // 3. 移动端菜单控制 (Toggle Mobile Menu)
    // 假设已在 main.js 中定义，如果没有，这里提供一个简易版或与 main.js 配合
    // 这里的 window.toggleMobileMenu 已经在 main.js 中定义，无需重复
});
