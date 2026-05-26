// ================= SEO Management =================

async function loadSeoConfig() {
    const pagePath = document.getElementById('seoPageSelect').value;
    try {
        const res = await fetch(`/api/admin/seo?pagePath=${encodeURIComponent(pagePath)}`, {
            headers: authHeaders()
        });
        const data = await res.json();
        if (data.success && data.data) {
            document.getElementById('seoTitle').value = data.data.title || '';
            document.getElementById('seoKeywords').value = data.data.keywords || '';
            document.getElementById('seoDescription').value = data.data.description || '';
        } else {
            document.getElementById('seoTitle').value = '';
            document.getElementById('seoKeywords').value = '';
            document.getElementById('seoDescription').value = '';
        }
    } catch (e) {
        console.error('Load SEO config failed', e);
        showToast('加载 SEO 配置失败', 'error');
    }
}

async function saveSeoConfig(e) {
    e.preventDefault();
    const pagePath = document.getElementById('seoPageSelect').value;
    const title = document.getElementById('seoTitle').value.trim();
    const keywords = document.getElementById('seoKeywords').value.trim();
    const description = document.getElementById('seoDescription').value.trim();

    try {
        const res = await fetch('/api/admin/seo', {
            method: 'POST',
            headers: {
                ...authHeaders(),
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ pagePath, title, keywords, description })
        });
        const data = await res.json();
        if (data.success) {
            showToast('SEO 配置保存成功', 'success');
        } else {
            showToast(data.error || '保存失败', 'error');
        }
    } catch (e) {
        console.error('Save SEO config failed', e);
        showToast('保存 SEO 配置出错', 'error');
    }
}

// Load default when switching to SEO section
document.addEventListener('DOMContentLoaded', () => {
    // Add listener if needed
    const observer = new MutationObserver((mutations) => {
        mutations.forEach((mutation) => {
            if (mutation.target.id === 'seo' && !mutation.target.classList.contains('d-none')) {
                loadSeoConfig();
            }
        });
    });
    const seoEl = document.getElementById('seo');
    if (seoEl) {
        observer.observe(seoEl, { attributes: true, attributeFilter: ['class'] });
    }
});