let currentPage = 1;
const limit = 20;
let totalPages = 1;
let currentData = [];

const ACTIVITY_LABELS = {
    speaker: '研讨会/私董会/论坛分享嘉宾',
    video_interview: '《值得看见》栏目录制',
    case_review: '优秀案例评审',
    standard_making: '新质组织模型标准制定',
    host_visits: '接待企业参观学习研讨',
    writing: '接受约稿撰写',
    general_events: '参加其他相关专业活动'
};

const STATUS_LABELS = {
    pending: '待处理',
    contacted: '已联系',
    approved: '已通过',
    rejected: '已拒绝'
};

const PERSON_SVG = '<svg viewBox="0 0 20 20" aria-hidden="true"><circle cx="10" cy="7.5" r="3"/><path d="M4.5 16.5c.6-3 2.8-4.5 5.5-4.5s4.9 1.5 5.5 4.5"/></svg>';

document.addEventListener('DOMContentLoaded', () => {
    loadData(1);
});

function showLoading() { const el = document.getElementById('loadingOverlay'); if (el) el.style.display = 'flex'; }
function hideLoading() { const el = document.getElementById('loadingOverlay'); if (el) el.style.display = 'none'; }

function toast(message) {
    const el = document.getElementById('toast');
    if (!el) return;
    el.textContent = message;
    el.classList.add('on');
    clearTimeout(toast.timer);
    toast.timer = setTimeout(() => el.classList.remove('on'), 2200);
}

function openModal(id) { const el = document.getElementById(id); if (el) el.classList.add('show'); }
function closeModal(id) { const el = document.getElementById(id); if (el) el.classList.remove('show'); }

function setStat(key, value) {
    const el = document.querySelector(`[data-stat="${key}"]`);
    if (el) el.textContent = value;
}

function escapeHtml(unsafe) {
    if (!unsafe) return '';
    return unsafe.toString()
        .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;').replace(/'/g, '&#039;');
}

function formatDate(dateString) {
    if (!dateString) return '—';
    const d = new Date(dateString);
    if (isNaN(d.getTime())) return '—';
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')} ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
}

function handlePhotoError(img) {
    const span = document.createElement('span');
    span.className = 'photo-placeholder';
    span.innerHTML = PERSON_SVG;
    if (img.parentNode) img.parentNode.replaceChild(span, img);
}

function isValidPhoto(url) {
    return url && url.length > 5 && !url.includes('undefined');
}

async function loadData(page) {
    if (page < 1 || (page > totalPages && totalPages > 0)) return;
    currentPage = page;

    const search = document.getElementById('searchKeyword').value;
    const status = document.getElementById('statusFilter').value;
    const startDate = document.getElementById('searchStartDate').value;
    const endDate = document.getElementById('searchEndDate').value;

    showLoading();
    try {
        const query = new URLSearchParams({
            page: currentPage, limit,
            search: search || '', status: status || '',
            startDate: startDate || '', endDate: endDate || ''
        });

        const response = await fetch(`/api/admin/nqoc/experts?${query.toString()}`, { headers: authHeaders() });
        const result = await response.json();

        if (result.success) {
            currentData = result.data || [];
            const pagination = result.pagination || {};
            renderTable(currentData);
            updatePagination(pagination.total || 0, pagination.page || currentPage, pagination.totalPages || 1);
        } else {
            toast(result.message || '获取数据失败');
        }
    } catch (e) {
        console.error(e);
        toast('获取数据失败');
    } finally {
        hideLoading();
    }
}

function resetFilter() {
    document.getElementById('searchKeyword').value = '';
    document.getElementById('statusFilter').value = '';
    document.getElementById('searchStartDate').value = '';
    document.getElementById('searchEndDate').value = '';
    loadData(1);
}

function renderActivities(arr) {
    if (!Array.isArray(arr) || arr.length === 0) return '<span class="sub">—</span>';
    const labels = arr.map(k => ACTIVITY_LABELS[k] || k);
    const text = labels.join('、');
    return `<span class="cell-truncate" title="${escapeHtml(text)}">${escapeHtml(labels[0])}${arr.length > 1 ? ` +${arr.length - 1}` : ''}</span>`;
}

