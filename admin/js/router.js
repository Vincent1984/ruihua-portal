// ================= Router (Navigation) =================

const ROUTES = [
    { id: 'dashboard', title: '数据看板', load: () => { if(window.setChartRange) window.setChartRange(7); } },
    { id: 'banner', title: 'Banner配置', load: () => { if(window.loadBannerData) window.loadBannerData(); } },
    { id: 'sidebar', title: '文章侧边栏配置', load: () => { if(window.loadSidebarData) window.loadSidebarData(); } },
    { id: 'article', title: '文章管理', load: () => { if(window.loadCategories) window.loadCategories(); if(window.loadArticles) window.loadArticles(); } },
    { id: 'faq', title: 'FAQ 管理', load: () => { if(window.loadFaqs) window.loadFaqs(); } },
    { id: 'appointments', title: '预约管理', load: () => { if(window.loadAppointments) window.loadAppointments(); } },
    { id: 'permissions', title: '权限管理', load: () => { if(window.switchPermTab) window.switchPermTab('users'); } },
    { id: 'logs', title: '操作日志', load: () => { if(window.loadLogs) window.loadLogs(); } }
];

function navigateTo(sectionId) {
    console.log('Navigating to:', sectionId);
    
    // Validate
    const route = ROUTES.find(r => r.id === sectionId);
    if (!route) {
        console.error(`Route ${sectionId} not found`);
        showToast(`无法找到功能模块: ${sectionId}`, 'error');
        return;
    }

    // Update Store
    if (window.appStore) {
        window.appStore.setSection(sectionId);
    }

    // UI Updates
    // Hide all sections
    document.querySelectorAll('.section').forEach(el => el.classList.remove('active'));
    
    // Show target
    const target = document.getElementById(sectionId);
    if (target) {
        target.classList.add('active');
        // Simple fade in
        target.style.animation = 'none';
        target.offsetHeight; /* trigger reflow */
        target.style.animation = 'fadeIn 0.3s ease';
    }

    // Update Nav Active State
    document.querySelectorAll('.menu-item').forEach(el => el.classList.remove('active'));
    const nav = document.getElementById('nav-' + sectionId);
    if (nav) nav.classList.add('active');

    // Update Title
    const titleEl = document.getElementById('page-title');
    if (titleEl) titleEl.textContent = route.title;

    // Mobile Sidebar Handling
    if (window.innerWidth <= 768) {
        const sidebar = document.getElementById('adminSidebar');
        const backdrop = document.getElementById('sidebarBackdrop');
        if (sidebar && sidebar.classList.contains('open')) {
            sidebar.classList.remove('open');
        }
        if (backdrop && backdrop.classList.contains('show')) {
            backdrop.classList.remove('show');
        }
    }

    // Load Data
    try {
        route.load();
    } catch (e) {
        console.error('Error executing route load:', e);
    }

    // Persist
    sessionStorage.setItem('lastSection', sectionId);
    
    // Update URL Hash (Optional, for deep linking)
    // history.pushState(null, null, `#${sectionId}`);
}

// Expose globally as 'show' to maintain compatibility
window.show = navigateTo;

// Init Router
document.addEventListener('DOMContentLoaded', () => {
    const last = sessionStorage.getItem('lastSection') || 'dashboard';
    // Delay slightly to ensure modules are loaded
    setTimeout(() => navigateTo(last), 100);
});
