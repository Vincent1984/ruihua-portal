
// ========== 成功案例 Tab 切换 ==========
function initSuccessStoriesTabs() {
    const tabs = [
        { btnId: 'tab-1-btn', contentId: 'tab-1-content' },
        { btnId: 'tab-2-btn', contentId: 'tab-2-content' }
    ];

    tabs.forEach(tab => {
        const btn = document.getElementById(tab.btnId);
        if (!btn) return;

        btn.addEventListener('click', () => {
            // Deactivate all tabs
            tabs.forEach(t => {
                const b = document.getElementById(t.btnId);
                const c = document.getElementById(t.contentId);
                
                if (b) {
                    b.classList.remove('active', 'bg-brand-600', 'text-white', 'shadow-lg');
                    b.classList.add('text-slate-400', 'hover:text-white');
                    b.setAttribute('aria-selected', 'false');
                }
                
                if (c) {
                    c.classList.add('hidden', 'opacity-0', 'translate-y-4');
                    c.classList.remove('active', 'opacity-100', 'translate-y-0');
                }
            });

            // Activate clicked tab
            btn.classList.add('active', 'bg-brand-600', 'text-white', 'shadow-lg');
            btn.classList.remove('text-slate-400', 'hover:text-white');
            btn.setAttribute('aria-selected', 'true');

            const content = document.getElementById(tab.contentId);
            if (content) {
                content.classList.remove('hidden');
                // Small delay to allow display:block to apply before transition
                requestAnimationFrame(() => {
                    content.classList.add('active', 'opacity-100', 'translate-y-0');
                    content.classList.remove('opacity-0', 'translate-y-4');
                });
            }
        });
    });
}

// 在 DOMContentLoaded 时初始化
document.addEventListener('DOMContentLoaded', () => {
    initSuccessStoriesTabs();
});