function renderTable(data) {
    const tbody = document.getElementById('dataTableBody');
    tbody.innerHTML = '';
    const selectAll = document.getElementById('selectAll');
    if (selectAll) { selectAll.checked = false; selectAll.indeterminate = false; }
    updateBatchBar();

    if (!data || data.length === 0) {
        tbody.innerHTML = '<tr><td colspan="10" class="empty-cell">暂无专家申请记录</td></tr>';
        return;
    }

    data.forEach(item => {
        const status = STATUS_LABELS[item.status] ? item.status : 'pending';
        const validPhoto = isValidPhoto(item.photoUrl);
        const photo = validPhoto
            ? `<img src="${escapeHtml(item.photoUrl)}" class="table-photo" onerror="handlePhotoError(this)" alt="">`
            : `<span class="photo-placeholder">${PERSON_SVG}</span>`;
        const privacy = item.privacyConsent
            ? '<span class="chip">是</span>'
            : '<span class="chip n">否</span>';
        const posComp = [item.position, item.company].filter(Boolean).join(' / ') || '—';
        const email = item.email || '';

        const tr = document.createElement('tr');
        tr.innerHTML = `
            <td><input type="checkbox" class="row-checkbox" value="${escapeHtml(item._id)}" onchange="updateBatchBar()" aria-label="选择该条记录"></td>
            <td>${photo}</td>
            <td>
                <div class="person">${escapeHtml(item.name || '—')}</div>
                ${email ? `<span class="sub cell-truncate" title="${escapeHtml(email)}">${escapeHtml(email)}</span>` : ''}
            </td>
            <td>${renderActivities(item.activities)}</td>
            <td>${escapeHtml(item.location || '—')}</td>
            <td><span class="cell-truncate" title="${escapeHtml(posComp)}">${escapeHtml(posComp)}</span></td>
            <td>${privacy}</td>
            <td>
                <select class="status-select st-${status}" onchange="updateStatus('${escapeHtml(item._id)}', this)">
                    <option value="pending" ${status === 'pending' ? 'selected' : ''}>待处理</option>
                    <option value="contacted" ${status === 'contacted' ? 'selected' : ''}>已联系</option>
                    <option value="approved" ${status === 'approved' ? 'selected' : ''}>已通过</option>
                    <option value="rejected" ${status === 'rejected' ? 'selected' : ''}>已拒绝</option>
                </select>
            </td>
            <td><span class="mono">${formatDate(item.createdAt)}</span></td>
            <td>
                <div class="row-actions">
                    <button type="button" onclick="viewDetail('${escapeHtml(item._id)}')">详情</button>
                    <button type="button" class="danger" onclick="deleteRecord('${escapeHtml(item._id)}')">删除</button>
                </div>
            </td>
        `;
        tbody.appendChild(tr);
    });
}

function updatePagination(total, page, pages) {
    totalPages = pages || 1;
    document.getElementById('totalCount').textContent = total;
    document.getElementById('currentPage').textContent = page;
    document.getElementById('totalPages').textContent = totalPages;
    const prev = document.getElementById('prevPage');
    const next = document.getElementById('nextPage');
    if (prev) prev.disabled = page <= 1;
    if (next) next.disabled = page >= totalPages;
    updateStats(total, page);
}

function updateStats(total, page) {
    const rows = Array.isArray(currentData) ? currentData : [];
    setStat('total', total ?? 0);
    setStat('pageCount', rows.length);
    setStat('page', page ?? 1);
    setStat('totalPages', Math.max(totalPages, 1));
    setStat('pending', rows.filter(item => (item.status || 'pending') === 'pending').length);
}

function changePage(delta) { loadData(currentPage + delta); }

async function updateStatus(id, selectEl) {
    const newStatus = selectEl ? selectEl.value : '';
    if (selectEl) selectEl.className = `status-select st-${newStatus}`;
    try {
        const response = await fetch(`/api/admin/nqoc/experts/${id}/status`, {
            method: 'PUT',
            headers: { ...authHeaders(), 'Content-Type': 'application/json' },
            body: JSON.stringify({ status: newStatus })
        });
        const result = await response.json();
        if (result.success) {
            const item = currentData.find(x => x._id === id);
            if (item) item.status = newStatus;
            updateStats(parseInt(document.getElementById('totalCount').textContent, 10) || 0, currentPage);
            toast('状态已更新');
        } else {
            toast(result.message || '更新状态失败');
            loadData(currentPage);
        }
    } catch (e) {
        console.error(e);
        toast('更新状态失败');
        loadData(currentPage);
    }
}

async function deleteRecord(id) {
    if (!confirm('确定要删除这条申请记录吗？此操作不可恢复。')) return;
    try {
        const response = await fetch(`/api/admin/nqoc/experts/${id}`, {
            method: 'DELETE', headers: authHeaders()
        });
        const result = await response.json();
        if (result.success) {
            toast('删除成功');
            loadData(currentPage);
        } else {
            toast(result.message || '删除失败');
        }
    } catch (e) {
        console.error(e);
        toast('删除失败');
    }
}

function detailField(label, value, full) {
    return `<div class="detail-item${full ? ' full' : ''}"><span>${label}</span><b>${value || '—'}</b></div>`;
}

function detailRich(label, html) {
    return `<div class="detail-item full"><span>${label}</span><div class="rich-content">${html}</div></div>`;
}

