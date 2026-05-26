// ================= Router (Navigation) =================

const ROUTES = [
    { id: 'dashboard', title: '数据看板', load: () => { if(window.setChartRange) window.setChartRange(7); } },
    { id: 'banner', title: 'Banner配置', load: () => { if(window.loadBannerData) window.loadBannerData(); } },
    { id: 'sidebar', title: '文章侧边栏配置', load: () => { if(window.loadSidebarData) window.loadSidebarData(); } },
    { id: 'authors', title: '专家管理', load: () => { if(window.loadAuthors) window.loadAuthors(); } },
    { id: 'article', title: '文章管理', load: () => { if(window.loadCategories) window.loadCategories(); if(window.loadArticles) window.loadArticles(); if(window.loadAuthorOptions) window.loadAuthorOptions(); } },
    { id: 'faq', title: 'FAQ 管理', load: () => { if(window.loadFaqs) window.loadFaqs(); } },
    { id: 'appointments', title: '预约管理', load: () => { if(window.loadAppointments) window.loadAppointments(); } },
    { id: 'permissions', title: '权限管理', load: () => { if(window.switchPermTab) window.switchPermTab('users'); } },
    { id: 'logs', title: '操作日志', load: () => { if(window.loadLogs) window.loadLogs(); } },
    { id: 'seo', title: 'TDK管理', load: () => { if(window.loadSeoConfig) window.loadSeoConfig(); } },
    { id: 'video', title: '视频管理', load: () => { 
        if (window.mountVideoApp) window.mountVideoApp();
    } }
];

function navigateTo(sectionId) {
    // console.log('Navigating to:', sectionId);
    
    // Validate
    let route = ROUTES.find(r => r.id === sectionId);
    if (!route) {
        // Fallback or ignore
        // console.error(`Route ${sectionId} not found`);
        // Don't show toast for initial load if not found, just default to dashboard
        if (sectionId === 'dashboard') return; 
        navigateTo('dashboard');
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
    } else {
        // If target section doesn't exist (e.g. video), show a placeholder or do nothing
        // Create placeholder if missing?
        if (sectionId === 'video' && !document.getElementById('video')) {
            const mainContent = document.querySelector('.page-content');
            const div = document.createElement('div');
            div.id = 'video';
            div.className = 'section active';
            div.innerHTML = `<div class="card p-5 text-center"><h3 class="text-secondary">视频管理功能开发中...</h3></div>`;
            mainContent.appendChild(div);
        }
    }

    // Update Nav Active State
    document.querySelectorAll('.menu-item, .sub-menu-item, .nav-header').forEach(el => el.classList.remove('active'));
    // Close all groups if we want strict accordion, but keeping them open is friendlier if not conflicting.
    // User requested Accordion, which usually implies closing others.
    // Let's close all groups first.
    document.querySelectorAll('.nav-header').forEach(el => el.classList.remove('expanded'));
    document.querySelectorAll('.nav-items').forEach(el => el.classList.remove('expanded'));

    const nav = document.getElementById('nav-' + sectionId);
    if (nav) {
        nav.classList.add('active');
        
        // Handle Parent Group
        const parentGroup = nav.closest('.nav-group');
        if (parentGroup) {
            const header = parentGroup.querySelector('.nav-header');
            const items = parentGroup.querySelector('.nav-items');
            if (header) header.classList.add('active', 'expanded');
            if (items) items.classList.add('expanded');
        }
    }

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
        if(route.load) route.load();
    } catch (e) {
        console.error('Error executing route load:', e);
    }

    // Persist
    sessionStorage.setItem('lastSection', sectionId);
}

// Toggle Sidebar Collapse (Desktop)
window.toggleSidebarCollapse = function() {
    const sidebar = document.getElementById('adminSidebar');
    sidebar.classList.toggle('collapsed');
    const isCollapsed = sidebar.classList.contains('collapsed');
    localStorage.setItem('sidebarCollapsed', isCollapsed);
}

// Toggle Nav Group
window.toggleNavGroup = function(header) {
    const sidebar = document.getElementById('adminSidebar');
    if (sidebar.classList.contains('collapsed')) return; // Click does nothing in collapsed mode

    const group = header.closest('.nav-group');
    const items = group.querySelector('.nav-items');
    const isExpanded = header.classList.contains('expanded');
    const label = header.querySelector('.label').textContent.trim();
    
    // Accordion: Close others
    document.querySelectorAll('.nav-header').forEach(h => {
        if (h !== header) h.classList.remove('expanded');
    });
    document.querySelectorAll('.nav-items').forEach(i => {
        if (i !== items) i.classList.remove('expanded');
    });
    
    if (!isExpanded) {
        header.classList.add('expanded');
        items.classList.add('expanded');
        localStorage.setItem('lastExpandedGroup', label);
    } else {
        header.classList.remove('expanded');
        items.classList.remove('expanded');
        localStorage.removeItem('lastExpandedGroup');
    }
}

// Expose globally as 'show' to maintain compatibility
window.show = navigateTo;

// Init Router
document.addEventListener('DOMContentLoaded', () => {
    // Restore Sidebar State
    const isCollapsed = localStorage.getItem('sidebarCollapsed') === 'true';
    if (isCollapsed) {
        document.getElementById('adminSidebar').classList.add('collapsed');
    }

    // Restore Expanded Group (if any, independent of active route)
    const lastGroupLabel = localStorage.getItem('lastExpandedGroup');
    if (lastGroupLabel) {
        const headers = document.querySelectorAll('.nav-header');
        headers.forEach(h => {
            if (h.querySelector('.label') && h.querySelector('.label').textContent.trim() === lastGroupLabel) {
                h.classList.add('expanded');
                const group = h.closest('.nav-group');
                if (group) {
                    const items = group.querySelector('.nav-items');
                    if (items) items.classList.add('expanded');
                }
            }
        });
    }

    const last = sessionStorage.getItem('lastSection') || 'dashboard';
    // Delay slightly to ensure modules are loaded
    setTimeout(() => navigateTo(last), 100);
});
