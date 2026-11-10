let currentPage = 1;
const limit = 20;
let totalPages = 1;

document.addEventListener('DOMContentLoaded', () => {
    loadData(1);
});

function toast(message) {
    const el = document.getElementById('toast');
    if (!el) return;
    el.textContent = message;
    el.classList.add('on');
    clearTimeout(toast.timer);
    toast.timer = setTimeout(() => el.classList.remove('on'), 2200);
}

function setStat(key, value) {
    const el = document.querySelector(`[data-stat="${key}"]`);
    if (el) el.textContent = value;
}

async function loadData(page) {
    if (page < 1 || (page > totalPages && totalPages > 0)) return;
    currentPage = page;

    const keyword = document.getElementById('searchKeyword').value;

    document.getElementById('loadingOverlay').style.display = 'flex';

    try {
        const query = new URLSearchParams({
            page: currentPage,
            limit: limit,
            keyword: keyword || ''
        });

        const response = await fetch(`/api/admin/nqoc/whitepaper?${query.toString()}`, {
            headers: authHeaders()
        });
        const result = await response.json();

        if (result.success) {
            renderTable(result.data.list);
            updatePagination(result.data.total, result.data.page, result.data.totalPages);
            updateStats(result.data.list, result.data.total, result.data.page);
        } else {
            toast(result.error || '获取数据失败');
        }
    } catch (e) {
        console.error(e);
        toast('获取数据失败');
    } finally {
        document.getElementById('loadingOverlay').style.display = 'none';
    }
}

function escapeHtml(unsafe) {
    if (!unsafe) return '';
    return unsafe
         .toString()
         .replace(/&/g, "&amp;")
         .replace(/</g, "&lt;")
         .replace(/>/g, "&gt;")
         .replace(/"/g, "&quot;")
         .replace(/'/g, "&#039;");
}

function formatDate(dateString) {
    if (!dateString) return '—';
    const date = new Date(dateString);
    return date.toLocaleString('zh-CN', {
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
        hour12: false
    });
}

function shortDateTime(dateString) {
    if (!dateString) return '—';
    const value = new Date(dateString);
    if (Number.isNaN(value.getTime())) return '—';
    const pad = n => String(n).padStart(2, '0');
    return `${pad(value.getMonth() + 1)}-${pad(value.getDate())} ${pad(value.getHours())}:${pad(value.getMinutes())}`;
}

function renderTable(data) {
    const tbody = document.getElementById('dataTableBody');
    tbody.innerHTML = '';

    if (!data || data.length === 0) {
        tbody.innerHTML = '<tr><td colspan="7" class="empty-cell">暂无白皮书预约记录</td></tr>';
        return;
    }

    tbody.innerHTML = data.map(item => `
        <tr>
            <td><div class="person">${escapeHtml(item.name || '—')}</div></td>
            <td><div class="mono" style="font-size:12.5px">${escapeHtml(item.phone || '—')}</div></td>
            <td><div class="mono" style="font-size:12.5px">${escapeHtml(item.email || '—')}</div></td>
            <td>${escapeHtml(item.company || '—')}</td>
            <td><span class="sub">${escapeHtml(item.position || '—')}</span></td>
            <td><div class="mono" style="font-size:12.5px">${formatDate(item.createdAt)}</div></td>
            <td><button class="danger" onclick="deleteRecord('${escapeHtml(item._id)}')">删除</button></td>
        </tr>
    `).join('');
}

function updatePagination(total, page, pages) {
    totalPages = pages || 1;
    document.getElementById('totalCount').textContent = total;
    document.getElementById('currentPage').textContent = page;
    document.getElementById('totalPages').textContent = totalPages;
}

function updateStats(data, total, page) {
    setStat('total', total || 0);
    setStat('page', page || currentPage);
    setStat('totalPages', totalPages);
    setStat('limit', limit);
    setStat('pageCount', data ? data.length : 0);

    const latest = data && data.length ? data[0] : null;
    setStat('latest', latest ? shortDateTime(latest.createdAt) : '—');
    setStat('latestWho', latest ? [latest.name || '匿名', latest.company].filter(Boolean).join(' · ') : '本页暂无记录');
}

function changePage(delta) {
    loadData(currentPage + delta);
}

async function deleteRecord(id) {
    if (!confirm('确定要删除这条白皮书预约记录吗？此操作不可恢复。')) return;

    try {
        const response = await fetch(`/api/admin/nqoc/whitepaper/${id}`, {
            method: 'DELETE',
            headers: authHeaders()
        });
        const result = await response.json();

        if (result.success) {
            toast('记录已删除');
            loadData(currentPage);
        } else {
            toast(result.error || '删除失败');
        }
    } catch (e) {
        console.error(e);
        toast('删除失败');
    }
}

async function exportData() {
    const keyword = document.getElementById('searchKeyword').value;

    const query = new URLSearchParams({
        keyword: keyword || ''
    });

    const url = `/api/admin/nqoc/whitepaper/export?${query.toString()}`;
    try {
        const response = await fetch(url, { credentials: 'same-origin' });
        if (!response.ok) {
            toast('导出失败，请稍后重试');
            return;
        }
        const blob = await response.blob();
        const downloadUrl = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = downloadUrl;
        a.download = `白皮书预约_${new Date().toISOString().slice(0, 10)}.csv`;
        a.click();
        URL.revokeObjectURL(downloadUrl);
    } catch (e) {
        toast('导出失败: ' + e.message);
    }
}
