let currentPage = 1;
let totalPages = 1;
let currentData = [];
const selectedIds = new Set();

function escapeHtml(value) {
    return String(value == null ? '' : value)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
}

function formatTime(value) {
    if (!value) return '';
    const d = new Date(value);
    if (Number.isNaN(d.getTime())) return String(value);
    return d.toLocaleString('zh-CN', { timeZone: 'Asia/Shanghai', hour12: false });
}

function formatFileSize(value) {
    const bytes = Number(value);
    if (!bytes || Number.isNaN(bytes)) return '';
    if (bytes < 1024) return bytes + ' B';
    if (bytes < 1048576) return Math.round(bytes / 1024) + ' KB';
    return (bytes / 1048576).toFixed(1) + ' MB';
}

function buildQuery() {
    const params = new URLSearchParams();
    const keyword = document.getElementById('searchKeyword').value.trim();
    const dept = document.getElementById('searchDept').value.trim();
    const synced = document.getElementById('searchSynced').value;
    const startDate = document.getElementById('searchStartDate').value;
    const endDate = document.getElementById('searchEndDate').value;

    if (keyword) params.set('keyword', keyword);
    if (dept) params.set('dept', dept);
    if (synced) params.set('dingtalk_synced', synced);
    if (startDate) params.set('startDate', startDate);
    if (endDate) params.set('endDate', endDate);

    return params;
}

async function loadData(page = 1) {
    if (window.toggleLoading) toggleLoading(true);
    try {
        const params = buildQuery();
        params.set('page', page);
        params.set('limit', 20);

        const res = await fetch(`/api/admin/ai-demand-surveys?${params.toString()}&_t=${Date.now()}`, {
            headers: window.authHeaders ? window.authHeaders() : { 'Authorization': `Bearer ${sessionStorage.getItem('token')}` }
        });

        if (res.status === 401) {
            window.location.href = '/admin/index.html';
            return;
        }

        const data = await res.json();
        if (!data.success) throw new Error(data.error || '加载失败');

        currentData = data.data || [];
        currentPage = (data.pagination && data.pagination.page) || page;
        totalPages = (data.pagination && data.pagination.totalPages) || 1;

        renderTable(currentData);
        document.getElementById('totalCount').textContent = (data.pagination && data.pagination.total) || 0;
        document.getElementById('currentPage').textContent = currentPage;
        document.getElementById('totalPages').textContent = totalPages || 1;

        selectedIds.clear();
        updateBatchButton();
        const checkAll = document.getElementById('checkAll');
        if (checkAll) checkAll.checked = false;
    } catch (e) {
        console.error(e);
        document.getElementById('dataTableBody').innerHTML =
            `<tr><td colspan="9" class="text-center text-danger py-4">${escapeHtml(e.message || '加载失败')}</td></tr>`;
    } finally {
        if (window.toggleLoading) toggleLoading(false);
    }
}

function renderTable(list) {
    const tbody = document.getElementById('dataTableBody');
    if (!list.length) {
        tbody.innerHTML = '<tr><td colspan="9" class="text-center text-secondary py-4">暂无数据</td></tr>';
        return;
    }

    tbody.innerHTML = list.map(item => {
        const synced = item.dingtalk_synced
            ? '<span class="badge bg-success-subtle text-success-emphasis">已同步</span>'
            : `<span class="badge bg-secondary-subtle text-secondary-emphasis" title="${escapeHtml(item.dingtalk_error || '')}">未同步</span>`;

        return `<tr>
            <td><input type="checkbox" class="row-check" value="${escapeHtml(item._id)}" onchange="toggleRow(this)"></td>
            <td class="text-nowrap small">${escapeHtml(formatTime(item.createdAt))}</td>
            <td>${escapeHtml(item.dept)}</td>
            <td class="fw-semibold">${escapeHtml(item.title)}</td>
            <td class="small">${escapeHtml(item.contact)}</td>
            <td class="cell-clamp small text-muted" title="${escapeHtml(item.q1)}">${escapeHtml(item.q1)}</td>
            <td class="text-nowrap small">${escapeHtml(item.q5_hours)}</td>
            <td>${synced}</td>
            <td>
                <button class="btn btn-sm btn-outline-primary" onclick="viewDetail('${escapeHtml(item._id)}')">详情</button>
                <button class="btn btn-sm btn-outline-danger" onclick="deleteRecord('${escapeHtml(item._id)}')">删除</button>
            </td>
        </tr>`;
    }).join('');
}

function changePage(delta) {
    const next = currentPage + delta;
    if (next < 1 || next > totalPages) return;
    loadData(next);
}

function resetFilters() {
    ['searchKeyword', 'searchDept', 'searchStartDate', 'searchEndDate'].forEach(id => {
        document.getElementById(id).value = '';
    });
    document.getElementById('searchSynced').value = '';
    loadData(1);
}

async function exportData() {
    if (window.toggleLoading) toggleLoading(true);
    try {
        const params = buildQuery();
        const res = await fetch(`/api/admin/ai-demand-surveys/export?${params.toString()}&_t=${Date.now()}`, {
            headers: window.authHeaders ? window.authHeaders() : { 'Authorization': `Bearer ${sessionStorage.getItem('token')}` }
        });

        if (res.status === 401) {
            window.location.href = '/admin/index.html';
            return;
        }
        if (!res.ok) throw new Error('导出失败');

        const blob = await res.blob();
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        const date = new Date().toISOString().slice(0, 10);
        a.download = `ai_demand_surveys_${date}.xlsx`;
        document.body.appendChild(a);
        a.click();
        a.remove();
        window.URL.revokeObjectURL(url);

        if (window.showToast) showToast('导出成功');
    } catch (e) {
        console.error(e);
        if (window.showToast) showToast(e.message || '导出失败', 'error');
    } finally {
        if (window.toggleLoading) toggleLoading(false);
    }
}

