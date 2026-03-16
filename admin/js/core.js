
// ================= Core Utilities =================

// Global Fetch Interceptor for Auth Handling
const originalFetch = window.fetch;
window.fetch = async function(...args) {
    try {
        const response = await originalFetch(...args);
        
        if (response.status === 401) {
            console.warn('Session expired (401), redirecting to login...');
            sessionStorage.removeItem('token');
            sessionStorage.removeItem('user');
            window.location.href = 'login.html';
            return response; // Return response to let caller handle if needed, though redirect happens
        }
        
        return response;
    } catch (error) {
        console.error('Network Error:', error);
        throw error;
    }
};

// Loading Helper
function toggleLoading(show) {
    let overlay = document.getElementById('loadingOverlay');
    if (!overlay) {
        overlay = document.createElement('div');
        overlay.id = 'loadingOverlay';
        overlay.style.position = 'fixed';
        overlay.style.top = '0';
        overlay.style.left = '0';
        overlay.style.width = '100%';
        overlay.style.height = '100%';
        overlay.style.backgroundColor = 'rgba(255, 255, 255, 0.7)';
        overlay.style.zIndex = '9999';
        overlay.style.display = 'flex';
        overlay.style.justifyContent = 'center';
        overlay.style.alignItems = 'center';
        overlay.innerHTML = '<div class="spinner-border text-primary" role="status"></div>';
        document.body.appendChild(overlay);
    }
    overlay.style.display = show ? 'flex' : 'none';
}

// Toast Helper
function showToast(message, type = 'success') {
    // Simple toast implementation
    const toastContainer = document.getElementById('toast-container') || createToastContainer();
    const toast = document.createElement('div');
    toast.className = `toast align-items-center text-white bg-${type === 'error' ? 'danger' : type} border-0 show`;
    toast.setAttribute('role', 'alert');
    toast.setAttribute('aria-live', 'assertive');
    toast.setAttribute('aria-atomic', 'true');
    toast.style.marginBottom = '10px';
    
    toast.innerHTML = `
        <div class="d-flex">
            <div class="toast-body">${message}</div>
            <button type="button" class="btn-close btn-close-white me-2 m-auto" data-bs-dismiss="toast"></button>
        </div>
    `;
    
    toastContainer.appendChild(toast);
    
    // Auto hide
    setTimeout(() => {
        toast.remove();
    }, 3000);
}

function createToastContainer() {
    const div = document.createElement('div');
    div.id = 'toast-container';
    div.className = 'toast-container position-fixed top-0 end-0 p-3';
    div.style.zIndex = '1100';
    document.body.appendChild(div);
    return div;
}

// Auth Headers
function authHeaders() {
    const token = sessionStorage.getItem('token');
    return {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
    };
}

// Toggle Mobile Sidebar
function toggleSidebar() {
    const sidebar = document.getElementById('adminSidebar');
    const backdrop = document.getElementById('sidebarBackdrop');
    if (sidebar) {
        sidebar.classList.toggle('open');
    }
    if (backdrop) {
        backdrop.classList.toggle('show');
    }
}

// Navigation Show Function
function show(sectionId) {
    console.log('Switching to section:', sectionId);
    
    // Hide all sections
    const sections = document.querySelectorAll('.section');
    if (sections.length === 0) {
        console.warn('No sections found with class .section');
        return;
    }
    
    sections.forEach(el => el.classList.remove('active'));
    
    // Show target
    const target = document.getElementById(sectionId);
    if (target) {
        target.classList.add('active');
        // Animation
        target.style.animation = 'none';
        target.offsetHeight; /* trigger reflow */
        target.style.animation = 'fadeIn 0.3s ease';
    } else {
        console.error(`Target section #${sectionId} not found`);
        showToast(`无法找到功能模块: ${sectionId}`, 'error');
        return;
    }

    // Update Nav
    document.querySelectorAll('.menu-item').forEach(el => el.classList.remove('active'));
    const nav = document.getElementById('nav-' + sectionId);
    if (nav) nav.classList.add('active');

    // Update Title
    const titles = {
        'dashboard': '数据看板',
        'banner': 'Banner配置',
        'sidebar': '文章侧边栏配置',
        'article': '文章管理',
        'faq': 'FAQ 管理',
        'appointments': '预约管理',
        'permissions': '权限管理'
    };
    const titleEl = document.getElementById('page-title');
    if (titleEl && titles[sectionId]) titleEl.textContent = titles[sectionId];

    // Mobile: Close sidebar after selection
    if (window.innerWidth <= 768) {
        const sidebar = document.getElementById('adminSidebar');
        const backdrop = document.getElementById('sidebarBackdrop');
        if (sidebar) sidebar.classList.remove('open');
        if (backdrop) backdrop.classList.remove('show');
    }

    // Load specific data with error handling
    try {
        if (sectionId === 'appointments') {
            if (typeof loadAppointments === 'function') loadAppointments();
            else console.error('loadAppointments function missing');
        }
        if (sectionId === 'logs') {
            if (typeof loadLogs === 'function') loadLogs();
            else console.error('loadLogs function missing');
        }
        if (sectionId === 'permissions') {
            if (typeof switchPermTab === 'function') switchPermTab('users');
            else console.error('switchPermTab function missing');
        }
        // CMS modules preload check
        if (['banner', 'sidebar', 'article', 'faq'].includes(sectionId)) {
            // Check if CMS functions exist, if not, maybe reload or warn
            if (sectionId === 'article' && typeof loadArticles !== 'function') console.warn('loadArticles missing');
            // Actually cms.js handles initialization on DOMContentLoaded if nav-article exists, 
            // but dynamic reload might be needed if we want fresh data on click.
            // Let's add explicit reload for article list
            if (sectionId === 'article' && typeof loadArticles === 'function') loadArticles();
            if (sectionId === 'faq' && typeof loadFaqs === 'function') loadFaqs();
            if (sectionId === 'banner') {
            if (typeof loadBannerData === 'function') {
                console.log('Invoking loadBannerData');
                loadBannerData();
            } else {
                console.error('loadBannerData is not a function');
            }
        }
            if (sectionId === 'sidebar' && typeof loadSidebarData === 'function') loadSidebarData();
        }
    } catch (e) {
        console.error('Error loading module data:', e);
        showToast('模块数据加载失败', 'error');
    }
    
    // Persist state
    sessionStorage.setItem('lastSection', sectionId);
}

// Explicitly expose show to window
window.show = show;
console.log('show function exposed to window');

// Init State
document.addEventListener('DOMContentLoaded', () => {
    const last = sessionStorage.getItem('lastSection') || 'dashboard';
    // Small delay to ensure other scripts loaded
    setTimeout(() => show(last), 50);
});
