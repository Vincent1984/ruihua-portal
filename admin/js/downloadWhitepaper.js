// ================= Whitepaper Download Management =================

let currentPage = 1;
let totalPages = 1;
let currentData = []; // Store current page data for modal

// Load Data
async function loadWhitepaperData(page = 1) {
    if (window.toggleLoading) toggleLoading(true);
    try {
        const name = document.getElementById('searchName').value.trim();
        const phone = document.getElementById('searchPhone').value.trim();
        const whitepaperName = document.getElementById('searchWhitepaper').value.trim();
        const utm_source = document.getElementById('searchUtmSource').value.trim();

        const params = new URLSearchParams({
            page,
            limit: 10,
            ...(name && { name }),
            ...(phone && { phone }),
            ...(whitepaperName && { whitepaperName }),
            ...(utm_source && { utm_source })
        });

        const res = await fetch(`/api/whitepaper/list?${params.toString()}&_t=${Date.now()}`, {
            headers: window.authHeaders ? window.authHeaders() : {
                'Authorization': `Bearer ${sessionStorage.getItem('token')}`,
                'Content-Type': 'application/json'
            }
        });

        if (res.status === 401) {
            window.location.href = '/admin/index.html';
            return;
        }

        const data = await res.json();
        
        if (data.error) {
            alert('加载失败: ' + data.error);
            return;
        }

        currentData = data.data; // Store for modal
        renderWhitepaperTable(data.data);
        updateWhitepaperPagination(data.pagination);
    } catch (error) {
        console.error('Load Error:', error);
        alert('加载数据出错');
    } finally {
        if (window.toggleLoading) toggleLoading(false);
    }
}

function renderWhitepaperTable(items) {
    const tbody = document.getElementById('dataTableBody');
    if (!tbody) return;
    tbody.innerHTML = '';

    if (!items || items.length === 0) {
        tbody.innerHTML = '<tr><td colspan="9" class="text-center py-4 text-muted">暂无数据</td></tr>';
        return;
    }

    items.forEach((item, index) => {
        const tr = document.createElement('tr');
        tr.innerHTML = `
            <td>${item.name || '-'}</td>
            <td>${item.phone || '-'}</td>
            <td>${item.company || '-'}</td>
            <td>${item.position || '-'}</td>
            <td><span class="badge bg-light text-dark border">${item.whitepaperName || '-'}</span></td>
            <td>${item.source ? '<a href="' + item.source + '" target="_blank" class="text-decoration-none" title="' + item.source + '"><i class="bi bi-link-45deg"></i> 链接</a>' : '-'}</td>
            <td>${item.utm_source ? '<span class="badge bg-primary-subtle text-primary-emphasis">' + item.utm_source + '</span>' : '-'}</td>
            <td>${new Date(item.submittedAt).toLocaleString('zh-CN')}</td>
            <td>
                <button class="btn btn-sm btn-outline-primary" onclick="showWhitepaperDetail(${index})">详情</button>
            </td>
        `;
        tbody.appendChild(tr);
    });
}

function showWhitepaperDetail(index) {
    const item = currentData[index];
    if (!item) return;

    document.getElementById('d-name').textContent = item.name || '-';
    document.getElementById('d-phone').textContent = item.phone || '-';
    document.getElementById('d-company').textContent = item.company || '-';
    document.getElementById('d-position').textContent = item.position || '-';
    document.getElementById('d-email').textContent = item.email || '-';
    document.getElementById('d-time').textContent = new Date(item.submittedAt).toLocaleString('zh-CN');
    document.getElementById('d-whitepaper').textContent = item.whitepaperName || '-';
    document.getElementById('d-source').textContent = item.source || '-';
    
    document.getElementById('d-utm-source').textContent = item.utm_source || '-';
    document.getElementById('d-utm-medium').textContent = item.utm_medium || '-';
    document.getElementById('d-utm-campaign').textContent = item.utm_campaign || '-';
    document.getElementById('d-utm-term').textContent = item.utm_term || '-';
    document.getElementById('d-utm-content').textContent = item.utm_content || '-';

    const modal = new bootstrap.Modal(document.getElementById('detailModal'));
    modal.show();
}

function updateWhitepaperPagination(pagination) {
    currentPage = pagination.page;
    totalPages = pagination.pages;
    const cpEl = document.getElementById('currentPage');
    const tpEl = document.getElementById('totalPages');
    const tcEl = document.getElementById('totalCount');
    
    if (cpEl) cpEl.textContent = currentPage;
    if (tpEl) tpEl.textContent = totalPages;
    if (tcEl) tcEl.textContent = pagination.total;
}

function changePage(delta) {
    const newPage = currentPage + delta;
    if (newPage >= 1 && newPage <= totalPages) {
        loadWhitepaperData(newPage);
    }
}

function exportData() {
    const name = document.getElementById('searchName').value.trim();
    const phone = document.getElementById('searchPhone').value.trim();
    const whitepaperName = document.getElementById('searchWhitepaper').value.trim();
    const utm_source = document.getElementById('searchUtmSource').value.trim();

    const params = new URLSearchParams({
        ...(name && { name }),
        ...(phone && { phone }),
        ...(whitepaperName && { whitepaperName }),
        ...(utm_source && { utm_source })
    });

    if (window.toggleLoading) toggleLoading(true);
    fetch(`/api/whitepaper/export?${params.toString()}`, {
        headers: window.authHeaders ? window.authHeaders() : {
            'Authorization': `Bearer ${sessionStorage.getItem('token')}`
        }
    })
    .then(res => {
        if (res.status === 401) {
            window.location.href = '/admin/index.html';
            throw new Error('Unauthorized');
        }
        if (!res.ok) throw new Error('Export failed');
        return res.blob();
    })
    .then(blob => {
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `whitepaper_submissions_${new Date().toISOString().slice(0,10)}.csv`;
        document.body.appendChild(a);
        a.click();
        window.URL.revokeObjectURL(url);
        document.body.removeChild(a);
    })
    .catch(err => {
        console.error(err);
        alert('导出失败: ' + err.message);
    })
    .finally(() => {
        if (window.toggleLoading) toggleLoading(false);
    });
}

// Export functions to window
window.loadData = loadWhitepaperData;
window.exportData = exportData;
window.changePage = changePage;
window.showWhitepaperDetail = showWhitepaperDetail;

// Initialize
document.addEventListener('DOMContentLoaded', () => {
    loadWhitepaperData();
});
