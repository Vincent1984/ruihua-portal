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
            // window.location.href = 'login.html'; // TEMPORARILY COMMENTED OUT FOR DEBUG
            return response;
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

// Export functions to global scope
window.toggleLoading = toggleLoading;
window.showToast = showToast;
window.authHeaders = authHeaders;
window.toggleSidebar = toggleSidebar;

async function ensureAdminAuth() {
    console.log("ensureAdminAuth bypassed");
    return true;
}