function detailSection(title, items) {
    return `<div class="detail-section"><h3>${title}</h3><div class="detail-grid">${items.join('')}</div></div>`;
}

function viewDetail(id) {
    const item = currentData.find(x => x._id === id);
    if (!item) return;

    const activities = Array.isArray(item.activities) && item.activities.length
        ? item.activities.map(k => `<span class="activity-tag">${escapeHtml(ACTIVITY_LABELS[k] || k)}</span>`).join('')
        : '—';

    const photo = isValidPhoto(item.photoUrl)
        ? `<a href="${escapeHtml(item.photoUrl)}" target="_blank" rel="noopener"><img src="${escapeHtml(item.photoUrl)}" class="detail-photo" onerror="this.style.display='none'" alt="照片"></a>`
        : '未上传照片';

    let html = '';
    html += detailSection('基本信息', [
        detailField('姓名', escapeHtml(item.name || '—')),
        detailField('常驻地', escapeHtml(item.location || '—')),
        detailField('职位名称', escapeHtml(item.position || '—')),
        detailField('工作单位', escapeHtml(item.company || '—')),
        detailField('电子邮箱', escapeHtml(item.email || '—'))
    ]);
    html += detailSection('参与意向', [
        detailField('活动选择', activities, true),
        detailField('来源 / 联系人', escapeHtml(item.referrer || '—')),
        detailField('提交时间', formatDate(item.createdAt))
    ]);
    html += detailSection('专业信息', [
        detailField('研究领域', escapeHtml(item.researchFields || '—'), true),
        detailField('个人专业著作', escapeHtml(item.publications || '—'), true),
        item.bio ? detailRich('个人官方简介', item.bio) : detailField('个人官方简介', '—', true),
        item.topicNeeds ? detailRich('课题需求', item.topicNeeds) : detailField('课题需求', '—', true)
    ]);
    html += detailSection('照片与声明', [
        detailField('个人官方照片', photo),
        detailField('隐私说明', item.privacyConsent ? '是（同意公开）' : '否（不同意公开）'),
        detailField('其他声明', escapeHtml(item.otherDeclaration || '—'), true)
    ]);

    document.getElementById('detailBody').innerHTML = html;
    openModal('detailModal');
}

// ===== Batch Operations =====
function getSelectedIds() {
    return Array.from(document.querySelectorAll('.row-checkbox:checked')).map(cb => cb.value);
}

function updateBatchBar() {
    const ids = getSelectedIds();
    const bar = document.getElementById('batchBar');
    const countEl = document.getElementById('selectedCount');
    const selectAll = document.getElementById('selectAll');
    if (countEl) countEl.textContent = ids.length;
    if (bar) bar.style.display = ids.length > 0 ? '' : 'none';
    if (selectAll) {
        const allCbs = document.querySelectorAll('.row-checkbox');
        const checkedCbs = document.querySelectorAll('.row-checkbox:checked');
        selectAll.checked = allCbs.length > 0 && checkedCbs.length === allCbs.length;
        selectAll.indeterminate = checkedCbs.length > 0 && checkedCbs.length < allCbs.length;
    }
}

function toggleSelectAll(el) {
    document.querySelectorAll('.row-checkbox').forEach(cb => { cb.checked = el.checked; });
    updateBatchBar();
}

function clearSelection() {
    document.querySelectorAll('.row-checkbox').forEach(cb => { cb.checked = false; });
    const selectAll = document.getElementById('selectAll');
    if (selectAll) { selectAll.checked = false; selectAll.indeterminate = false; }
    updateBatchBar();
}

async function batchDelete() {
    const ids = getSelectedIds();
    if (ids.length === 0) return;
    if (!confirm(`确定要删除选中的 ${ids.length} 条记录吗？此操作不可恢复。`)) return;
    showLoading();
    try {
        const response = await fetch('/api/admin/nqoc/experts/batch-delete', {
            method: 'POST',
            headers: { ...authHeaders(), 'Content-Type': 'application/json' },
            body: JSON.stringify({ ids })
        });
        const result = await response.json();
        if (result.success) {
            toast(`成功删除 ${result.deletedCount || ids.length} 条记录`);
            clearSelection();
            loadData(currentPage);
        } else {
            toast(result.message || '批量删除失败');
        }
    } catch (e) {
        console.error(e);
        toast('批量删除失败');
    } finally {
        hideLoading();
    }
}

// CSV Export
function exportCSV() {
    const params = new URLSearchParams({
        search: document.getElementById('searchKeyword').value || '',
        status: document.getElementById('statusFilter').value || '',
        startDate: document.getElementById('searchStartDate').value || '',
        endDate: document.getElementById('searchEndDate').value || '',
        token: sessionStorage.getItem('token') || ''
    });
    window.open(`/api/admin/nqoc/experts/export?${params.toString()}`, '_blank');
}