function viewDetail(id) {
    const item = currentData.find(row => String(row._id) === String(id));
    if (!item) return;

    const q5 = [
        item.q5_count ? `${item.q5_count} 件/月` : '',
        item.q5_minutes ? `${item.q5_minutes} 分钟/件` : '',
        item.q5_people ? `${item.q5_people} 人参与` : '',
        item.q5_hours ? `月工时 ${item.q5_hours}` : ''
    ].filter(Boolean).join(' · ');

    const q3 = [item.q3, item.q3_other].filter(Boolean).join('；');
    const q6 = [item.q6, item.q6_other].filter(Boolean).join('；');
    const q9 = [item.q9, item.q9_other].filter(Boolean).join('；');

    const map = {
        'd-dept': item.dept,
        'd-title': item.title,
        'd-contact': item.contact,
        'd-time': formatTime(item.createdAt),
        'd-q1': item.q1,
        'd-q2': item.q2,
        'd-q3': q3,
        'd-q4': item.q4,
        'd-q5': q5,
        'd-q6': q6,
        'd-q7': item.q7,
        'd-q8': item.q8,
        'd-q9': q9,
        'd-q10': item.q10,
        'd-submission-id': item.submission_id,
        'd-synced': item.dingtalk_synced ? '已同步' : '未同步',
        'd-sync-error': item.dingtalk_error || '',
        'd-page': item.page || ''
    };

    Object.keys(map).forEach(key => {
        const el = document.getElementById(key);
        if (el) el.textContent = map[key] || '-';
    });

    // 附件：有下载地址时渲染成可点击链接
    const attachmentEl = document.getElementById('d-attachment');
    if (attachmentEl) {
        if (!item.attachment_name) {
            attachmentEl.textContent = '-';
        } else {
            const name = escapeHtml(item.attachment_name);
            const size = formatFileSize(item.attachment_size);
            const sizeText = size ? `<span class="text-muted small ms-2">${size}</span>` : '';
            attachmentEl.innerHTML = item.attachment_url
                ? `<a href="${escapeHtml(item.attachment_url)}" target="_blank" rel="noopener noreferrer">${name}</a>${sizeText}`
                : `${name}${sizeText}`;
        }
    }

    const modal = new bootstrap.Modal(document.getElementById('detailModal'));
    modal.show();
}

async function deleteRecord(id) {
    if (!confirm('确定删除这条表单记录吗？删除后不可恢复。')) return;

    if (window.toggleLoading) toggleLoading(true);
    try {
        const res = await fetch(`/api/admin/ai-demand-surveys/${id}`, {
            method: 'DELETE',
            headers: window.authHeaders ? window.authHeaders() : { 'Authorization': `Bearer ${sessionStorage.getItem('token')}` }
        });
        const data = await res.json();
        if (!res.ok || !data.success) throw new Error(data.error || '删除失败');

        if (window.showToast) showToast('删除成功');
        loadData(currentPage);
    } catch (e) {
        console.error(e);
        if (window.showToast) showToast(e.message || '删除失败', 'error');
    } finally {
        if (window.toggleLoading) toggleLoading(false);
    }
}

function toggleRow(checkbox) {
    if (checkbox.checked) selectedIds.add(checkbox.value);
    else selectedIds.delete(checkbox.value);
    updateBatchButton();
}

function toggleCheckAll(checkbox) {
    document.querySelectorAll('.row-check').forEach(el => {
        el.checked = checkbox.checked;
        if (checkbox.checked) selectedIds.add(el.value);
        else selectedIds.delete(el.value);
    });
    updateBatchButton();
}

function updateBatchButton() {
    const btn = document.getElementById('batchDeleteBtn');
    if (!btn) return;
    btn.disabled = selectedIds.size === 0;
    btn.innerHTML = `<i class="bi bi-trash"></i> 批量删除${selectedIds.size ? `（${selectedIds.size}）` : ''}`;
}

async function batchDelete() {
    if (selectedIds.size === 0) return;
    if (!confirm(`确定删除选中的 ${selectedIds.size} 条记录吗？删除后不可恢复。`)) return;

    if (window.toggleLoading) toggleLoading(true);
    try {
        const res = await fetch('/api/admin/ai-demand-surveys/batch-delete', {
            method: 'POST',
            headers: window.authHeaders ? window.authHeaders() : { 'Authorization': `Bearer ${sessionStorage.getItem('token')}`, 'Content-Type': 'application/json' },
            body: JSON.stringify({ ids: Array.from(selectedIds) })
        });
        const data = await res.json();
        if (!res.ok || !data.success) throw new Error(data.error || '批量删除失败');

        if (window.showToast) showToast(data.message || '批量删除成功');
        selectedIds.clear();
        loadData(1);
    } catch (e) {
        console.error(e);
        if (window.showToast) showToast(e.message || '批量删除失败', 'error');
    } finally {
        if (window.toggleLoading) toggleLoading(false);
    }
}

window.loadData = loadData;
window.changePage = changePage;
window.exportData = exportData;
window.resetFilters = resetFilters;
window.viewDetail = viewDetail;
window.deleteRecord = deleteRecord;
window.toggleRow = toggleRow;
window.toggleCheckAll = toggleCheckAll;
window.batchDelete = batchDelete;

document.addEventListener('DOMContentLoaded', () => {
    loadData(1);
});
